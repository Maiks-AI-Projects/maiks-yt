import { createHash } from "node:crypto";

import {
  getEventRegistryEntry,
  getEventRoutingDestinationCapability,
  resolveProviderIntakeEventKind,
  validateEventRoutingRule,
  type NormalizedProviderEventIntake
} from "@maiks-yt/domain/events";

import type {
  EventRoutingCooldownInsert,
  EventRoutingDispatchRepository,
  EventRoutingDispatchRuleRecord,
  EventRoutingHistoryInsert,
  EventRoutingPlaybackPublisher
} from "./event-routing-dispatch.types.js";
import { buildProductionEventRoutingPlaybackProjection } from "./event-routing-playback.service.js";
import type { EventRoutingStreamStateResolver } from "./event-routing-stream-state.types.js";

export type ProductionEventRoutingResult = {
  status: "ignored" | "stored_internal" | "routed" | "queued_for_approval" | "blocked_safety" | "blocked_cooldown";
  eventKind: string | null;
  playbackEmitted: boolean;
};

const addSeconds = (date: Date, seconds: number): Date =>
  new Date(date.getTime() + seconds * 1_000);

const actorCooldownKey = (actorExternalId: string): string =>
  `actor:${createHash("sha256").update(actorExternalId).digest("hex")}`;

export class EventRoutingProductionService {
  private readonly streamStateResolver: EventRoutingStreamStateResolver | null;

  public constructor(
    private readonly repository: EventRoutingDispatchRepository,
    private readonly publishPlayback: EventRoutingPlaybackPublisher,
    options: { streamStateResolver?: EventRoutingStreamStateResolver } = {}
  ) {
    this.streamStateResolver = options.streamStateResolver ?? null;
  }

  public async route(input: NormalizedProviderEventIntake): Promise<ProductionEventRoutingResult> {
    const eventKind = resolveProviderIntakeEventKind({
      provider: input.provider,
      providerEventName: input.providerEventName,
      internalTrigger: input.internalTrigger,
      category: input.category,
      catalogKnown: input.catalogKnown,
      moneyShaped: input.safety.moneyShaped,
      moderationShaped: input.safety.moderationShaped,
      authOrTokenShaped: input.safety.authOrTokenShaped,
      highVolume: input.safety.highVolume
    });

    if (!eventKind || !input.catalogKnown || input.safety.authOrTokenShaped) {
      return { eventKind: null, playbackEmitted: false, status: "ignored" };
    }

    const rule = await this.repository.getRule(eventKind, input.provider)
      ?? await this.repository.getRule(eventKind, "any");
    const occurredAt = input.occurredAt ?? input.receivedAt;

    if (!rule || !rule.enabled || rule.destination === "ignore") {
      await this.writeHistory(input, eventKind, rule ?? null, {
        destination: null,
        occurredAt,
        routingOutcome: "ignored"
      });
      return { eventKind, playbackEmitted: false, status: "ignored" };
    }

    const validation = validateEventRoutingRule(rule);
    const destinationCapability = getEventRoutingDestinationCapability(rule.destination);
    const entry = getEventRegistryEntry(eventKind);
    if (!validation.ok
      || rule.oncePerStream
      || entry.safety.internalOnly
      || (destinationCapability.runtimeConsumer === "unavailable")) {
      await this.writeHistory(input, eventKind, rule, {
        destination: null,
        occurredAt,
        routingOutcome: "blocked_safety"
      });
      return { eventKind, playbackEmitted: false, status: "blocked_safety" };
    }

    const streamState = await this.resolveStreamStateRequirement(input, rule);
    if (!streamState.ok) {
      await this.writeHistory(input, eventKind, rule, {
        destination: null,
        occurredAt,
        routingOutcome: "blocked_safety"
      });
      return { eventKind, playbackEmitted: false, status: "blocked_safety" };
    }

    if (rule.destination === "internal_audit") {
      await this.writeHistory(input, eventKind, rule, {
        destination: "internal_audit",
        occurredAt,
        routingOutcome: "stored_internal"
      });
      return { eventKind, playbackEmitted: false, status: "stored_internal" };
    }

    const cooldowns = this.buildCooldowns(input, eventKind, rule, input.receivedAt);
    if (!cooldowns.ok) {
      await this.writeHistory(input, eventKind, rule, {
        destination: null,
        occurredAt,
        routingOutcome: "blocked_safety"
      });
      return { eventKind, playbackEmitted: false, status: "blocked_safety" };
    }

    for (const cooldown of cooldowns.values) {
      const active = await this.repository.findActiveCooldown({
        routingRuleId: cooldown.routingRuleId,
        cooldownKey: cooldown.cooldownKey,
        now: input.receivedAt
      });
      if (active) {
        await this.writeHistory(input, eventKind, rule, {
          destination: null,
          occurredAt,
          routingOutcome: "blocked_cooldown"
        });
        return { eventKind, playbackEmitted: false, status: "blocked_cooldown" };
      }
    }

    const queueApproval = rule.approvalRequired || rule.destination === "approval_queue";
    const history = await this.writeHistory(input, eventKind, rule, {
      destination: rule.destination,
      occurredAt,
      routingOutcome: queueApproval ? "queued_for_approval" : "routed"
    });

    if (queueApproval) {
      await this.repository.queueApproval({
        eventHistoryId: history.id,
        routingRuleId: rule.id,
        destination: rule.destination
      });
    }

    for (const cooldown of cooldowns.values) {
      await this.repository.recordCooldown({
        ...cooldown,
        lastEventHistoryId: history.id
      });
    }

    if (queueApproval || (rule.destination !== "top_notification" && rule.destination !== "center_notification")) {
      return {
        eventKind,
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
      return { eventKind, playbackEmitted: false, status: "blocked_safety" };
    }

    const playback = await this.publishPlayback(projection.projection);
    return { eventKind, playbackEmitted: playback.emitted, status: "routed" };
  }

  private async writeHistory(
    input: NormalizedProviderEventIntake,
    eventKind: NonNullable<ReturnType<typeof resolveProviderIntakeEventKind>>,
    rule: EventRoutingDispatchRuleRecord | null,
    routing: Pick<EventRoutingHistoryInsert, "destination" | "occurredAt" | "routingOutcome">
  ) {
    return await this.repository.writeHistory({
      sourcePlatform: input.provider,
      eventKind,
      sourceEventId: input.sourceEventId,
      routingRuleId: rule?.id ?? null,
      routingOutcome: routing.routingOutcome,
      destination: routing.destination,
      actorUserId: null,
      actorExternalId: input.actorExternalId,
      actorDisplayName: input.actorDisplayName,
      userId: null,
      streamSessionId: null,
      streamScheduleEntryId: null,
      sessionId: null,
      isTest: false,
      isSimulated: false,
      isRealMoney: input.safety.moneyShaped,
      testResettable: false,
      redactedPayload: input.redactedPayload,
      occurredAt: routing.occurredAt
    });
  }

  private buildCooldowns(
    input: NormalizedProviderEventIntake,
    eventKind: NonNullable<ReturnType<typeof resolveProviderIntakeEventKind>>,
    rule: EventRoutingDispatchRuleRecord,
    now: Date
  ): { ok: true; values: Omit<EventRoutingCooldownInsert, "lastEventHistoryId">[] } | { ok: false } {
    const values: Omit<EventRoutingCooldownInsert, "lastEventHistoryId">[] = [];

    if (rule.globalCooldownSeconds && rule.globalCooldownSeconds > 0) {
      values.push({
        routingRuleId: rule.id,
        eventKind,
        sourcePlatform: input.provider,
        scope: "global",
        cooldownKey: "global",
        actorUserId: null,
        actorExternalId: null,
        streamSessionId: null,
        streamScheduleEntryId: null,
        windowStartedAt: now,
        windowEndsAt: addSeconds(now, rule.globalCooldownSeconds)
      });
    }

    if (rule.perUserCooldownSeconds && rule.perUserCooldownSeconds > 0) {
      if (!input.actorExternalId) {
        return { ok: false };
      }

      values.push({
        routingRuleId: rule.id,
        eventKind,
        sourcePlatform: input.provider,
        scope: "user",
        cooldownKey: actorCooldownKey(input.actorExternalId),
        actorUserId: null,
        actorExternalId: input.actorExternalId,
        streamSessionId: null,
        streamScheduleEntryId: null,
        windowStartedAt: now,
        windowEndsAt: addSeconds(now, rule.perUserCooldownSeconds)
      });
    }

    return { ok: true, values };
  }

  private async resolveStreamStateRequirement(
    input: NormalizedProviderEventIntake,
    rule: EventRoutingDispatchRuleRecord
  ): Promise<{ ok: true } | { ok: false }> {
    if (!rule.liveOnly && !rule.offlineOnly) {
      return { ok: true };
    }

    if (!this.streamStateResolver) {
      return { ok: false };
    }

    try {
      const resolution = await this.streamStateResolver.resolve({
        occurredAt: input.occurredAt,
        provider: input.provider,
        providerChannelId: input.providerChannelId,
        providerChannelIdentityId: input.providerChannelIdentityId,
        receivedAt: input.receivedAt
      });

      if (resolution.state === "unknown") {
        return { ok: false };
      }

      if (rule.liveOnly && resolution.state !== "live") {
        return { ok: false };
      }

      if (rule.offlineOnly && resolution.state !== "offline") {
        return { ok: false };
      }

      return { ok: true };
    } catch {
      return { ok: false };
    }
  }
}
