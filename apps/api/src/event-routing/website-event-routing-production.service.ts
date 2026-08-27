import { createHash } from "node:crypto";

import {
  canSourceEmitEventKind,
  getEventRegistryEntry,
  getEventRoutingDestinationCapability,
  validateEventRoutingRule
} from "@maiks-yt/domain/events";

import type {
  EventRoutingCooldownInsert,
  EventRoutingDispatchRuleRecord,
  EventRoutingHistoryInsert,
  EventRoutingPlaybackPublisher,
  EventRoutingProductionDecisionRepository
} from "./event-routing-dispatch.types.js";
import { buildProductionEventRoutingPlaybackProjection } from "./event-routing-playback.service.js";
import type {
  WebsiteEventRoutingProductionInput,
  WebsiteEventRoutingProductionResult
} from "./website-event-routing-production.types.js";

type CooldownPlan = Omit<EventRoutingCooldownInsert, "lastEventHistoryId">;

const addSeconds = (date: Date, seconds: number): Date =>
  new Date(date.getTime() + seconds * 1_000);

const hashedCooldownKey = (namespace: string, value: string): string =>
  `${namespace}:${createHash("sha256").update(value).digest("hex")}`;

const actorCooldownIdentity = (input: WebsiteEventRoutingProductionInput): {
  key: string;
  actorUserId: string | null;
  actorExternalId: string | null;
} | null => {
  if (input.actorUserId) {
    return {
      key: hashedCooldownKey("actor-user", input.actorUserId),
      actorUserId: input.actorUserId,
      actorExternalId: input.actorExternalId
    };
  }

  if (input.userId) {
    return {
      key: hashedCooldownKey("user", input.userId),
      actorUserId: input.userId,
      actorExternalId: input.actorExternalId
    };
  }

  if (input.actorExternalId) {
    return {
      key: hashedCooldownKey("actor-external", input.actorExternalId),
      actorUserId: null,
      actorExternalId: input.actorExternalId
    };
  }

  return null;
};

const streamCooldownIdentity = (input: WebsiteEventRoutingProductionInput): {
  key: string;
  streamSessionId: string | null;
  streamScheduleEntryId: string | null;
} | null => {
  if (input.streamSessionId) {
    return {
      key: hashedCooldownKey("stream-session", input.streamSessionId),
      streamSessionId: input.streamSessionId,
      streamScheduleEntryId: input.streamScheduleEntryId
    };
  }

  if (input.streamScheduleEntryId) {
    return {
      key: hashedCooldownKey("stream-schedule", input.streamScheduleEntryId),
      streamSessionId: null,
      streamScheduleEntryId: input.streamScheduleEntryId
    };
  }

  return null;
};

export class WebsiteEventRoutingProductionService {
  public constructor(
    private readonly repository: EventRoutingProductionDecisionRepository,
    private readonly publishPlayback: EventRoutingPlaybackPublisher
  ) {}

  public async route(
    input: WebsiteEventRoutingProductionInput
  ): Promise<WebsiteEventRoutingProductionResult> {
    if (!canSourceEmitEventKind("website", input.eventKind)) {
      return { playbackEmitted: false, status: "ignored" };
    }

    const entry = getEventRegistryEntry(input.eventKind);
    if (entry.safety.simulatedOnly || entry.safety.moneyGated) {
      return { playbackEmitted: false, status: "blocked_safety" };
    }

    const rule = await this.repository.getRule(input.eventKind, "website")
      ?? await this.repository.getRule(input.eventKind, "any");

    if (!rule || !rule.enabled || rule.destination === "ignore") {
      await this.writeHistory(input, rule ?? null, {
        destination: null,
        routingOutcome: "ignored"
      });
      return { playbackEmitted: false, status: "ignored" };
    }

    const validation = validateEventRoutingRule(rule);
    const destinationCapability = getEventRoutingDestinationCapability(rule.destination);
    if (!validation.ok
      || destinationCapability.runtimeConsumer === "unavailable"
      || rule.liveOnly
      || rule.offlineOnly) {
      await this.writeHistory(input, rule, {
        destination: null,
        routingOutcome: "blocked_safety"
      });
      return { playbackEmitted: false, status: "blocked_safety" };
    }

    if (entry.safety.internalOnly) {
      if (rule.destination !== "internal_audit") {
        await this.writeHistory(input, rule, {
          destination: null,
          routingOutcome: "blocked_safety"
        });
        return { playbackEmitted: false, status: "blocked_safety" };
      }
    }

    if (rule.destination === "internal_audit") {
      await this.writeHistory(input, rule, {
        destination: "internal_audit",
        routingOutcome: "stored_internal"
      });
      return { playbackEmitted: false, status: "stored_internal" };
    }

    if (validation.requiresUserOptOutCheck) {
      if (!input.userId) {
        await this.writeHistory(input, rule, {
          destination: null,
          routingOutcome: "blocked_safety"
        });
        return { playbackEmitted: false, status: "blocked_safety" };
      }

      if (await this.repository.isUserOptedOut({
        userId: input.userId,
        eventKind: input.eventKind
      })) {
        await this.writeHistory(input, rule, {
          destination: null,
          routingOutcome: "blocked_opt_out"
        });
        return { playbackEmitted: false, status: "blocked_opt_out" };
      }
    }

    const cooldowns = this.buildCooldowns(input, rule);
    if (!cooldowns.ok) {
      await this.writeHistory(input, rule, {
        destination: null,
        routingOutcome: "blocked_safety"
      });
      return { playbackEmitted: false, status: "blocked_safety" };
    }

    const queueApproval = rule.approvalRequired || rule.destination === "approval_queue";
    const committed = await this.repository.commitProductionDecision({
      history: this.buildHistory(input, rule, {
        destination: rule.destination,
        routingOutcome: queueApproval ? "queued_for_approval" : "routed"
      }),
      cooldowns: cooldowns.values,
      approval: queueApproval
        ? {
          routingRuleId: rule.id,
          destination: rule.destination
        }
        : null,
      now: input.receivedAt
    });
    if (committed.status === "blocked_cooldown") {
      return { playbackEmitted: false, status: "blocked_cooldown" };
    }

    const history = committed.history;

    if (queueApproval
      || (rule.destination !== "top_notification" && rule.destination !== "center_notification")) {
      return {
        playbackEmitted: false,
        status: queueApproval ? "queued_for_approval" : "stored_internal"
      };
    }

    const projection = buildProductionEventRoutingPlaybackProjection({
      history,
      destination: rule.destination,
      notificationPriority: rule.notificationPriority,
      soundKey: rule.soundKey
    });
    if (!projection.ok) {
      return { playbackEmitted: false, status: "blocked_safety" };
    }

    try {
      const playback = await this.publishPlayback(projection.projection);
      return { playbackEmitted: playback.emitted, status: "routed" };
    } catch {
      return { playbackEmitted: false, status: "routed" };
    }
  }

  private buildHistory(
    input: WebsiteEventRoutingProductionInput,
    rule: EventRoutingDispatchRuleRecord | null,
    routing: Pick<EventRoutingHistoryInsert, "destination" | "routingOutcome">
  ): EventRoutingHistoryInsert {
    return {
      sourcePlatform: "website",
      eventKind: input.eventKind,
      sourceEventId: input.sourceEventId,
      routingRuleId: rule?.id ?? null,
      routingOutcome: routing.routingOutcome,
      destination: routing.destination,
      actorUserId: input.actorUserId,
      actorExternalId: input.actorExternalId,
      actorDisplayName: input.actorDisplayName,
      userId: input.userId,
      streamSessionId: input.streamSessionId,
      streamScheduleEntryId: input.streamScheduleEntryId,
      sessionId: input.sessionId,
      isTest: false,
      isSimulated: false,
      isRealMoney: false,
      testResettable: false,
      redactedPayload: input.redactedPayload,
      occurredAt: input.occurredAt
    };
  }

  private async writeHistory(
    input: WebsiteEventRoutingProductionInput,
    rule: EventRoutingDispatchRuleRecord | null,
    routing: Pick<EventRoutingHistoryInsert, "destination" | "routingOutcome">
  ) {
    return await this.repository.writeHistory(this.buildHistory(input, rule, routing));
  }

  private buildCooldowns(
    input: WebsiteEventRoutingProductionInput,
    rule: EventRoutingDispatchRuleRecord
  ): { ok: true; values: CooldownPlan[] } | { ok: false } {
    const values: CooldownPlan[] = [];

    if (rule.globalCooldownSeconds && rule.globalCooldownSeconds > 0) {
      values.push({
        routingRuleId: rule.id,
        eventKind: input.eventKind,
        sourcePlatform: "website",
        scope: "global",
        cooldownKey: "global",
        actorUserId: null,
        actorExternalId: null,
        streamSessionId: null,
        streamScheduleEntryId: null,
        windowStartedAt: input.receivedAt,
        windowEndsAt: addSeconds(input.receivedAt, rule.globalCooldownSeconds)
      });
    }

    if (rule.perUserCooldownSeconds && rule.perUserCooldownSeconds > 0) {
      const identity = actorCooldownIdentity(input);
      if (!identity) {
        return { ok: false };
      }

      values.push({
        routingRuleId: rule.id,
        eventKind: input.eventKind,
        sourcePlatform: "website",
        scope: "user",
        cooldownKey: identity.key,
        actorUserId: identity.actorUserId,
        actorExternalId: identity.actorExternalId,
        streamSessionId: null,
        streamScheduleEntryId: null,
        windowStartedAt: input.receivedAt,
        windowEndsAt: addSeconds(input.receivedAt, rule.perUserCooldownSeconds)
      });
    }

    if (rule.oncePerStream) {
      const identity = streamCooldownIdentity(input);
      if (!identity) {
        return { ok: false };
      }

      values.push({
        routingRuleId: rule.id,
        eventKind: input.eventKind,
        sourcePlatform: "website",
        scope: "stream",
        cooldownKey: identity.key,
        actorUserId: null,
        actorExternalId: null,
        streamSessionId: identity.streamSessionId,
        streamScheduleEntryId: identity.streamScheduleEntryId,
        windowStartedAt: input.receivedAt,
        windowEndsAt: addSeconds(input.receivedAt, 365 * 24 * 60 * 60)
      });
    }

    return { ok: true, values };
  }
}
