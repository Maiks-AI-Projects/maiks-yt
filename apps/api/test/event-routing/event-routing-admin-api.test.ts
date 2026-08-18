import type { EventRoutingRuleInput } from "@maiks-yt/domain/events";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerEventRoutingAdminRoutes } from "../../src/event-routing/event-routing-admin.route.js";
import { EventRoutingAdminService } from "../../src/event-routing/event-routing-admin.service.js";
import { createEventRoutingAdminRepository } from "../../src/event-routing/event-routing-admin-store.service.js";
import type {
  EventRoutingAdminActor,
  EventRoutingAdminApprovalRepositoryRecord,
  EventRoutingApprovalReviewPlayback,
  EventRoutingApprovalQueueStatus,
  EventRoutingAdminRepository,
  EventRoutingAdminRuleRecord,
  EventRoutingAdminUpsertInput,
  EventRoutingOperationalHistoryRepositoryRecord
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
  overrides: Partial<EventRoutingAdminApprovalRepositoryRecord> = {}
): EventRoutingAdminApprovalRepositoryRecord => ({
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
    isTest: false,
    isSimulated: false,
    isRealMoney: false,
    testResettable: false,
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
  ...overrides
});

class FakeEventRoutingAdminRepository implements EventRoutingAdminRepository {
  public actor: EventRoutingAdminActor | null = {
    domainUserId: "domain-user",
    rolePermissionValues: [["*"]]
  };
  public readonly rules = new Map<string, EventRoutingAdminRuleRecord>();
  public readonly approvals = new Map<string, EventRoutingAdminApprovalRepositoryRecord>();
  public readonly operationalHistory: EventRoutingOperationalHistoryRepositoryRecord[] = [];
  public cooldownSummary = {
    activeCount: 0,
    nearestExpiry: null as string | null
  };
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

  public async listPendingApprovals(limit: number): Promise<readonly EventRoutingAdminApprovalRepositoryRecord[]> {
    return [...this.approvals.values()]
      .filter((approval) => approval.status === "pending")
      .slice(0, limit)
      .map((approval) => structuredClone(approval));
  }

  public async getPendingApproval(id: string): Promise<EventRoutingAdminApprovalRepositoryRecord | null> {
    const approval = this.approvals.get(id);

    return approval?.status === "pending" ? structuredClone(approval) : null;
  }

  public async reviewApproval(input: {
    id: string;
    status: Extract<EventRoutingApprovalQueueStatus, "approved" | "rejected">;
    reviewerUserId: string;
    reviewNote: string | null;
    playback: EventRoutingApprovalReviewPlayback | null;
  }): Promise<EventRoutingAdminApprovalRepositoryRecord | null> {
    this.lastReview = structuredClone(input);
    const approval = this.approvals.get(input.id);

    if (!approval || approval.status !== "pending") {
      return null;
    }

    const reviewed: EventRoutingAdminApprovalRepositoryRecord = {
      ...approval,
      status: input.status,
      reviewerUserId: input.reviewerUserId,
      reviewedAt: "2026-06-22T11:00:00.000Z",
      reviewNote: input.reviewNote,
      updatedAt: "2026-06-22T11:00:00.000Z"
    };
    this.approvals.set(input.id, reviewed);

    return structuredClone(reviewed);
  }

  public async deleteRule(
    eventKind: EventRoutingRuleInput["eventKind"],
    sourcePlatform: EventRoutingRuleInput["sourcePlatform"]
  ): Promise<boolean> {
    return this.rules.delete(`${eventKind}:${sourcePlatform}`);
  }

  public async getActiveCooldownSummary(): Promise<{
    activeCount: number;
    nearestExpiry: string | null;
  }> {
    return structuredClone(this.cooldownSummary);
  }

  public async listOperationalHistory(limit: number): Promise<readonly EventRoutingOperationalHistoryRepositoryRecord[]> {
    return this.operationalHistory.slice(0, limit).map((record) => structuredClone(record));
  }
}

describe("event routing admin store boundaries", () => {
  it("deletes only the selected rule row and leaves history and cooldown tables untouched", async () => {
    const calls: Array<{ sql: string; parameters: unknown[] }> = [];
    const repository = createEventRoutingAdminRepository({
      execute: async (sql: string, parameters: unknown[] = []) => {
        calls.push({ sql, parameters });
        return [{ affectedRows: 1 }, []];
      }
    } as never);

    await expect(repository.deleteRule("website.signup", "website")).resolves.toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain("DELETE FROM event_routing_rules");
    expect(calls[0]?.sql).not.toContain("event_history");
    expect(calls[0]?.sql).not.toContain("event_cooldown_state");
    expect(calls[0]?.parameters).toEqual(["website.signup", "website"]);
  });

  it("counts active cooldown rows without selecting private keys or identities", async () => {
    const calls: Array<{ sql: string; parameters: unknown[] }> = [];
    const repository = createEventRoutingAdminRepository({
      execute: async (sql: string, parameters: unknown[] = []) => {
        calls.push({ sql, parameters });
        return [[{
          activeCount: "2",
          nearestExpiry: "2026-06-22T12:30:00.000Z"
        }], []];
      }
    } as never);

    await expect(repository.getActiveCooldownSummary({
      routingRuleId: "rule-1",
      eventKind: "website.signup",
      sourcePlatform: "website"
    })).resolves.toEqual({
      activeCount: 2,
      nearestExpiry: "2026-06-22T12:30:00.000Z"
    });
    expect(calls[0]?.sql).toContain("window_ends_at > NOW()");
    expect(calls[0]?.sql).not.toContain("cooldown_key");
    expect(calls[0]?.sql).not.toContain("actor_user_id");
    expect(calls[0]?.sql).not.toContain("actor_external_id");
    expect(calls[0]?.parameters).toEqual(["rule-1", "website.signup", "website"]);
  });

  it("selects only real production approval rows", async () => {
    const calls: Array<{ sql: string; parameters: unknown[] }> = [];
    const repository = createEventRoutingAdminRepository({
      execute: async (sql: string, parameters: unknown[] = []) => {
        calls.push({ sql, parameters });
        return [[], []];
      }
    } as never);

    await expect(repository.listPendingApprovals(25)).resolves.toEqual([]);
    expect(calls[0]?.sql).toContain("h.is_test = false");
    expect(calls[0]?.sql).toContain("h.is_simulated = false");
    expect(calls[0]?.sql).toContain("h.test_resettable = false");
  });

  it("queries only real operational history and persists bounded review notes in the existing column", async () => {
    const calls: Array<{ sql: string; parameters: unknown[] }> = [];
    const repository = createEventRoutingAdminRepository({
      execute: async (sql: string, parameters: unknown[] = []) => {
        calls.push({ sql, parameters });
        return sql.includes("UPDATE event_approval_queue")
          ? [{ affectedRows: 1 }, []]
          : [[], []];
      }
    } as never);

    await repository.listOperationalHistory(50);
    await repository.reviewApproval({
      id: "approval-1",
      status: "rejected",
      reviewerUserId: "owner-user",
      reviewNote: "Production review note",
      playback: null
    });

    expect(calls[0]?.sql).toContain("is_test = false");
    expect(calls[0]?.sql).toContain("is_simulated = false");
    expect(calls[0]?.sql).toContain("test_resettable = false");
    expect(calls[0]?.sql).toContain("event_kind <> 'simulated.support-money'");
    expect(calls[1]?.sql).toContain("review_note = ?");
    expect(calls[1]?.parameters).toEqual([
      "rejected",
      "owner-user",
      "Production review note",
      "approval-1"
    ]);
  });
});

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

  it("lists pending real approval queue items with safe context", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.approvals.set("approval-1", toApproval());
    const service = new EventRoutingAdminService(repository);

    const result = await service.listPendingApprovals({ authUserId: "auth-user" });

    expect(result).toMatchObject({
      ok: true,
      approvals: [
        {
          id: "approval-1",
          productionEvent: true,
          destination: "top_notification",
          label: "Website Signup",
          event: {
            sourcePlatform: "website",
            eventKind: "website.signup",
            context: {
              displayText: "Preview User joined Maiks.yt.",
              displayName: "Preview User"
            }
          }
        }
      ]
    });
  });

  it("keeps real approvals pending until production rule execution exists", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.approvals.set("approval-1", toApproval());
    const service = new EventRoutingAdminService(repository);

    const result = await service.reviewApproval({
      authUserId: "auth-user",
      approvalId: "approval-1",
      action: "approve",
      reviewNote: "Looks safe."
    });

    expect(result).toEqual({
      ok: false,
      reason: "event_routing_admin_production_execution_unavailable"
    });
    expect(repository.lastReview).toBeNull();
    expect(repository.approvals.get("approval-1")?.status).toBe("pending");
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

  it("projects approval context through a compact allowlist without raw identities or payloads", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.approvals.set("approval-1", toApproval({
      event: {
        ...toApproval().event,
        actorUserId: "private-user-id",
        actorExternalId: "private-provider-id",
        redactedPayload: {
          displayText: "Safe display text",
          displayName: "Safe Name",
          title: "Safe title",
          projectLabel: "Safe project",
          amount: 12.5,
          currency: "EUR",
          accessToken: "must-not-leak",
          nested: { private: true }
        }
      }
    }));
    const service = new EventRoutingAdminService(repository);

    const result = await service.listPendingApprovals({ authUserId: "auth-user" });

    expect(result).toMatchObject({
      ok: true,
      approvals: [{
        label: "Website Signup",
        destination: "top_notification",
        event: {
          sourcePlatform: "website",
          eventKind: "website.signup",
          occurredAt: "2026-06-22T10:00:00.000Z",
          context: {
            displayText: "Safe display text",
            displayName: "Safe Name",
            title: "Safe title",
            projectLabel: "Safe project",
            amount: 12.5,
            currency: "EUR"
          }
        }
      }]
    });
    expect(JSON.stringify(result)).not.toContain("redactedPayload");
    expect(JSON.stringify(result)).not.toContain("private-user-id");
    expect(JSON.stringify(result)).not.toContain("private-provider-id");
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
  });

  it("does not expose or review test, simulated, or simulated-only approvals", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.approvals.set("approval-1", toApproval({
      event: {
        ...toApproval().event,
        isTest: true,
        isSimulated: true,
        testResettable: true,
        eventKind: "simulated.support-money"
      }
    }));
    const service = new EventRoutingAdminService(repository);

    await expect(service.listPendingApprovals({ authUserId: "auth-user" })).resolves.toEqual({
      ok: true,
      approvals: []
    });
    await expect(service.reviewApproval({
      authUserId: "auth-user",
      approvalId: "approval-1",
      action: "reject",
      reviewNote: null
    })).resolves.toEqual({
      ok: false,
      reason: "event_routing_admin_approval_not_found"
    });
    expect(repository.lastReview).toBeNull();
  });

  it("resets provider overrides to persisted Any and persisted Any to the generated default", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.rules.set("website.signup:any", toRecord(baseRule({
      destination: "top_notification",
      enabled: true
    }), { id: "any-rule" }));
    repository.rules.set("website.signup:website", toRecord(baseRule({
      sourcePlatform: "website",
      destination: "center_notification",
      enabled: true
    }), { id: "provider-rule" }));
    const service = new EventRoutingAdminService(repository);

    await expect(service.deleteRule({
      authUserId: "auth-user",
      eventKind: "website.signup",
      sourcePlatform: "website"
    })).resolves.toMatchObject({
      ok: true,
      removed: true,
      fallback: {
        id: "any-rule",
        sourcePlatform: "any",
        destination: "top_notification",
        persisted: true
      }
    });
    await expect(service.deleteRule({
      authUserId: "auth-user",
      eventKind: "website.signup",
      sourcePlatform: "any"
    })).resolves.toMatchObject({
      ok: true,
      removed: true,
      fallback: {
        id: null,
        sourcePlatform: "any",
        destination: "ignore",
        persisted: false
      }
    });
  });

  it("keeps production operations owner-only and reports absent default cooldown state honestly", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    const service = new EventRoutingAdminService(repository);

    await expect(service.getCooldownSummary({
      authUserId: "auth-user",
      eventKind: "website.signup",
      sourcePlatform: "website"
    })).resolves.toEqual({
      ok: true,
      summary: {
        activeCount: 0,
        nearestExpiry: null,
        rulePersisted: false
      }
    });

    repository.actor = {
      domainUserId: "manager-user",
      rolePermissionValues: [["event-routing:manage"]]
    };
    await expect(service.deleteRule({
      authUserId: "auth-user",
      eventKind: "website.signup",
      sourcePlatform: "any"
    })).resolves.toEqual({ ok: false, reason: "event_routing_admin_forbidden" });
    await expect(service.getCooldownSummary({
      authUserId: "auth-user",
      eventKind: "website.signup",
      sourcePlatform: "website"
    })).resolves.toEqual({ ok: false, reason: "event_routing_admin_forbidden" });
    await expect(service.listOperationalHistory({
      authUserId: "auth-user"
    })).resolves.toEqual({ ok: false, reason: "event_routing_admin_forbidden" });
  });

  it("returns only aggregate cooldown values for the effective persisted rule", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.rules.set("website.signup:any", toRecord(baseRule(), { id: "any-rule" }));
    repository.cooldownSummary = {
      activeCount: 3,
      nearestExpiry: "2026-06-22T12:00:00.000Z"
    };
    const service = new EventRoutingAdminService(repository);

    const result = await service.getCooldownSummary({
      authUserId: "auth-user",
      eventKind: "website.signup",
      sourcePlatform: "website"
    });

    expect(result).toEqual({
      ok: true,
      summary: {
        activeCount: 3,
        nearestExpiry: "2026-06-22T12:00:00.000Z",
        rulePersisted: true
      }
    });
    expect(Object.keys(result.ok ? result.summary : {})).toEqual([
      "activeCount",
      "nearestExpiry",
      "rulePersisted"
    ]);
  });

  it("filters operational history to real rows and projects only safe context", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    const realRecord: EventRoutingOperationalHistoryRepositoryRecord = {
      sourcePlatform: "twitch",
      eventKind: "twitch.follow",
      routingOutcome: "stored_internal",
      destination: "internal_audit",
      actorDisplayName: "Safe Follower",
      isTest: false,
      isSimulated: false,
      testResettable: false,
      redactedPayload: {
        displayText: "A real follow arrived.",
        title: "Follow",
        providerToken: "must-not-leak"
      },
      occurredAt: "2026-06-22T12:00:00.000Z"
    };
    repository.operationalHistory.push(
      realRecord,
      { ...realRecord, isTest: true },
      { ...realRecord, isSimulated: true },
      { ...realRecord, testResettable: true },
      {
        ...realRecord,
        sourcePlatform: "test/system",
        eventKind: "simulated.support-money"
      }
    );
    const service = new EventRoutingAdminService(repository);

    const result = await service.listOperationalHistory({ authUserId: "auth-user", limit: 50 });

    expect(result).toEqual({
      ok: true,
      history: [{
        sourcePlatform: "twitch",
        eventKind: "twitch.follow",
        label: "Twitch Follow",
        destination: "internal_audit",
        routingOutcome: "stored_internal",
        occurredAt: "2026-06-22T12:00:00.000Z",
        context: {
          displayText: "A real follow arrived.",
          displayName: "Safe Follower",
          title: "Follow",
          projectLabel: null,
          amount: null,
          currency: null
        }
      }]
    });
    expect(JSON.stringify(result)).not.toContain("redactedPayload");
    expect(JSON.stringify(result)).not.toContain("providerToken");
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
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
        reviewNote: "Skip playback.",
        event: {
          context: {
            displayText: "Preview User joined Maiks.yt.",
            displayName: "Preview User"
          }
        }
      }
    });
    expect(response.body).not.toContain("redactedPayload");
    expect(response.body).not.toContain("actorExternalId");
    expect(response.body).not.toContain("user-1");
  });

  it("returns conflict without mutating a real approval when execution is unavailable", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.approvals.set("approval-1", toApproval());
    const server = Fastify();
    registerEventRoutingAdminRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new EventRoutingAdminService(repository)
    });

    const response = await server.inject({
      method: "POST",
      url: "/admin/event-routing/approvals/approval-1/review",
      payload: { action: "approve", reviewNote: "Ready." }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      ok: false,
      reason: "event_routing_admin_production_execution_unavailable"
    });
    expect(repository.lastReview).toBeNull();
  });

  it("rejects approval notes beyond the persisted schema boundary", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.approvals.set("approval-1", toApproval());
    const server = Fastify();
    registerEventRoutingAdminRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new EventRoutingAdminService(repository)
    });

    const response = await server.inject({
      method: "POST",
      url: "/admin/event-routing/approvals/approval-1/review",
      payload: {
        action: "approve",
        reviewNote: "x".repeat(1001)
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      ok: false,
      reason: "event_routing_admin_invalid_input"
    });
    expect(repository.lastReview).toBeNull();
  });

  it("requires authentication for production reset, cooldown, and history routes", async () => {
    const server = Fastify();
    registerEventRoutingAdminRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      }
    });

    for (const request of [
      { method: "DELETE" as const, url: "/admin/event-routing/rules/website.signup/any" },
      { method: "GET" as const, url: "/admin/event-routing/cooldowns/summary?eventKind=website.signup&sourcePlatform=website" },
      { method: "GET" as const, url: "/admin/event-routing/history?limit=50" }
    ]) {
      const response = await server.inject(request);
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ ok: false, reason: "not_authenticated" });
    }
  });

  it("serves the exact reset, cooldown summary, and compact history route shapes", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.rules.set("website.signup:any", toRecord(baseRule(), { id: "any-rule" }));
    repository.rules.set("website.signup:test/system", toRecord(baseRule({
      sourcePlatform: "test/system"
    }), { id: "test-rule" }));
    repository.cooldownSummary = {
      activeCount: 2,
      nearestExpiry: "2026-06-22T12:30:00.000Z"
    };
    repository.operationalHistory.push({
      sourcePlatform: "website",
      eventKind: "website.signup",
      routingOutcome: "stored_internal",
      destination: "internal_audit",
      actorDisplayName: "Safe User",
      isTest: false,
      isSimulated: false,
      testResettable: false,
      redactedPayload: {
        displayText: "Safe signup",
        privateValue: "hidden"
      },
      occurredAt: "2026-06-22T12:00:00.000Z"
    });
    const server = Fastify();
    registerEventRoutingAdminRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new EventRoutingAdminService(repository)
    });

    const resetResponse = await server.inject({
      method: "DELETE",
      url: "/admin/event-routing/rules/website.signup/test%2Fsystem"
    });
    expect(resetResponse.statusCode).toBe(200);
    expect(resetResponse.json()).toMatchObject({
      ok: true,
      removed: true,
      fallback: {
        id: "any-rule",
        sourcePlatform: "any",
        persisted: true
      }
    });

    const invalidResetResponse = await server.inject({
      method: "DELETE",
      url: "/admin/event-routing/rules/not-an-event/website"
    });
    expect(invalidResetResponse.statusCode).toBe(400);
    expect(invalidResetResponse.json()).toEqual({
      ok: false,
      reason: "event_routing_admin_invalid_input"
    });

    const cooldownResponse = await server.inject({
      method: "GET",
      url: "/admin/event-routing/cooldowns/summary?eventKind=website.signup&sourcePlatform=website"
    });
    expect(cooldownResponse.statusCode).toBe(200);
    expect(cooldownResponse.json()).toEqual({
      ok: true,
      summary: {
        activeCount: 2,
        nearestExpiry: "2026-06-22T12:30:00.000Z",
        rulePersisted: true
      }
    });

    const historyResponse = await server.inject({
      method: "GET",
      url: "/admin/event-routing/history?limit=50"
    });
    expect(historyResponse.statusCode).toBe(200);
    expect(historyResponse.json()).toMatchObject({
      ok: true,
      history: [{
        label: "Website Signup",
        sourcePlatform: "website",
        eventKind: "website.signup",
        destination: "internal_audit",
        occurredAt: "2026-06-22T12:00:00.000Z",
        context: {
          displayText: "Safe signup",
          displayName: "Safe User"
        }
      }]
    });
    expect(historyResponse.body).not.toContain("redactedPayload");
    expect(historyResponse.body).not.toContain("privateValue");
    expect(historyResponse.body).not.toContain("hidden");
  });
});
