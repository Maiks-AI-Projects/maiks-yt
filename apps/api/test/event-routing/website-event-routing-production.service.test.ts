import type {
  EventKind,
  EventRoutingRuleInput,
  EventSourcePlatform
} from "@maiks-yt/domain/events";
import { describe, expect, it, vi } from "vitest";

import type {
  EventRoutingActiveCooldown,
  EventRoutingApprovalQueueRecord,
  EventRoutingCooldownCheck,
  EventRoutingCooldownInsert,
  EventRoutingDispatchRuleRecord,
  EventRoutingHistoryInsert,
  EventRoutingHistoryRecord,
  EventRoutingProductionDecisionRepository
} from "../../src/event-routing/event-routing-dispatch.types.js";
import { WebsiteEventRoutingProductionService } from "../../src/event-routing/website-event-routing-production.service.js";
import type { WebsiteEventRoutingProductionInput } from "../../src/event-routing/website-event-routing-production.types.js";

const websiteEvent = (
  overrides: Partial<WebsiteEventRoutingProductionInput> = {}
): WebsiteEventRoutingProductionInput => ({
  eventKind: "website.schedule-changed",
  sourceEventId: "schedule:stream-1:2026-08-27T18:00:00.000Z:website.schedule-changed",
  actorUserId: null,
  actorExternalId: "maiks-yt:schedule",
  actorDisplayName: "Maiks.yt Schedule",
  userId: null,
  streamSessionId: null,
  streamScheduleEntryId: "stream-1",
  sessionId: null,
  redactedPayload: {
    displayText: "Project Zomboid schedule updated",
    event: {
      title: "Project Zomboid",
      startsAt: "2026-08-28T18:00:00.000Z",
      channelKey: "maiksplays",
      status: "planned"
    }
  },
  occurredAt: new Date("2026-08-27T18:00:00.000Z"),
  receivedAt: new Date("2026-08-27T18:00:01.000Z"),
  ...overrides
});

const rule = (
  eventKind: EventKind = "website.schedule-changed",
  overrides: Partial<EventRoutingRuleInput> = {}
): EventRoutingDispatchRuleRecord => ({
  id: "rule-1",
  eventKind,
  sourcePlatform: "website",
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

class Repository implements EventRoutingProductionDecisionRepository {
  public savedRules: EventRoutingDispatchRuleRecord[] = [];
  public optedOut = false;
  public activeCooldown: EventRoutingActiveCooldown | null = null;
  public readonly histories: EventRoutingHistoryRecord[] = [];
  public readonly approvals: EventRoutingApprovalQueueRecord[] = [];
  public readonly cooldowns: EventRoutingCooldownInsert[] = [];

  public async getRule(eventKind: EventKind, sourcePlatform: EventSourcePlatform | "any") {
    return this.savedRules.find((savedRule) =>
      savedRule.eventKind === eventKind && savedRule.sourcePlatform === sourcePlatform
    ) ?? null;
  }

  public async isUserOptedOut() {
    return this.optedOut;
  }

  public async findActiveCooldown(_input: EventRoutingCooldownCheck) {
    return this.activeCooldown;
  }

  public async writeHistory(input: EventRoutingHistoryInsert) {
    const history: EventRoutingHistoryRecord = {
      ...input,
      id: `history-${this.histories.length + 1}`,
      createdAt: "2026-08-27T18:00:01.000Z"
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
      createdAt: "2026-08-27T18:00:01.000Z"
    };
    this.approvals.push(approval);
    return approval;
  }

  public async recordCooldown(input: EventRoutingCooldownInsert) {
    this.cooldowns.push(input);
  }

  public async commitProductionDecision(input: Parameters<
    EventRoutingProductionDecisionRepository["commitProductionDecision"]
  >[0]) {
    if (input.cooldowns.length > 0 && this.activeCooldown) {
      const history = await this.writeHistory({
        ...input.history,
        destination: null,
        routingOutcome: "blocked_cooldown"
      });
      return {
        status: "blocked_cooldown" as const,
        history,
        approvalQueue: null,
        cooldownsRecorded: 0 as const
      };
    }

    const history = await this.writeHistory(input.history);
    const approvalQueue = input.approval
      ? await this.queueApproval({
        eventHistoryId: history.id,
        routingRuleId: input.approval.routingRuleId,
        destination: input.approval.destination
      })
      : null;
    for (const cooldown of input.cooldowns) {
      await this.recordCooldown({
        ...cooldown,
        lastEventHistoryId: history.id
      });
    }
    return {
      status: "committed" as const,
      history,
      approvalQueue,
      cooldownsRecorded: input.cooldowns.length
    };
  }
}

describe("WebsiteEventRoutingProductionService", () => {
  it("stores real website events as ignored when no saved rule exists", async () => {
    const repository = new Repository();
    const publish = vi.fn();
    const service = new WebsiteEventRoutingProductionService(repository, publish);

    await expect(service.route(websiteEvent())).resolves.toEqual({
      playbackEmitted: false,
      status: "ignored"
    });
    expect(repository.histories[0]).toMatchObject({
      sourcePlatform: "website",
      eventKind: "website.schedule-changed",
      isTest: false,
      isSimulated: false,
      isRealMoney: false,
      testResettable: false,
      destination: null,
      routingOutcome: "ignored"
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it("routes an explicitly enabled public schedule event to production playback", async () => {
    const repository = new Repository();
    repository.savedRules = [rule()];
    const publish = vi.fn().mockReturnValue({ emitted: true });
    const service = new WebsiteEventRoutingProductionService(repository, publish);

    await expect(service.route(websiteEvent())).resolves.toEqual({
      playbackEmitted: true,
      status: "routed"
    });
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({
      destination: "top_notification",
      overlayEvent: expect.objectContaining({
        type: "overlay.top-bar-notification.queued",
        payload: expect.objectContaining({
          actorName: "Maiks.yt Schedule",
          actionLabel: "Project Zomboid schedule updated",
          platform: "site"
        })
      })
    }));
  });

  it("rejects simulated-only money-shaped kinds at the production website boundary", async () => {
    const repository = new Repository();
    const publish = vi.fn();
    const service = new WebsiteEventRoutingProductionService(repository, publish);

    await expect(service.route(websiteEvent({
      eventKind: "simulated.support-money"
    } as unknown as Partial<WebsiteEventRoutingProductionInput>))).resolves.toEqual({
      playbackEmitted: false,
      status: "blocked_safety"
    });
    expect(repository.histories).toHaveLength(0);
    expect(publish).not.toHaveBeenCalled();
  });

  it("fails closed when an opt-out-aware event has no user identity or is opted out", async () => {
    const missingIdentityRepository = new Repository();
    missingIdentityRepository.savedRules = [rule("website.signup")];
    const missingIdentityService = new WebsiteEventRoutingProductionService(
      missingIdentityRepository,
      vi.fn()
    );

    await expect(missingIdentityService.route(websiteEvent({
      eventKind: "website.signup"
    }))).resolves.toMatchObject({ status: "blocked_safety" });
    expect(missingIdentityRepository.histories[0]?.routingOutcome).toBe("blocked_safety");

    const optedOutRepository = new Repository();
    optedOutRepository.savedRules = [rule("website.signup")];
    optedOutRepository.optedOut = true;
    const optedOutService = new WebsiteEventRoutingProductionService(optedOutRepository, vi.fn());

    await expect(optedOutService.route(websiteEvent({
      eventKind: "website.signup",
      userId: "user-1"
    }))).resolves.toMatchObject({ status: "blocked_opt_out" });
    expect(optedOutRepository.histories[0]?.routingOutcome).toBe("blocked_opt_out");
  });

  it("keeps internal-only website events inside internal audit", async () => {
    const repository = new Repository();
    repository.savedRules = [rule("website.account-security-change", {
      destination: "internal_audit"
    })];
    const publish = vi.fn();
    const service = new WebsiteEventRoutingProductionService(repository, publish);

    await expect(service.route(websiteEvent({
      eventKind: "website.account-security-change",
      redactedPayload: { displayText: "Account security changed" }
    }))).resolves.toEqual({
      playbackEmitted: false,
      status: "stored_internal"
    });
    expect(repository.histories[0]).toMatchObject({
      destination: "internal_audit",
      routingOutcome: "stored_internal"
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it("blocks internal-only events configured for a public destination", async () => {
    const repository = new Repository();
    repository.savedRules = [rule("website.account-security-change")];
    const publish = vi.fn();
    const service = new WebsiteEventRoutingProductionService(repository, publish);

    await expect(service.route(websiteEvent({
      eventKind: "website.account-security-change"
    }))).resolves.toMatchObject({ status: "blocked_safety" });
    expect(repository.histories[0]?.destination).toBeNull();
    expect(publish).not.toHaveBeenCalled();
  });

  it("fails closed for website live/offline rules without authoritative stream state", async () => {
    const repository = new Repository();
    repository.savedRules = [rule("website.schedule-changed", { liveOnly: true })];
    const publish = vi.fn();
    const service = new WebsiteEventRoutingProductionService(repository, publish);

    await expect(service.route(websiteEvent())).resolves.toMatchObject({
      status: "blocked_safety"
    });
    expect(repository.histories[0]?.routingOutcome).toBe("blocked_safety");
    expect(publish).not.toHaveBeenCalled();
  });

  it("requires actor identity for per-user cooldowns and hashes stored cooldown keys", async () => {
    const missingIdentityRepository = new Repository();
    missingIdentityRepository.savedRules = [rule("website.project-update-published", {
      perUserCooldownSeconds: 60
    })];
    const missingIdentityService = new WebsiteEventRoutingProductionService(
      missingIdentityRepository,
      vi.fn()
    );

    await expect(missingIdentityService.route(websiteEvent({
      eventKind: "website.project-update-published",
      actorExternalId: null
    }))).resolves.toMatchObject({
      status: "blocked_safety"
    });

    const identifiedRepository = new Repository();
    identifiedRepository.savedRules = [rule("website.schedule-changed", {
      perUserCooldownSeconds: 60
    })];
    const identifiedService = new WebsiteEventRoutingProductionService(
      identifiedRepository,
      vi.fn().mockReturnValue({ emitted: false })
    );
    await identifiedService.route(websiteEvent());

    expect(identifiedRepository.cooldowns[0]?.cooldownKey).toMatch(/^actor-external:[a-f0-9]{64}$/);
    expect(identifiedRepository.cooldowns[0]?.cooldownKey).not.toContain("maiks-yt:schedule");
  });

  it("supports once-per-schedule cooldowns without exposing schedule ids in the key", async () => {
    const repository = new Repository();
    repository.savedRules = [rule("website.schedule-changed", { oncePerStream: true })];
    const service = new WebsiteEventRoutingProductionService(
      repository,
      vi.fn().mockReturnValue({ emitted: false })
    );

    await expect(service.route(websiteEvent())).resolves.toMatchObject({ status: "routed" });
    expect(repository.cooldowns[0]).toMatchObject({
      scope: "stream",
      streamScheduleEntryId: "stream-1"
    });
    expect(repository.cooldowns[0]?.cooldownKey).toMatch(/^stream-schedule:[a-f0-9]{64}$/);
    expect(repository.cooldowns[0]?.cooldownKey).not.toContain("stream-1");

    repository.activeCooldown = {
      id: "cooldown-1",
      cooldownKey: repository.cooldowns[0]?.cooldownKey ?? "",
      hitCount: 1,
      windowEndsAt: "2027-08-27T18:00:01.000Z"
    };
    await expect(service.route(websiteEvent())).resolves.toMatchObject({
      status: "blocked_cooldown"
    });
  });

  it("queues approval-required website events without direct playback", async () => {
    const repository = new Repository();
    repository.savedRules = [rule("website.schedule-cancelled", {
      approvalRequired: true
    })];
    const publish = vi.fn();
    const service = new WebsiteEventRoutingProductionService(repository, publish);

    await expect(service.route(websiteEvent({
      eventKind: "website.schedule-cancelled"
    }))).resolves.toMatchObject({ status: "queued_for_approval" });
    expect(repository.approvals).toHaveLength(1);
    expect(publish).not.toHaveBeenCalled();
  });

  it("keeps a committed routing decision truthful when playback delivery throws", async () => {
    const repository = new Repository();
    repository.savedRules = [rule()];
    const service = new WebsiteEventRoutingProductionService(repository, async () => {
      throw new Error("overlay transport unavailable");
    });

    await expect(service.route(websiteEvent())).resolves.toEqual({
      playbackEmitted: false,
      status: "routed"
    });
    expect(repository.histories[0]?.routingOutcome).toBe("routed");
  });
});
