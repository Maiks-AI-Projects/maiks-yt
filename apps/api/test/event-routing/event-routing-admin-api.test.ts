import type { EventRoutingRuleInput } from "@maiks-yt/domain/events";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerEventRoutingAdminRoutes } from "../../src/event-routing/event-routing-admin.route.js";
import { EventRoutingAdminService } from "../../src/event-routing/event-routing-admin.service.js";
import type {
  EventRoutingAdminActor,
  EventRoutingAdminApprovalRecord,
  EventRoutingApprovalReviewPlayback,
  EventRoutingApprovalQueueStatus,
  EventRoutingAdminRepository,
  EventRoutingAdminRuleRecord,
  EventRoutingAdminUpsertInput
} from "../../src/event-routing/event-routing-admin.types.js";

const baseRule = (overrides: Partial<EventRoutingRuleInput> = {}): EventRoutingRuleInput => ({
  eventKind: "website.signup",
  sourcePlatform: "any",
  destination: "internal_audit",
  enabled: false,
  liveOnly: false,
  offlineOnly: false,
  approvalRequired: true,
  perUserCooldownSeconds: null,
  globalCooldownSeconds: 60,
  oncePerStream: false,
  templateKey: null,
  themeKey: null,
  soundKey: null,
  notificationPriority: "normal",
  ...overrides
});

const toRecord = (
  input: EventRoutingRuleInput,
  overrides: Partial<EventRoutingAdminRuleRecord> = {}
): EventRoutingAdminRuleRecord => ({
  ...input,
  id: `${input.eventKind}:${input.sourcePlatform}`,
  createdByUserId: "domain-user",
  updatedByUserId: "domain-user",
  createdAt: "2026-06-22T10:00:00.000Z",
  updatedAt: "2026-06-22T10:00:00.000Z",
  ...overrides
});

const toApproval = (
  overrides: Partial<EventRoutingAdminApprovalRecord> = {}
): EventRoutingAdminApprovalRecord => ({
  id: "approval-1",
  eventHistoryId: "history-1",
  routingRuleId: "rule-1",
  destination: "top_notification",
  status: "pending",
  reviewerUserId: null,
  reviewedAt: null,
  reviewNote: null,
  createdAt: "2026-06-22T10:00:00.000Z",
  updatedAt: "2026-06-22T10:00:00.000Z",
  event: {
    id: "history-1",
    sourcePlatform: "website",
    eventKind: "website.signup",
    sourceEventId: "preview-1",
    routingOutcome: "queued_for_approval",
    actorUserId: null,
    actorExternalId: "actor-1",
    actorDisplayName: "Preview User",
    userId: "user-1",
    streamSessionId: null,
    streamScheduleEntryId: null,
    sessionId: null,
    isTest: true,
    isSimulated: true,
    isRealMoney: false,
    testResettable: true,
    redactedPayload: {
      displayText: "Preview User joined Maiks.yt."
    },
    occurredAt: "2026-06-22T10:00:00.000Z",
    createdAt: "2026-06-22T10:00:00.000Z"
  },
  rule: {
    notificationPriority: "normal",
    sourcePlatform: "any"
  },
  label: "Website Signup",
  description: "A website account signup event for future promotional routing.",
  safety: {
    overlayEligible: true,
    internalOnly: false,
    moneyGated: false,
    providerGated: false,
    approvalRecommended: true,
    optOutSupported: true,
    cooldownRecommended: true,
    simulatedOnly: false
  },
  playback: null,
  ...overrides
});

class FakeEventRoutingAdminRepository implements EventRoutingAdminRepository {
  public actor: EventRoutingAdminActor | null = {
    domainUserId: "domain-user",
    rolePermissionValues: [["*"]]
  };
  public readonly rules = new Map<string, EventRoutingAdminRuleRecord>();
  public readonly approvals = new Map<string, EventRoutingAdminApprovalRecord>();
  public lastUpsert: EventRoutingAdminUpsertInput | null = null;
  public lastReview: {
    id: string;
    status: Extract<EventRoutingApprovalQueueStatus, "approved" | "rejected">;
    reviewerUserId: string;
    reviewNote: string | null;
    playback: EventRoutingApprovalReviewPlayback | null;
  } | null = null;

  public async resolveActor(): Promise<EventRoutingAdminActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }

  public async listRules(): Promise<readonly EventRoutingAdminRuleRecord[]> {
    return [...this.rules.values()].map((rule) => structuredClone(rule));
  }

  public async upsertRule(input: EventRoutingAdminUpsertInput): Promise<EventRoutingAdminRuleRecord> {
    this.lastUpsert = structuredClone(input);
    const key = `${input.eventKind}:${input.sourcePlatform}`;
    const current = this.rules.get(key);
    const record = toRecord(input, {
      id: current?.id ?? key,
      createdByUserId: current?.createdByUserId ?? input.actorUserId,
      updatedByUserId: input.actorUserId,
      createdAt: current?.createdAt ?? "2026-06-22T10:00:00.000Z",
      updatedAt: "2026-06-22T11:00:00.000Z"
    });
    this.rules.set(key, record);

    return structuredClone(record);
  }

  public async getRule(
    eventKind: EventRoutingRuleInput["eventKind"],
    sourcePlatform: EventRoutingRuleInput["sourcePlatform"]
  ): Promise<EventRoutingAdminRuleRecord | null> {
    const rule = this.rules.get(`${eventKind}:${sourcePlatform}`);

    return rule ? structuredClone(rule) : null;
  }

  public async listPendingApprovals(limit: number): Promise<readonly EventRoutingAdminApprovalRecord[]> {
    return [...this.approvals.values()]
      .filter((approval) => approval.status === "pending")
      .slice(0, limit)
      .map((approval) => structuredClone(approval));
  }

  public async getPendingApproval(id: string): Promise<EventRoutingAdminApprovalRecord | null> {
    const approval = this.approvals.get(id);

    return approval?.status === "pending" ? structuredClone(approval) : null;
  }

  public async reviewApproval(input: {
    id: string;
    status: Extract<EventRoutingApprovalQueueStatus, "approved" | "rejected">;
    reviewerUserId: string;
    reviewNote: string | null;
    playback: EventRoutingApprovalReviewPlayback | null;
  }): Promise<EventRoutingAdminApprovalRecord | null> {
    this.lastReview = structuredClone(input);
    const approval = this.approvals.get(input.id);

    if (!approval || approval.status !== "pending") {
      return null;
    }

    const reviewed: EventRoutingAdminApprovalRecord = {
      ...approval,
      status: input.status,
      reviewerUserId: input.reviewerUserId,
      reviewedAt: "2026-06-22T11:00:00.000Z",
      reviewNote: input.reviewNote,
      updatedAt: "2026-06-22T11:00:00.000Z",
      playback: input.playback
    };
    this.approvals.set(input.id, reviewed);

    return structuredClone(reviewed);
  }
}

describe("EventRoutingAdminService", () => {
  it("lists disabled defaults merged with persisted rules", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.rules.set("website.signup:any", toRecord(baseRule({
      destination: "top_notification",
      enabled: true
    })));
    const service = new EventRoutingAdminService(repository);

    const result = await service.listRules({ authUserId: "auth-user" });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.rules.find((rule) => rule.eventKind === "website.signup" && rule.sourcePlatform === "any"))
      .toMatchObject({
        destination: "top_notification",
        enabled: true,
        persisted: true,
        validation: {
          ok: true,
          requiresUserOptOutCheck: true
        }
      });
    expect(result.rules.find((rule) => rule.eventKind === "website.provider-token-change" && rule.sourcePlatform === "any"))
      .toMatchObject({
        destination: "internal_audit",
        enabled: false,
        persisted: false
      });
  });

  it("updates valid owner rules and keeps explicit enabled input", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    const service = new EventRoutingAdminService(repository);

    const result = await service.updateRule({
      authUserId: "auth-user",
      rule: baseRule({
        destination: "center_notification",
        enabled: true,
        perUserCooldownSeconds: 120
      })
    });

    expect(result).toMatchObject({
      ok: true,
      rule: {
        destination: "center_notification",
        enabled: true,
        validation: {
          ok: true,
          requiresUserOptOutCheck: true
        }
      }
    });
    expect(repository.lastUpsert).toMatchObject({
      actorUserId: "domain-user",
      enabled: true
    });
  });

  it("rejects impossible provider combinations and internal-only public destinations", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    const service = new EventRoutingAdminService(repository);

    await expect(service.updateRule({
      authUserId: "auth-user",
      rule: baseRule({
        eventKind: "twitch.follow",
        sourcePlatform: "discord"
      })
    })).resolves.toMatchObject({
      ok: false,
      reason: "event_routing_admin_invalid_input",
      issues: ["event_routing_source_cannot_emit_event"]
    });

    await expect(service.updateRule({
      authUserId: "auth-user",
      rule: baseRule({
        eventKind: "website.provider-token-change",
        sourcePlatform: "website",
        destination: "top_notification",
        enabled: true
      })
    })).resolves.toMatchObject({
      ok: false,
      reason: "event_routing_admin_invalid_input",
      issues: expect.arrayContaining(["event_routing_internal_only_public_destination"])
    });
  });

  it("denies unlinked and non-event-routing admins", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    const service = new EventRoutingAdminService(repository);

    repository.actor = null;
    await expect(service.listRules({ authUserId: "auth-user" })).resolves.toEqual({
      ok: false,
      reason: "event_routing_admin_user_unlinked"
    });

    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [["tokens:manage"]]
    };
    await expect(service.updateRule({
      authUserId: "auth-user",
      rule: baseRule()
    })).resolves.toEqual({
      ok: false,
      reason: "event_routing_admin_forbidden"
    });
  });

  it("lists pending safe simulated approval queue items", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.approvals.set("approval-1", toApproval());
    const service = new EventRoutingAdminService(repository);

    const result = await service.listPendingApprovals({ authUserId: "auth-user" });

    expect(result).toMatchObject({
      ok: true,
      approvals: [
        {
          id: "approval-1",
          destination: "top_notification",
          label: "Website Signup",
          event: {
            isTest: true,
            isSimulated: true,
            isRealMoney: false,
            testResettable: true
          }
        }
      ]
    });
  });

  it("approves safe simulated top notification playback", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.approvals.set("approval-1", toApproval());
    const published: unknown[] = [];
    const service = new EventRoutingAdminService(repository, (projection) => {
      published.push(projection);

      return {
        emitted: true,
        activeOverlayConnections: 1
      };
    });

    const result = await service.reviewApproval({
      authUserId: "auth-user",
      approvalId: "approval-1",
      action: "approve",
      reviewNote: "Looks safe."
    });

    expect(result).toMatchObject({
      ok: true,
      approval: {
        status: "approved",
        reviewerUserId: "domain-user",
        playback: {
          published: {
            emitted: true,
            activeOverlayConnections: 1
          }
        }
      }
    });
    expect(repository.lastReview).toMatchObject({
      status: "approved",
      reviewerUserId: "domain-user"
    });
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({
      destination: "top_notification",
      overlayEvent: {
        type: "overlay.top-bar-notification.queued",
        payload: {
          actorName: "Preview User",
          actionLabel: "Preview User joined Maiks.yt.",
          platform: "site",
          kind: "website"
        }
      }
    });
  });

  it("rejects unsafe internal-only playback even when queued data asks for a public destination", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.approvals.set("approval-1", toApproval({
      event: {
        ...toApproval().event,
        eventKind: "website.provider-token-change"
      }
    }));
    const published: unknown[] = [];
    const service = new EventRoutingAdminService(repository, (projection) => {
      published.push(projection);

      return {
        emitted: true
      };
    });

    const result = await service.reviewApproval({
      authUserId: "auth-user",
      approvalId: "approval-1",
      action: "approve",
      reviewNote: null
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "event_routing_admin_approval_playback_blocked",
      playback: {
        projected: {
          ok: false,
          reason: "event_routing_playback_internal_only"
        }
      }
    });
    expect(repository.lastReview).toMatchObject({
      status: "rejected",
      reviewerUserId: "domain-user"
    });
    expect(published).toHaveLength(0);
  });

  it("rejects pending approval items without public playback", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.approvals.set("approval-1", toApproval());
    const service = new EventRoutingAdminService(repository);

    const result = await service.reviewApproval({
      authUserId: "auth-user",
      approvalId: "approval-1",
      action: "reject",
      reviewNote: "Not this one."
    });

    expect(result).toMatchObject({
      ok: true,
      approval: {
        status: "rejected",
        playback: null
      }
    });
    expect(repository.lastReview).toMatchObject({
      status: "rejected",
      reviewNote: "Not this one.",
      playback: null
    });
  });
});

describe("event routing admin route boundary", () => {
  it("requires an auth session before listing routing rules", async () => {
    const server = Fastify();
    registerEventRoutingAdminRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/event-routing/rules"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });

  it("returns validation issues without persisting invalid updates", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    const server = Fastify();
    registerEventRoutingAdminRoutes(server, {
      getAuthSession: async () => ({
        user: {
          id: "auth-user"
        }
      }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new EventRoutingAdminService(repository)
    });

    const response = await server.inject({
      method: "PUT",
      url: "/admin/event-routing/rules",
      payload: baseRule({
        liveOnly: true,
        offlineOnly: true
      })
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      ok: false,
      reason: "event_routing_admin_invalid_input",
      issues: ["event_routing_live_offline_conflict"]
    });
    expect(repository.lastUpsert).toBeNull();
  });

  it("reviews pending approval queue items through the admin route", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.approvals.set("approval-1", toApproval());
    const server = Fastify();
    registerEventRoutingAdminRoutes(server, {
      getAuthSession: async () => ({
        user: {
          id: "auth-user"
        }
      }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new EventRoutingAdminService(repository)
    });

    const response = await server.inject({
      method: "POST",
      url: "/admin/event-routing/approvals/approval-1/review",
      payload: {
        action: "reject",
        reviewNote: "Skip playback."
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      approval: {
        id: "approval-1",
        status: "rejected",
        reviewNote: "Skip playback."
      }
    });
  });
});
