import {
  normalizeProviderEventIntake,
  type EventKind,
  type EventRoutingRuleInput,
  type EventSourcePlatform
} from "@maiks-yt/domain/events";
import { describe, expect, it, vi } from "vitest";

import { EventRoutingProductionService } from "../../src/event-routing/event-routing-production.service.js";
import type {
  EventRoutingActiveCooldown,
  EventRoutingApprovalQueueRecord,
  EventRoutingCooldownCheck,
  EventRoutingCooldownInsert,
  EventRoutingDispatchRepository,
  EventRoutingDispatchRuleRecord,
  EventRoutingHistoryInsert,
  EventRoutingHistoryRecord
} from "../../src/event-routing/event-routing-dispatch.types.js";
import type { EventRoutingStreamStateResolver } from "../../src/event-routing/event-routing-stream-state.types.js";

const followEvent = (overrides: {
  providerChannelId?: string | null;
  providerChannelIdentityId?: string | null;
} = {}) => {
  const result = normalizeProviderEventIntake({
    provider: "twitch",
    mechanism: "twitch-eventsub",
    providerEventName: "channel.follow",
    ...overrides,
    sourceEventId: "twitch-eventsub:event-1",
    actorExternalId: "viewer-1",
    actorDisplayName: "Viewer One",
    occurredAt: "2026-08-20T18:00:00.000Z",
    receivedAt: "2026-08-20T18:00:01.000Z",
    redactedPayload: {
      event: {
        user_id: "viewer-1",
        user_name: "Viewer One"
      }
    }
  });

  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.value;
};

const rule = (overrides: Partial<EventRoutingRuleInput> = {}): EventRoutingDispatchRuleRecord => ({
  id: "rule-1",
  eventKind: "twitch.follow",
  sourcePlatform: "twitch",
  destination: "top_notification",
  enabled: true,
  liveOnly: false,
  offlineOnly: false,
  approvalRequired: false,
  perUserCooldownSeconds: null,
  globalCooldownSeconds: null,
  oncePerStream: false,
  templateKey: null,
  themeKey: null,
  soundKey: null,
  notificationPriority: "normal",
  ...overrides
});

class Repository implements EventRoutingDispatchRepository {
  public savedRule: EventRoutingDispatchRuleRecord | null = null;
  public readonly histories: EventRoutingHistoryRecord[] = [];
  public readonly approvals: EventRoutingApprovalQueueRecord[] = [];
  public readonly cooldowns: EventRoutingCooldownInsert[] = [];
  public activeCooldown: EventRoutingActiveCooldown | null = null;

  public async getRule(eventKind: EventKind, sourcePlatform: EventSourcePlatform | "any") {
    return this.savedRule?.eventKind === eventKind
      && this.savedRule.sourcePlatform === sourcePlatform
      ? this.savedRule
      : null;
  }

  public async isUserOptedOut() { return false; }

  public async findActiveCooldown(_input: EventRoutingCooldownCheck) {
    return this.activeCooldown;
  }

  public async writeHistory(input: EventRoutingHistoryInsert) {
    const history: EventRoutingHistoryRecord = {
      ...input,
      id: `history-${this.histories.length + 1}`,
      createdAt: "2026-08-20T18:00:01.000Z"
    };
    this.histories.push(history);
    return history;
  }

  public async queueApproval(input: {
    eventHistoryId: string;
    routingRuleId: string | null;
    destination: EventRoutingApprovalQueueRecord["destination"];
  }) {
    const approval: EventRoutingApprovalQueueRecord = {
      ...input,
      id: `approval-${this.approvals.length + 1}`,
      status: "pending",
      createdAt: "2026-08-20T18:00:01.000Z"
    };
    this.approvals.push(approval);
    return approval;
  }

  public async recordCooldown(input: EventRoutingCooldownInsert) {
    this.cooldowns.push(input);
  }
}

describe("EventRoutingProductionService", () => {
  it("stores mapped real provider events as ignored when no saved rule exists", async () => {
    const repository = new Repository();
    const publish = vi.fn();
    const service = new EventRoutingProductionService(repository, publish);

    const result = await service.route(followEvent());

    expect(result).toEqual({
      eventKind: "twitch.follow",
      playbackEmitted: false,
      status: "ignored"
    });
    expect(repository.histories[0]).toMatchObject({
      isTest: false,
      isSimulated: false,
      isRealMoney: false,
      testResettable: false,
      destination: null,
      routingOutcome: "ignored"
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it("routes an enabled Twitch follow rule to the overlay publisher", async () => {
    const repository = new Repository();
    repository.savedRule = rule({ soundKey: "follow-creaky-door" });
    const publish = vi.fn().mockReturnValue({ emitted: true });
    const service = new EventRoutingProductionService(repository, publish);

    const result = await service.route(followEvent());

    expect(result).toEqual({
      eventKind: "twitch.follow",
      playbackEmitted: true,
      status: "routed"
    });
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({
      destination: "top_notification",
      overlayEvent: expect.objectContaining({
        type: "overlay.top-bar-notification.queued",
        payload: expect.objectContaining({
          actorName: "Viewer One",
          actionLabel: "followed the stream",
          platform: "twitch",
          sound: {
            url: "/event-sounds/02-standard-alerts/follow-creaky-door.wav",
            volume: 0.28
          }
        })
      })
    }));
  });

  it("fails closed when a saved production rule contains an unknown sound ref", async () => {
    const repository = new Repository();
    repository.savedRule = rule({ soundKey: "../not-allowed.wav" });
    const publish = vi.fn();
    const service = new EventRoutingProductionService(repository, publish);

    const result = await service.route(followEvent());

    expect(result).toEqual({
      eventKind: "twitch.follow",
      playbackEmitted: false,
      status: "blocked_safety"
    });
    expect(repository.histories[0]).toMatchObject({
      destination: null,
      routingOutcome: "blocked_safety"
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it("queues approval-required real events without playback", async () => {
    const repository = new Repository();
    repository.savedRule = rule({ approvalRequired: true });
    const publish = vi.fn();
    const service = new EventRoutingProductionService(repository, publish);

    const result = await service.route(followEvent());

    expect(result.status).toBe("queued_for_approval");
    expect(repository.approvals).toHaveLength(1);
    expect(publish).not.toHaveBeenCalled();
  });

  it("blocks active cooldowns before public playback", async () => {
    const repository = new Repository();
    repository.savedRule = rule({ globalCooldownSeconds: 30 });
    repository.activeCooldown = {
      id: "cooldown-1",
      cooldownKey: "global",
      hitCount: 1,
      windowEndsAt: "2026-08-20T18:00:30.000Z"
    };
    const publish = vi.fn();
    const service = new EventRoutingProductionService(repository, publish);

    const result = await service.route(followEvent());

    expect(result.status).toBe("blocked_cooldown");
    expect(repository.histories[0]?.routingOutcome).toBe("blocked_cooldown");
    expect(publish).not.toHaveBeenCalled();
  });

  it("routes live-only rules only when the originating Twitch channel is known live", async () => {
    const repository = new Repository();
    repository.savedRule = rule({ liveOnly: true });
    const publish = vi.fn().mockReturnValue({ emitted: true });
    const streamStateResolver: EventRoutingStreamStateResolver = {
      resolve: vi.fn(async () => ({ state: "live" }))
    };
    const service = new EventRoutingProductionService(repository, publish, { streamStateResolver });

    const result = await service.route(followEvent({ providerChannelId: "617410645" }));

    expect(result).toEqual({
      eventKind: "twitch.follow",
      playbackEmitted: true,
      status: "routed"
    });
    expect(streamStateResolver.resolve).toHaveBeenCalledWith({
      occurredAt: new Date("2026-08-20T18:00:00.000Z"),
      provider: "twitch",
      providerChannelId: "617410645",
      providerChannelIdentityId: null,
      receivedAt: new Date("2026-08-20T18:00:01.000Z")
    });
  });

  it("blocks live-only rules when the originating Twitch channel is offline", async () => {
    const repository = new Repository();
    repository.savedRule = rule({ liveOnly: true });
    const publish = vi.fn();
    const service = new EventRoutingProductionService(repository, publish, {
      streamStateResolver: {
        resolve: async () => ({ state: "offline" })
      }
    });

    const result = await service.route(followEvent({ providerChannelId: "617410645" }));

    expect(result).toEqual({
      eventKind: "twitch.follow",
      playbackEmitted: false,
      status: "blocked_safety"
    });
    expect(repository.histories[0]).toMatchObject({
      destination: null,
      routingOutcome: "blocked_safety"
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it("routes offline-only rules when the originating Twitch channel is known offline", async () => {
    const repository = new Repository();
    repository.savedRule = rule({ offlineOnly: true });
    const publish = vi.fn().mockReturnValue({ emitted: true });
    const service = new EventRoutingProductionService(repository, publish, {
      streamStateResolver: {
        resolve: async () => ({ state: "offline" })
      }
    });

    const result = await service.route(followEvent({ providerChannelId: "maiksmc" }));

    expect(result.status).toBe("routed");
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("blocks stream-state rules when state is unknown or no resolver is available", async () => {
    const unknownRepository = new Repository();
    unknownRepository.savedRule = rule({ liveOnly: true });
    const unknownPublish = vi.fn();
    const unknownService = new EventRoutingProductionService(unknownRepository, unknownPublish, {
      streamStateResolver: {
        resolve: async () => ({ state: "unknown" })
      }
    });
    const missingResolverRepository = new Repository();
    missingResolverRepository.savedRule = rule({ offlineOnly: true });
    const missingResolverPublish = vi.fn();
    const missingResolverService = new EventRoutingProductionService(missingResolverRepository, missingResolverPublish);

    expect(await unknownService.route(followEvent({ providerChannelId: "617410645" }))).toMatchObject({
      status: "blocked_safety"
    });
    expect(await missingResolverService.route(followEvent({ providerChannelId: "617410645" }))).toMatchObject({
      status: "blocked_safety"
    });
    expect(unknownRepository.histories[0]?.routingOutcome).toBe("blocked_safety");
    expect(missingResolverRepository.histories[0]?.routingOutcome).toBe("blocked_safety");
    expect(unknownPublish).not.toHaveBeenCalled();
    expect(missingResolverPublish).not.toHaveBeenCalled();
  });

  it("keeps once-per-stream blocked even when live state is known", async () => {
    const repository = new Repository();
    repository.savedRule = rule({ oncePerStream: true });
    const publish = vi.fn();
    const streamStateResolver: EventRoutingStreamStateResolver = {
      resolve: vi.fn(async () => ({ state: "live" }))
    };
    const service = new EventRoutingProductionService(repository, publish, { streamStateResolver });

    const result = await service.route(followEvent({ providerChannelId: "617410645" }));

    expect(result.status).toBe("blocked_safety");
    expect(streamStateResolver.resolve).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});
