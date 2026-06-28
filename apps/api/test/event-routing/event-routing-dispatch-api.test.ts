import type { EventKind, EventRoutingRuleInput, EventSourcePlatform } from "@maiks-yt/domain/events";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerEventRoutingDispatchRoutes } from "../../src/event-routing/event-routing-dispatch.route.js";
import { EventRoutingDispatchService } from "../../src/event-routing/event-routing-dispatch.service.js";
import type {
  EventRoutingActiveCooldown,
  EventRoutingApprovalQueueRecord,
  EventRoutingCooldownCheck,
  EventRoutingCooldownInsert,
  EventRoutingDispatchRepository,
  EventRoutingDispatchRequest,
  EventRoutingDispatchRuleRecord,
  EventRoutingHistoryInsert,
  EventRoutingHistoryRecord
} from "../../src/event-routing/event-routing-dispatch.types.js";

const baseRule = (overrides: Partial<EventRoutingRuleInput> = {}): EventRoutingDispatchRuleRecord => ({
  id: "rule-1",
  eventKind: "website.signup",
  sourcePlatform: "any",
  destination: "internal_audit",
  enabled: false,
  liveOnly: false,
  offlineOnly: false,
  approvalRequired: true,
  perUserCooldownSeconds: null,
  globalCooldownSeconds: null,
  oncePerStream: false,
  templateKey: null,
  themeKey: null,
  soundKey: null,
  notificationPriority: "normal",
  ...overrides
});

const baseRequest = (overrides: Partial<EventRoutingDispatchRequest> = {}): EventRoutingDispatchRequest => ({
  sourcePlatform: "website",
  eventKind: "website.signup",
  explicitSimulation: true,
  isRealMoney: false,
  sourceEventId: "preview-1",
  actorUserId: null,
  actorExternalId: "actor-1",
  actorDisplayName: "Preview User",
  userId: "user-1",
  streamSessionId: null,
  streamScheduleEntryId: null,
  sessionId: null,
  redactedPayload: {
    displayText: "Preview User joined Maiks.yt."
  },
  occurredAt: "2026-06-22T10:00:00.000Z",
  ...overrides
});

class FakeEventRoutingDispatchRepository implements EventRoutingDispatchRepository {
  public readonly rules = new Map<string, EventRoutingDispatchRuleRecord>();
  public readonly histories: EventRoutingHistoryRecord[] = [];
  public readonly approvals: EventRoutingApprovalQueueRecord[] = [];
  public readonly cooldownWrites: EventRoutingCooldownInsert[] = [];
  public readonly activeCooldowns = new Map<string, EventRoutingActiveCooldown>();
  public optedOut = false;

  public async getRule(
    eventKind: EventKind,
    sourcePlatform: EventSourcePlatform | "any"
  ): Promise<EventRoutingDispatchRuleRecord | null> {
    return this.rules.get(`${eventKind}:${sourcePlatform}`) ?? null;
  }

  public async isUserOptedOut(): Promise<boolean> {
    return this.optedOut;
  }

  public async findActiveCooldown(input: EventRoutingCooldownCheck): Promise<EventRoutingActiveCooldown | null> {
    return this.activeCooldowns.get(`${input.routingRuleId}:${input.cooldownKey}`) ?? null;
  }

  public async writeHistory(input: EventRoutingHistoryInsert): Promise<EventRoutingHistoryRecord> {
    const history: EventRoutingHistoryRecord = {
      ...input,
      id: `history-${this.histories.length + 1}`,
      isTest: true,
      isSimulated: true,
      isRealMoney: false,
      testResettable: true,
      createdAt: "2026-06-22T10:00:00.000Z"
    };
    this.histories.push(history);

    return history;
  }

  public async queueApproval(input: {
    eventHistoryId: string;
    routingRuleId: string | null;
    destination: EventRoutingApprovalQueueRecord["destination"];
  }): Promise<EventRoutingApprovalQueueRecord> {
    const approval: EventRoutingApprovalQueueRecord = {
      id: `approval-${this.approvals.length + 1}`,
      eventHistoryId: input.eventHistoryId,
      routingRuleId: input.routingRuleId,
      destination: input.destination,
      status: "pending",
      createdAt: "2026-06-22T10:00:00.000Z"
    };
    this.approvals.push(approval);

    return approval;
  }

  public async recordCooldown(input: EventRoutingCooldownInsert): Promise<void> {
    this.cooldownWrites.push(input);
  }
}

describe("EventRoutingDispatchService", () => {
  it("queues approval-required safe simulated events with safe history flags", async () => {
    const repository = new FakeEventRoutingDispatchRepository();
    repository.rules.set("website.signup:any", baseRule({
      destination: "top_notification",
      enabled: true,
      approvalRequired: true,
      globalCooldownSeconds: 60
    }));
    const service = new EventRoutingDispatchService(repository);

    const result = await service.dispatch(baseRequest());

    expect(result).toMatchObject({
      ok: true,
      status: "queued_for_approval",
      destination: "top_notification",
      approvalQueue: {
        status: "pending",
        destination: "top_notification"
      },
      cooldownsRecorded: 1,
      publicPlayback: false
    });
    expect(repository.histories[0]).toMatchObject({
      isTest: true,
      isSimulated: true,
      isRealMoney: false,
      testResettable: true
    });
  });

  it("rejects real provider dispatch before writing history", async () => {
    const repository = new FakeEventRoutingDispatchRepository();
    repository.rules.set("twitch.follow:any", baseRule({
      eventKind: "twitch.follow",
      destination: "top_notification",
      enabled: true
    }));
    const service = new EventRoutingDispatchService(repository);

    await expect(service.dispatch(baseRequest({
      sourcePlatform: "twitch",
      eventKind: "twitch.follow",
      explicitSimulation: false
    }))).resolves.toMatchObject({
      ok: false,
      reason: "event_routing_dispatch_invalid_input",
      issues: ["event_routing_dispatch_real_provider_rejected"]
    });
    expect(repository.histories).toHaveLength(0);
  });

  it("blocks active cooldowns without queueing approval", async () => {
    const repository = new FakeEventRoutingDispatchRepository();
    repository.rules.set("website.signup:any", baseRule({
      destination: "top_notification",
      enabled: true,
      approvalRequired: true,
      globalCooldownSeconds: 60
    }));
    repository.activeCooldowns.set("rule-1:global", {
      id: "cooldown-1",
      cooldownKey: "global",
      windowEndsAt: "2026-06-22T10:01:00.000Z",
      hitCount: 1
    });
    const service = new EventRoutingDispatchService(repository);

    const result = await service.dispatch(baseRequest());

    expect(result).toMatchObject({
      ok: true,
      status: "blocked_cooldown",
      destination: null,
      approvalQueue: null,
      cooldownsRecorded: 0,
      publicPlayback: false
    });
    expect(repository.histories[0]).toMatchObject({
      routingOutcome: "blocked_cooldown",
      destination: null,
      isRealMoney: false,
      testResettable: true
    });
  });

  it("blocks stream-visible website events when the current user opted out", async () => {
    const repository = new FakeEventRoutingDispatchRepository();
    repository.optedOut = true;
    repository.rules.set("website.signup:any", baseRule({
      destination: "top_notification",
      enabled: true,
      approvalRequired: false
    }));
    const service = new EventRoutingDispatchService(repository);

    const result = await service.dispatch(baseRequest());

    expect(result).toMatchObject({
      ok: true,
      status: "blocked_opt_out",
      destination: null,
      approvalQueue: null,
      cooldownsRecorded: 0,
      publicPlayback: false
    });
    expect(repository.histories[0]).toMatchObject({
      routingOutcome: "blocked_opt_out",
      destination: null,
      userId: "user-1"
    });
  });

  it("fails closed for opt-out-aware stream-visible events when user identity is missing", async () => {
    const repository = new FakeEventRoutingDispatchRepository();
    repository.rules.set("website.signup:any", baseRule({
      destination: "top_notification",
      enabled: true,
      approvalRequired: false
    }));
    const service = new EventRoutingDispatchService(repository);

    const result = await service.dispatch(baseRequest({
      actorUserId: null,
      userId: null
    }));

    expect(result).toMatchObject({
      ok: true,
      status: "blocked_safety",
      destination: null,
      approvalQueue: null,
      cooldownsRecorded: 0,
      publicPlayback: false
    });
    expect(repository.histories[0]).toMatchObject({
      routingOutcome: "blocked_safety",
      destination: null,
      userId: null
    });
  });
});

describe("event routing dispatch route boundary", () => {
  it("dispatches through the injected dev service", async () => {
    const repository = new FakeEventRoutingDispatchRepository();
    repository.rules.set("website.signup:any", baseRule({
      destination: "internal_audit",
      enabled: true,
      approvalRequired: false
    }));
    const server = Fastify();
    registerEventRoutingDispatchRoutes(server, {
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new EventRoutingDispatchService(repository)
    });

    const response = await server.inject({
      method: "POST",
      url: "/dev/event-routing/dispatch",
      payload: baseRequest()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      status: "stored_internal",
      publicPlayback: false,
      history: {
        isTest: true,
        isSimulated: true,
        isRealMoney: false,
        testResettable: true
      }
    });
  });

  it("rejects real money at the API boundary", async () => {
    const repository = new FakeEventRoutingDispatchRepository();
    repository.rules.set("simulated.support-money:any", baseRule({
      eventKind: "simulated.support-money",
      destination: "internal_audit",
      enabled: true
    }));
    const server = Fastify();
    registerEventRoutingDispatchRoutes(server, {
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new EventRoutingDispatchService(repository)
    });

    const response = await server.inject({
      method: "POST",
      url: "/dev/event-routing/dispatch",
      payload: baseRequest({
        sourcePlatform: "test/system",
        eventKind: "simulated.support-money",
        explicitSimulation: true,
        isRealMoney: true
      })
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      reason: "event_routing_dispatch_invalid_input",
      issues: ["event_routing_dispatch_real_money_rejected"]
    });
    expect(repository.histories).toHaveLength(0);
  });
});
