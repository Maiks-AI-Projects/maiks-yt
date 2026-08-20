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

const followEvent = () => {
  const result = normalizeProviderEventIntake({
    provider: "twitch",
    mechanism: "twitch-eventsub",
    providerEventName: "channel.follow",
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
    repository.savedRule = rule();
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
          platform: "twitch"
        })
      })
    }));
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
});
