import {
  buildDefaultEventRoutingRule,
  resolveSafeSimulatedEventRoutingDecision
} from "@maiks-yt/domain/events";

import type {
  EventRoutingCooldownInsert,
  EventRoutingCooldownScope,
  EventRoutingDispatchRepository,
  EventRoutingDispatchRequest,
  EventRoutingDispatchResult,
  EventRoutingDispatchRuleRecord,
  EventRoutingHistoryInsert
} from "./event-routing-dispatch.types.js";

const addSeconds = (date: Date, seconds: number): Date =>
  new Date(date.getTime() + seconds * 1_000);

const actorCooldownKey = (input: EventRoutingDispatchRequest): string | null => {
  if (input.actorUserId) {
    return `actor-user:${input.actorUserId}`;
  }

  if (input.userId) {
    return `user:${input.userId}`;
  }

  if (input.actorExternalId) {
    return `actor-external:${input.actorExternalId}`;
  }

  return null;
};

const streamCooldownKey = (input: EventRoutingDispatchRequest): string | null => {
  if (input.streamSessionId) {
    return `stream-session:${input.streamSessionId}`;
  }

  if (input.streamScheduleEntryId) {
    return `stream-schedule:${input.streamScheduleEntryId}`;
  }

  return null;
};

type CooldownPlan = Omit<EventRoutingCooldownInsert, "lastEventHistoryId">;

const buildCooldownPlans = (input: {
  request: EventRoutingDispatchRequest;
  rule: EventRoutingDispatchRuleRecord;
  now: Date;
}): { ok: true; plans: CooldownPlan[] } | { ok: false } => {
  const plans: CooldownPlan[] = [];

  if (input.rule.globalCooldownSeconds && input.rule.globalCooldownSeconds > 0) {
    plans.push({
      routingRuleId: input.rule.id,
      eventKind: input.request.eventKind,
      sourcePlatform: input.request.sourcePlatform,
      scope: "global",
      cooldownKey: "global",
      actorUserId: null,
      actorExternalId: null,
      streamSessionId: null,
      streamScheduleEntryId: null,
      windowStartedAt: input.now,
      windowEndsAt: addSeconds(input.now, input.rule.globalCooldownSeconds)
    });
  }

  if (input.rule.perUserCooldownSeconds && input.rule.perUserCooldownSeconds > 0) {
    const key = actorCooldownKey(input.request);

    if (!key) {
      return { ok: false };
    }

    plans.push({
      routingRuleId: input.rule.id,
      eventKind: input.request.eventKind,
      sourcePlatform: input.request.sourcePlatform,
      scope: "user",
      cooldownKey: key,
      actorUserId: input.request.actorUserId ?? input.request.userId,
      actorExternalId: input.request.actorExternalId,
      streamSessionId: null,
      streamScheduleEntryId: null,
      windowStartedAt: input.now,
      windowEndsAt: addSeconds(input.now, input.rule.perUserCooldownSeconds)
    });
  }

  if (input.rule.oncePerStream) {
    const key = streamCooldownKey(input.request);

    if (!key) {
      return { ok: false };
    }

    plans.push({
      routingRuleId: input.rule.id,
      eventKind: input.request.eventKind,
      sourcePlatform: input.request.sourcePlatform,
      scope: "stream" satisfies EventRoutingCooldownScope,
      cooldownKey: key,
      actorUserId: null,
      actorExternalId: null,
      streamSessionId: input.request.streamSessionId,
      streamScheduleEntryId: input.request.streamScheduleEntryId,
      windowStartedAt: input.now,
      windowEndsAt: addSeconds(input.now, 365 * 24 * 60 * 60)
    });
  }

  return {
    ok: true,
    plans
  };
};

export class EventRoutingDispatchService {
  public constructor(private readonly repository: EventRoutingDispatchRepository) {}

  public async dispatch(input: EventRoutingDispatchRequest): Promise<EventRoutingDispatchResult> {
    const rule = await this.resolveRule(input);
    const decision = resolveSafeSimulatedEventRoutingDecision({
      dispatch: {
        sourcePlatform: input.sourcePlatform,
        eventKind: input.eventKind,
        explicitSimulation: input.explicitSimulation,
        isRealMoney: input.isRealMoney
      },
      rule
    });

    if (!decision.ok) {
      return {
        ok: false,
        reason: decision.dispatchIssues.length > 0
          ? "event_routing_dispatch_invalid_input"
          : "event_routing_dispatch_invalid_rule",
        issues: decision.dispatchIssues,
        ruleIssues: decision.ruleIssues
      };
    }

    const now = new Date();
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : now;
    const baseHistory = this.buildHistory(input, {
      routingRuleId: "id" in rule ? rule.id : null,
      routingOutcome: decision.routingOutcome,
      destination: decision.destination,
      occurredAt
    });

    if (decision.requiresUserOptOutCheck) {
      if (!input.userId) {
        return await this.writeBlocked(baseHistory, "blocked_safety");
      }

      if (await this.repository.isUserOptedOut({
        userId: input.userId,
        eventKind: input.eventKind
      })) {
        return await this.writeBlocked(baseHistory, "blocked_opt_out");
      }
    }

    const cooldownPlans = decision.requiresCooldownCheck && "id" in rule
      ? buildCooldownPlans({
        request: input,
        rule,
        now
      })
      : { ok: true as const, plans: [] };

    if (!cooldownPlans.ok) {
      return await this.writeBlocked(baseHistory, "blocked_safety");
    }

    for (const plan of cooldownPlans.plans) {
      const activeCooldown = await this.repository.findActiveCooldown({
        routingRuleId: plan.routingRuleId,
        cooldownKey: plan.cooldownKey,
        now
      });

      if (activeCooldown) {
        return await this.writeBlocked(baseHistory, "blocked_cooldown");
      }
    }

    const history = await this.repository.writeHistory(baseHistory);
    const approvalQueue = decision.requiresApprovalQueue && decision.destination
      ? await this.repository.queueApproval({
        eventHistoryId: history.id,
        routingRuleId: history.routingRuleId,
        destination: decision.destination
      })
      : null;

    for (const plan of cooldownPlans.plans) {
      await this.repository.recordCooldown({
        ...plan,
        lastEventHistoryId: history.id
      });
    }

    return {
      ok: true,
      status: history.routingOutcome,
      destination: history.destination,
      history,
      approvalQueue,
      cooldownsRecorded: cooldownPlans.plans.length,
      publicPlayback: false
    };
  }

  private async resolveRule(input: EventRoutingDispatchRequest): Promise<EventRoutingDispatchRuleRecord | ReturnType<typeof buildDefaultEventRoutingRule>> {
    return await this.repository.getRule(input.eventKind, input.sourcePlatform)
      ?? await this.repository.getRule(input.eventKind, "any")
      ?? buildDefaultEventRoutingRule(input.eventKind);
  }

  private buildHistory(
    input: EventRoutingDispatchRequest,
    routing: Pick<EventRoutingHistoryInsert, "routingRuleId" | "routingOutcome" | "destination" | "occurredAt">
  ): EventRoutingHistoryInsert {
    return {
      sourcePlatform: input.sourcePlatform,
      eventKind: input.eventKind,
      sourceEventId: input.sourceEventId,
      routingRuleId: routing.routingRuleId,
      routingOutcome: routing.routingOutcome,
      destination: routing.destination,
      actorUserId: input.actorUserId,
      actorExternalId: input.actorExternalId,
      actorDisplayName: input.actorDisplayName,
      userId: input.userId,
      streamSessionId: input.streamSessionId,
      streamScheduleEntryId: input.streamScheduleEntryId,
      sessionId: input.sessionId,
      redactedPayload: input.redactedPayload,
      occurredAt: routing.occurredAt
    };
  }

  private async writeBlocked(
    baseHistory: EventRoutingHistoryInsert,
    routingOutcome: "blocked_opt_out" | "blocked_cooldown" | "blocked_safety"
  ): Promise<EventRoutingDispatchResult> {
    const history = await this.repository.writeHistory({
      ...baseHistory,
      routingOutcome,
      destination: null
    });

    return {
      ok: true,
      status: routingOutcome,
      destination: null,
      history,
      approvalQueue: null,
      cooldownsRecorded: 0,
      publicPlayback: false
    };
  }
}
