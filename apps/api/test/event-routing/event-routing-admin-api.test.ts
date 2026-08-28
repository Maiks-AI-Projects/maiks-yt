import { eventKinds, type EventRoutingRuleInput } from "@maiks-yt/domain/events";
import type { DatabasePool } from "@maiks-yt/database";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerEventRoutingAdminRoutes } from "../../src/event-routing/event-routing-admin.route.js";
import { EventRoutingAdminService } from "../../src/event-routing/event-routing-admin.service.js";
import {
  buildEventRoutingApprovalRef,
  createEventRoutingAdminRepository,
  eventRoutingApprovalRefSql
} from "../../src/event-routing/event-routing-admin-store.service.js";
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

const defaultApprovalRef = buildEventRoutingApprovalRef("approval-1");

const toApproval = (
  overrides: Partial<EventRoutingAdminApprovalRepositoryRecord> = {}
): EventRoutingAdminApprovalRepositoryRecord => {
  const id = overrides.id ?? "approval-1";

  return {
    id,
    approvalRef: overrides.approvalRef ?? buildEventRoutingApprovalRef(id),
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
      sourcePlatform: "any",
      soundKey: null
    },
    ...overrides
  };
};

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
  public optedOut = false;
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

  public async getPendingApprovalByRef(approvalRef: string): Promise<EventRoutingAdminApprovalRepositoryRecord | null> {
    const approval = [...this.approvals.values()].find((candidate) => candidate.approvalRef === approvalRef);

    return approval?.status === "pending" ? structuredClone(approval) : null;
  }

  public async getApprovalByRef(approvalRef: string): Promise<EventRoutingAdminApprovalRepositoryRecord | null> {
    const approval = [...this.approvals.values()].find((candidate) => candidate.approvalRef === approvalRef);

    return approval ? structuredClone(approval) : null;
  }

  public async reviewApproval(input: {
    id: string;
    status: Extract<EventRoutingApprovalQueueStatus, "approved" | "rejected">;
    reviewerUserId: string;
    reviewNote: string | null;
    playback: EventRoutingApprovalReviewPlayback | null;
  }) {
    this.lastReview = structuredClone(input);
    const approval = this.approvals.get(input.id);

    if (!approval) {
      return { kind: "not_found" as const };
    }

    if (approval.status !== "pending") {
      return {
        kind: "terminal" as const,
        approval: structuredClone(approval)
      };
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

    return {
      kind: "reviewed" as const,
      approval: structuredClone(reviewed)
    };
  }

  public async isUserOptedOut(): Promise<boolean> {
    return this.optedOut;
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
  it("excludes revoked and expired role grants while preserving active delegated access", async () => {
    let actorSql = "";
    const repository = createEventRoutingAdminRepository({
      execute: async (sql: string, parameters: unknown[] = []) => {
        actorSql = sql;
        expect(parameters).toEqual(["auth-routing-admin"]);
        return [[{
          domainUserId: "domain-routing-admin",
          rolePermissions: JSON.stringify(["event-routing:manage"])
        }]];
      }
    } as unknown as DatabasePool);

    const actor = await repository.resolveActor("auth-routing-admin");

    expect(actor).toEqual({
      domainUserId: "domain-routing-admin",
      rolePermissionValues: [JSON.stringify(["event-routing:manage"])]
    });
    expect(actorSql).toContain("user_roles.revoked_at IS NULL");
    expect(actorSql).toContain("user_roles.expires_at IS NULL OR user_roles.expires_at > NOW()");
  });

  it("preserves active owner wildcard access", async () => {
    const repository = createEventRoutingAdminRepository({
      execute: async () => [[{
        domainUserId: "domain-owner",
        rolePermissions: JSON.stringify(["*"])
      }]]
    } as unknown as DatabasePool);

    await expect(repository.resolveActor("auth-owner")).resolves.toEqual({
      domainUserId: "domain-owner",
      rolePermissionValues: [JSON.stringify(["*"])]
    });
  });

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
    await expect(repository.getPendingApprovalByRef(defaultApprovalRef)).resolves.toBeNull();
    expect(calls[0]?.sql).toContain("h.is_test = false");
    expect(calls[0]?.sql).toContain("h.is_simulated = false");
    expect(calls[0]?.sql).toContain("h.test_resettable = false");
    expect(calls[0]?.sql).toContain(`${eventRoutingApprovalRefSql("q.id")} AS approvalRef`);
    expect(calls[1]?.sql).toContain(`WHERE ${eventRoutingApprovalRefSql("q.id")} = BINARY ?`);
    expect(calls[1]?.parameters).toEqual([defaultApprovalRef, "pending"]);
  });

  it("builds deterministic non-reversible approval references in one fixed format", () => {
    const rawApprovalId = "11111111-1111-4111-8111-111111111111";
    const first = buildEventRoutingApprovalRef(rawApprovalId);

    expect(first).toBe(buildEventRoutingApprovalRef(rawApprovalId));
    expect(first).toMatch(/^approvalref_v1_[a-f0-9]{64}$/u);
    expect(first).not.toBe(rawApprovalId);
    expect(first).not.toContain(rawApprovalId);
    expect(eventRoutingApprovalRefSql("q.id")).toBe(
      "CONCAT('approvalref_v1_', LOWER(SHA2(CONCAT('maiks-yt:event-routing-approval-reference:v1', CHAR(0), q.id), 256)))"
    );
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

  it("keeps the simulation catalogue available outside production", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    const service = new EventRoutingAdminService(repository);

    const result = await service.listRules({ authUserId: "auth-user" });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.rules.find((rule) => rule.eventKind === "simulated.support-money" && rule.sourcePlatform === "any"))
      .toMatchObject({
        label: "Simulated Support Money",
        description: expect.stringContaining("dev-only routing tests")
      });
  });

  it("omits simulation and test-only catalogue entries in production while retaining real kinds", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.rules.set("simulated.support-money:any", toRecord(baseRule({
      eventKind: "simulated.support-money",
      sourcePlatform: "any"
    }), { id: "simulated-any-rule" }));
    repository.rules.set("website.signup:test/system", toRecord(baseRule({
      sourcePlatform: "test/system"
    }), { id: "test-source-rule" }));
    repository.rules.set("twitch.follow:any", toRecord(baseRule({
      eventKind: "twitch.follow",
      sourcePlatform: "any",
      destination: "control_panel"
    }), { id: "real-unavailable-consumer-rule" }));
    const service = new EventRoutingAdminService(repository, { productionCatalogue: true });

    const result = await service.listRules({ authUserId: "auth-user" });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.rules.find((rule) => rule.eventKind === "simulated.support-money")).toBeUndefined();
    expect(result.rules.find((rule) => rule.sourcePlatform === "test/system")).toBeUndefined();
    expect(result.rules.find((rule) => rule.eventKind === "chat")?.description).toBe(
      "A live chat message from a chat-capable provider."
    );
    expect(JSON.stringify(result.rules)).not.toContain("dev-only routing tests");
    expect(JSON.stringify(result.rules)).not.toContain("test source");
    expect(result.rules.find((rule) => rule.eventKind === "twitch.follow" && rule.sourcePlatform === "any"))
      .toMatchObject({
        destination: "control_panel",
        persisted: true,
        destinationCapability: {
          runtimeConsumer: "unavailable"
        }
      });
    expect(result.rules.find((rule) => rule.eventKind === "website.free-tts-request"))
      .toMatchObject({
        description: "A future free website TTS request."
      });
    expect(result.rules.map((rule) => rule.eventKind)).toEqual(
      expect.arrayContaining(eventKinds.filter((eventKind) => eventKind !== "simulated.support-money"))
    );
  });

  it("returns authoritative destination and once-per-stream capability metadata", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.rules.set("website.schedule-changed:any", toRecord(baseRule({
      eventKind: "website.schedule-changed",
      destination: "top_notification"
    }), { id: "schedule-rule" }));
    const service = new EventRoutingAdminService(repository, { productionCatalogue: true });

    const result = await service.listRules({ authUserId: "auth-user" });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.destinationCapabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        destination: "control_panel",
        runtimeConsumer: "unavailable",
        supportsTemplate: false,
        supportsTheme: false,
        supportsSound: false
      }),
      expect.objectContaining({
        destination: "top_notification",
        runtimeConsumer: "available",
        supportsPriority: true,
        supportsTemplate: false,
        supportsTheme: false,
        supportsSound: true
      })
    ]));
    expect(result.rules.find((rule) => rule.eventKind === "website.schedule-changed" && rule.sourcePlatform === "any"))
      .toMatchObject({
        oncePerStreamAvailability: {
          supported: true,
          reason: "website_schedule_identity_available"
        }
      });
    expect(result.rules.find((rule) => rule.eventKind === "twitch.follow" && rule.sourcePlatform === "any"))
      .toMatchObject({
        oncePerStreamAvailability: {
          supported: false,
          reason: "provider_stream_session_identity_unavailable"
        }
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

  it("accepts once-per-stream only for supported website schedule rule kinds", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    const service = new EventRoutingAdminService(repository, { productionCatalogue: true });

    await expect(service.updateRule({
      authUserId: "auth-user",
      rule: baseRule({
        eventKind: "website.schedule-changed",
        sourcePlatform: "website",
        oncePerStream: true
      })
    })).resolves.toMatchObject({
      ok: true,
      rule: {
        oncePerStream: true,
        oncePerStreamAvailability: {
          supported: true
        }
      }
    });
    await expect(service.updateRule({
      authUserId: "auth-user",
      rule: baseRule({
        eventKind: "twitch.follow",
        sourcePlatform: "twitch",
        oncePerStream: true
      })
    })).resolves.toMatchObject({
      ok: false,
      reason: "event_routing_admin_invalid_input",
      issues: ["event_routing_unsupported_once_per_stream"]
    });
  });

  it("preserves unchanged saved legacy template and theme values but rejects new edits", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    const service = new EventRoutingAdminService(repository);

    await expect(service.updateRule({
      authUserId: "auth-user",
      rule: baseRule({
        destination: "top_notification",
        templateKey: "new-template",
        themeKey: "new-theme"
      })
    })).resolves.toMatchObject({
      ok: false,
      reason: "event_routing_admin_invalid_input",
      issues: expect.arrayContaining([
        "event_routing_unsupported_template",
        "event_routing_unsupported_theme"
      ])
    });
    expect(repository.lastUpsert).toBeNull();

    repository.rules.set("website.signup:any", toRecord(baseRule({
      destination: "top_notification",
      templateKey: "legacy-template",
      themeKey: "legacy-theme"
    }), { id: "legacy-rule" }));

    await expect(service.updateRule({
      authUserId: "auth-user",
      rule: baseRule({
        destination: "top_notification",
        enabled: true,
        templateKey: "legacy-template",
        themeKey: "legacy-theme"
      })
    })).resolves.toMatchObject({
      ok: true,
      rule: {
        templateKey: "legacy-template",
        themeKey: "legacy-theme",
        destinationCapability: {
          supportsTemplate: false,
          supportsTheme: false
        },
        validation: {
          ok: true
        }
      }
    });
    expect(repository.lastUpsert).toMatchObject({
      templateKey: "legacy-template",
      themeKey: "legacy-theme"
    });

    await expect(service.updateRule({
      authUserId: "auth-user",
      rule: baseRule({
        destination: "top_notification",
        templateKey: "changed-template",
        themeKey: "legacy-theme"
      })
    })).resolves.toMatchObject({
      ok: false,
      reason: "event_routing_admin_invalid_input",
      issues: ["event_routing_unsupported_template"]
    });
  });

  it("rejects production simulation and test-source rule writes without persistence", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.rules.set("simulated.support-money:website", toRecord(baseRule({
      eventKind: "simulated.support-money",
      sourcePlatform: "website"
    }), { id: "simulated-rule" }));
    const service = new EventRoutingAdminService(repository, { productionCatalogue: true });

    await expect(service.updateRule({
      authUserId: "auth-user",
      rule: baseRule({
        eventKind: "simulated.support-money",
        sourcePlatform: "website"
      })
    })).resolves.toEqual({
      ok: false,
      reason: "event_routing_admin_production_catalogue_forbidden",
      issues: ["event_routing_production_catalogue_forbidden"]
    });
    await expect(service.updateRule({
      authUserId: "auth-user",
      rule: baseRule({
        sourcePlatform: "test/system"
      })
    })).resolves.toEqual({
      ok: false,
      reason: "event_routing_admin_production_catalogue_forbidden",
      issues: ["event_routing_production_catalogue_forbidden"]
    });
    await expect(service.deleteRule({
      authUserId: "auth-user",
      eventKind: "simulated.support-money",
      sourcePlatform: "website"
    })).resolves.toEqual({
      ok: false,
      reason: "event_routing_admin_production_catalogue_forbidden"
    });
    expect(repository.lastUpsert).toBeNull();
    expect(repository.rules.has("simulated.support-money:website")).toBe(true);
  });

  it("preserves active delegated event-routing:manage access for bounded rule updates", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.actor = {
      domainUserId: "routing-manager",
      rolePermissionValues: [JSON.stringify(["event-routing:manage"])]
    };
    const service = new EventRoutingAdminService(repository);

    await expect(service.updateRule({
      authUserId: "auth-manager",
      rule: baseRule({
        destination: "internal_audit",
        enabled: true
      })
    })).resolves.toMatchObject({
      ok: true,
      rule: {
        destination: "internal_audit",
        enabled: true
      }
    });
    expect(repository.lastUpsert).toMatchObject({
      actorUserId: "routing-manager",
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

  it("denies linked users when no active delegated routing grant remains without rule side effects", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.actor = {
      domainUserId: "routing-manager",
      rolePermissionValues: [null]
    };
    const service = new EventRoutingAdminService(repository);

    await expect(service.updateRule({
      authUserId: "auth-manager",
      rule: baseRule({
        enabled: true
      })
    })).resolves.toEqual({
      ok: false,
      reason: "event_routing_admin_forbidden"
    });
    expect(repository.lastUpsert).toBeNull();
    expect(repository.rules.size).toBe(0);
  });

  it("denies linked users when no active owner wildcard remains without owner-only side effects", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.actor = {
      domainUserId: "domain-owner",
      rolePermissionValues: [null]
    };
    repository.rules.set("website.signup:any", toRecord(baseRule(), { id: "any-rule" }));
    const service = new EventRoutingAdminService(repository);

    await expect(service.deleteRule({
      authUserId: "auth-owner",
      eventKind: "website.signup",
      sourcePlatform: "any"
    })).resolves.toEqual({
      ok: false,
      reason: "event_routing_admin_forbidden"
    });
    expect(repository.rules.has("website.signup:any")).toBe(true);
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
          approvalRef: defaultApprovalRef,
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

  it("approves pending top notification events and publishes overlay playback once", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.approvals.set("approval-1", toApproval());
    const publish = vi.fn().mockReturnValue({
      emitted: true,
      activeOverlayConnections: 1
    });
    const service = new EventRoutingAdminService(repository, {
      productionCatalogue: false,
      publishPlayback: publish
    });

    const result = await service.reviewApproval({
      authUserId: "auth-user",
      approvalRef: defaultApprovalRef,
      action: "approve",
      reviewNote: "Looks safe."
    });

    expect(result).toMatchObject({
      ok: true,
      approval: {
        status: "approved",
        playback: {
          projected: { ok: true },
          published: {
            emitted: true
          }
        }
      }
    });
    expect(repository.lastReview).toMatchObject({
      status: "approved",
      reviewNote: "Looks safe.",
      playback: null
    });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({
      destination: "top_notification",
      overlayEvent: expect.objectContaining({
        type: "overlay.top-bar-notification.queued"
      })
    }));
  });

  it("approves pending center notification events through the routed overlay queue", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.approvals.set("approval-1", toApproval({
      destination: "center_notification"
    }));
    const publish = vi.fn().mockReturnValue({ emitted: true });
    const service = new EventRoutingAdminService(repository, {
      productionCatalogue: false,
      publishPlayback: publish
    });

    await expect(service.reviewApproval({
      authUserId: "auth-user",
      approvalRef: defaultApprovalRef,
      action: "approve",
      reviewNote: null
    })).resolves.toMatchObject({
      ok: true,
      approval: {
        status: "approved",
        playback: {
          published: {
            emitted: true
          }
        }
      }
    });
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({
      destination: "center_notification",
      overlayEvent: expect.objectContaining({
        type: "overlay.routed-notification.queued"
      })
    }));
  });

  it("approves approval-queue destinations as status-only completion", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.approvals.set("approval-1", toApproval({
      destination: "approval_queue"
    }));
    const publish = vi.fn();
    const service = new EventRoutingAdminService(repository, {
      productionCatalogue: false,
      publishPlayback: publish
    });

    await expect(service.reviewApproval({
      authUserId: "auth-user",
      approvalRef: defaultApprovalRef,
      action: "approve",
      reviewNote: "Status only."
    })).resolves.toMatchObject({
      ok: true,
      approval: {
        status: "approved",
        playback: null
      }
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it("rejects approval review for money, test, simulated, and simulated-only rows", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.approvals.set("money", toApproval({
      id: "money",
      event: {
        ...toApproval().event,
        isRealMoney: true
      }
    }));
    repository.approvals.set("test", toApproval({
      id: "test",
      event: {
        ...toApproval().event,
        isTest: true
      }
    }));
    repository.approvals.set("simulated", toApproval({
      id: "simulated",
      event: {
        ...toApproval().event,
        isSimulated: true
      }
    }));
    repository.approvals.set("simulated-money-kind", toApproval({
      id: "simulated-money-kind",
      event: {
        ...toApproval().event,
        eventKind: "simulated.support-money"
      }
    }));
    const service = new EventRoutingAdminService(repository, {
      productionCatalogue: true,
      publishPlayback: vi.fn()
    });

    for (const approvalId of ["money", "test", "simulated", "simulated-money-kind"]) {
      await expect(service.reviewApproval({
        authUserId: "auth-user",
        approvalRef: buildEventRoutingApprovalRef(approvalId),
        action: "approve",
        reviewNote: null
      })).resolves.toEqual({
        ok: false,
        reason: "event_routing_admin_approval_not_found"
      });
    }
    expect(repository.lastReview).toBeNull();
  });

  it("approves but blocks website public playback when the current opt-out is enabled", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.optedOut = true;
    repository.approvals.set("approval-1", toApproval());
    const publish = vi.fn();
    const service = new EventRoutingAdminService(repository, {
      productionCatalogue: false,
      publishPlayback: publish
    });

    await expect(service.reviewApproval({
      authUserId: "auth-user",
      approvalRef: defaultApprovalRef,
      action: "approve",
      reviewNote: null
    })).resolves.toMatchObject({
      ok: true,
      approval: {
        status: "approved",
        playback: {
          projected: {
            ok: false,
            reason: "event_routing_playback_current_opt_out"
          },
          published: null
        }
      }
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it("preserves queued destination when the current rule changed or was deleted", async () => {
    const changedRuleRepository = new FakeEventRoutingAdminRepository();
    changedRuleRepository.approvals.set("approval-1", toApproval({
      destination: "top_notification",
      rule: {
        notificationPriority: "urgent",
        sourcePlatform: "website",
        soundKey: "follow-creaky-door"
      }
    }));
    const changedRulePublish = vi.fn().mockReturnValue({ emitted: true });
    const changedRuleService = new EventRoutingAdminService(changedRuleRepository, {
      productionCatalogue: false,
      publishPlayback: changedRulePublish
    });

    await changedRuleService.reviewApproval({
      authUserId: "auth-user",
      approvalRef: defaultApprovalRef,
      action: "approve",
      reviewNote: null
    });
    expect(changedRulePublish).toHaveBeenCalledWith(expect.objectContaining({
      destination: "top_notification",
      overlayEvent: expect.objectContaining({
        payload: expect.objectContaining({
          priority: "urgent",
          sound: expect.objectContaining({
            url: "/event-sounds/02-standard-alerts/follow-creaky-door.wav"
          })
        })
      })
    }));

    const deletedRuleRepository = new FakeEventRoutingAdminRepository();
    deletedRuleRepository.approvals.set("approval-1", toApproval({
      routingRuleId: "deleted-rule",
      rule: {
        notificationPriority: "normal",
        sourcePlatform: null,
        soundKey: null
      }
    }));
    const deletedRulePublish = vi.fn().mockReturnValue({ emitted: true });
    const deletedRuleService = new EventRoutingAdminService(deletedRuleRepository, {
      productionCatalogue: false,
      publishPlayback: deletedRulePublish
    });

    await expect(deletedRuleService.reviewApproval({
      authUserId: "auth-user",
      approvalRef: defaultApprovalRef,
      action: "approve",
      reviewNote: null
    })).resolves.toMatchObject({
      ok: true,
      approval: {
        status: "approved"
      }
    });
    expect(deletedRulePublish).toHaveBeenCalledTimes(1);
  });

  it("publishes only once when two approvals race the same pending row", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.approvals.set("approval-1", toApproval());
    const publish = vi.fn().mockReturnValue({ emitted: true });
    const service = new EventRoutingAdminService(repository, {
      productionCatalogue: false,
      publishPlayback: publish
    });

    const results = await Promise.all([
      service.reviewApproval({
        authUserId: "auth-user",
        approvalRef: defaultApprovalRef,
        action: "approve",
        reviewNote: "First."
      }),
      service.reviewApproval({
        authUserId: "auth-user",
        approvalRef: defaultApprovalRef,
        action: "approve",
        reviewNote: "Second."
      })
    ]);

    expect(results).toEqual([
      expect.objectContaining({ ok: true }),
      expect.objectContaining({ ok: true })
    ]);
    expect(repository.approvals.get("approval-1")?.status).toBe("approved");
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("treats matching terminal retries as idempotent and opposite actions as conflict", async () => {
    const approvedRepository = new FakeEventRoutingAdminRepository();
    approvedRepository.approvals.set("approval-1", toApproval({
      status: "approved",
      reviewerUserId: "domain-user",
      reviewedAt: "2026-06-22T11:00:00.000Z"
    }));
    const approvedPublish = vi.fn();
    const approvedService = new EventRoutingAdminService(approvedRepository, {
      productionCatalogue: false,
      publishPlayback: approvedPublish
    });

    await expect(approvedService.reviewApproval({
      authUserId: "auth-user",
      approvalRef: defaultApprovalRef,
      action: "approve",
      reviewNote: null
    })).resolves.toMatchObject({
      ok: true,
      approval: {
        status: "approved",
        playback: null
      }
    });
    expect(approvedPublish).not.toHaveBeenCalled();

    await expect(approvedService.reviewApproval({
      authUserId: "auth-user",
      approvalRef: defaultApprovalRef,
      action: "reject",
      reviewNote: null
    })).resolves.toEqual({
      ok: false,
      reason: "event_routing_admin_approval_conflict"
    });

    const rejectedRepository = new FakeEventRoutingAdminRepository();
    rejectedRepository.approvals.set("approval-1", toApproval({
      status: "rejected",
      reviewerUserId: "domain-user",
      reviewedAt: "2026-06-22T11:00:00.000Z"
    }));
    const rejectedService = new EventRoutingAdminService(rejectedRepository, {
      productionCatalogue: false,
      publishPlayback: vi.fn()
    });

    await expect(rejectedService.reviewApproval({
      authUserId: "auth-user",
      approvalRef: defaultApprovalRef,
      action: "reject",
      reviewNote: null
    })).resolves.toMatchObject({
      ok: true,
      approval: {
        status: "rejected"
      }
    });
    await expect(rejectedService.reviewApproval({
      authUserId: "auth-user",
      approvalRef: defaultApprovalRef,
      action: "approve",
      reviewNote: null
    })).resolves.toEqual({
      ok: false,
      reason: "event_routing_admin_approval_conflict"
    });
  });

  it("approves once and reports unavailable playback when the publisher throws", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.approvals.set("approval-1", toApproval());
    const publish = vi.fn(() => {
      throw new Error("overlay transport unavailable");
    });
    const service = new EventRoutingAdminService(repository, {
      productionCatalogue: false,
      publishPlayback: publish
    });

    await expect(service.reviewApproval({
      authUserId: "auth-user",
      approvalRef: defaultApprovalRef,
      action: "approve",
      reviewNote: null
    })).resolves.toMatchObject({
      ok: true,
      approval: {
        status: "approved",
        playback: {
          projected: { ok: true },
          published: null
        }
      }
    });
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("rejects pending approval items without public playback", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.approvals.set("approval-1", toApproval());
    const service = new EventRoutingAdminService(repository);

    const result = await service.reviewApproval({
      authUserId: "auth-user",
      approvalRef: defaultApprovalRef,
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

  it("requires event-routing permission before approving a queued event", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.actor = {
      domainUserId: "linked-user",
      rolePermissionValues: [["creator-links:manage"]]
    };
    repository.approvals.set("approval-1", toApproval());
    const publish = vi.fn();
    const service = new EventRoutingAdminService(repository, {
      productionCatalogue: false,
      publishPlayback: publish
    });

    await expect(service.reviewApproval({
      authUserId: "auth-user",
      approvalRef: defaultApprovalRef,
      action: "approve",
      reviewNote: null
    })).resolves.toEqual({
      ok: false,
      reason: "event_routing_admin_forbidden"
    });
    expect(repository.approvals.get("approval-1")?.status).toBe("pending");
    expect(publish).not.toHaveBeenCalled();
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
      approvalRef: defaultApprovalRef,
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

  it("applies the production catalogue boundary through the registered admin routes", async () => {
    const calls: Array<{ sql: string; parameters: unknown[] }> = [];
    const server = Fastify();
    registerEventRoutingAdminRoutes(server, {
      getAuthSession: async () => ({
        user: {
          id: "auth-user"
        }
      }),
      getDatabasePool: () => ({
        execute: async (sql: string, parameters: unknown[] = []) => {
          calls.push({ sql, parameters });

          if (sql.includes("FROM auth_user_links")) {
            return [[{
              domainUserId: "domain-user",
              rolePermissions: JSON.stringify(["*"])
            }]];
          }

          if (sql.includes("FROM event_routing_rules")) {
            return [[
              toRecord(baseRule({
                eventKind: "simulated.support-money",
                sourcePlatform: "any"
              }), { id: "simulated-rule" }),
              toRecord(baseRule({
                sourcePlatform: "test/system"
              }), { id: "test-source-rule" }),
              toRecord(baseRule({
                eventKind: "twitch.follow",
                sourcePlatform: "any",
                destination: "internal_audit",
                enabled: true
              }), { id: "real-rule" })
            ]];
          }

          throw new Error(`unexpected SQL: ${sql}`);
        }
      } as unknown as DatabasePool),
      getNodeEnv: () => "production"
    });

    const listResponse = await server.inject({
      method: "GET",
      url: "/admin/event-routing/rules"
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      ok: true,
      rules: expect.arrayContaining([
        expect.objectContaining({
          eventKind: "twitch.follow",
          sourcePlatform: "any",
          persisted: true
        })
      ])
    });
    expect(listResponse.body).not.toContain("simulated.support-money");
    expect(listResponse.body).not.toContain("test/system");
    expect(listResponse.body).not.toContain("test source");
    expect(listResponse.body).not.toContain("dev-only routing tests");

    const updateResponse = await server.inject({
      method: "PUT",
      url: "/admin/event-routing/rules",
      payload: baseRule({
        eventKind: "simulated.support-money",
        sourcePlatform: "website"
      })
    });

    expect(updateResponse.statusCode).toBe(400);
    expect(updateResponse.json()).toEqual({
      ok: false,
      reason: "event_routing_admin_production_catalogue_forbidden",
      issues: ["event_routing_production_catalogue_forbidden"]
    });
    const deleteResponse = await server.inject({
      method: "DELETE",
      url: "/admin/event-routing/rules/website.signup/test%2Fsystem"
    });

    expect(deleteResponse.statusCode).toBe(400);
    expect(deleteResponse.json()).toEqual({
      ok: false,
      reason: "event_routing_admin_production_catalogue_forbidden"
    });
    expect(calls.some((call) => call.sql.includes("INSERT INTO event_routing_rules"))).toBe(false);
    expect(calls.some((call) => call.sql.includes("DELETE FROM event_routing_rules"))).toBe(false);
    await server.close();
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

  it("returns a stable safe failure for production simulation rule updates before persistence", async () => {
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
      createService: () => new EventRoutingAdminService(repository, { productionCatalogue: true })
    });

    const response = await server.inject({
      method: "PUT",
      url: "/admin/event-routing/rules",
      payload: baseRule({
        eventKind: "simulated.support-money",
        sourcePlatform: "website"
      })
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      ok: false,
      reason: "event_routing_admin_production_catalogue_forbidden",
      issues: ["event_routing_production_catalogue_forbidden"]
    });
    expect(repository.lastUpsert).toBeNull();
    expect(repository.rules.size).toBe(0);
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
      url: `/admin/event-routing/approvals/${defaultApprovalRef}/review`,
      payload: {
        action: "reject",
        reviewNote: "Skip playback."
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      approval: {
        approvalRef: defaultApprovalRef,
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

  it("keeps approval list and approve retries free of internal replay data", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    const rawApprovalId = "private-queue-id";
    const approvalRef = buildEventRoutingApprovalRef(rawApprovalId);
    repository.approvals.set(rawApprovalId, toApproval({
      id: rawApprovalId,
      eventHistoryId: "private-history-id",
      routingRuleId: "private-rule-id",
      event: {
        ...toApproval().event,
        id: "private-history-id"
      },
      rule: {
        notificationPriority: "normal",
        sourcePlatform: "any",
        soundKey: "follow-creaky-door"
      }
    }));
    const publish = vi.fn().mockReturnValue({
      emitted: true,
      activeOverlayConnections: 7
    });
    const service = new EventRoutingAdminService(repository, {
      productionCatalogue: false,
      publishPlayback: publish
    });
    const server = Fastify();
    registerEventRoutingAdminRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => service
    });

    const listResponse = await server.inject({
      method: "GET",
      url: "/admin/event-routing/approvals/pending"
    });
    const malformedResponse = await server.inject({
      method: "POST",
      url: "/admin/event-routing/approvals/private-queue-id/review",
      payload: { action: "approve", reviewNote: null }
    });
    const unknownResponse = await server.inject({
      method: "POST",
      url: `/admin/event-routing/approvals/${buildEventRoutingApprovalRef("unknown-queue-id")}/review`,
      payload: { action: "approve", reviewNote: null }
    });
    const approveResponse = await server.inject({
      method: "POST",
      url: `/admin/event-routing/approvals/${approvalRef}/review`,
      payload: { action: "approve", reviewNote: "Ready." }
    });
    const retryResponse = await server.inject({
      method: "POST",
      url: `/admin/event-routing/approvals/${approvalRef}/review`,
      payload: { action: "approve", reviewNote: "Ready." }
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      ok: true,
      approvals: [{ approvalRef }]
    });
    expect(malformedResponse.statusCode).toBe(400);
    expect(malformedResponse.json()).toEqual({
      ok: false,
      reason: "event_routing_admin_invalid_input"
    });
    expect(unknownResponse.statusCode).toBe(404);
    expect(unknownResponse.json()).toEqual({
      ok: false,
      reason: "event_routing_admin_approval_not_found"
    });
    expect(approveResponse.statusCode).toBe(200);
    expect(approveResponse.json()).toMatchObject({
      ok: true,
      approval: {
        approvalRef,
        status: "approved",
        rule: {
          notificationPriority: "normal",
          sourcePlatform: "any"
        },
        playback: {
          projected: { ok: true },
          published: { emitted: true }
        }
      }
    });
    expect(retryResponse.statusCode).toBe(200);
    expect(retryResponse.json()).toMatchObject({
      ok: true,
      approval: {
        approvalRef,
        status: "approved",
        playback: null
      }
    });

    const forbiddenResponseFragments = [
      "\"id\":",
      rawApprovalId,
      "soundKey",
      "follow-creaky-door",
      "eventHistoryId",
      "private-history-id",
      "routingRuleId",
      "private-rule-id",
      "projection",
      "overlayEvent",
      "actorName",
      "actionLabel",
      "avatarUrl",
      "activeOverlayConnections"
    ];
    for (const response of [listResponse, approveResponse, retryResponse]) {
      for (const fragment of forbiddenResponseFragments) {
        expect(response.body).not.toContain(fragment);
      }
    }
    expect(approvalRef).toMatch(/^approvalref_v1_[a-f0-9]{64}$/u);
    expect(approvalRef).not.toBe(rawApprovalId);
    expect(approvalRef).not.toContain(rawApprovalId);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("returns conflict when a route review action opposes an existing terminal status", async () => {
    const repository = new FakeEventRoutingAdminRepository();
    repository.approvals.set("approval-1", toApproval({
      status: "rejected",
      reviewerUserId: "domain-user",
      reviewedAt: "2026-06-22T11:00:00.000Z",
      reviewNote: "Already rejected."
    }));
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
      url: `/admin/event-routing/approvals/${defaultApprovalRef}/review`,
      payload: { action: "approve", reviewNote: "Ready." }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      ok: false,
      reason: "event_routing_admin_approval_conflict"
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
      url: `/admin/event-routing/approvals/${defaultApprovalRef}/review`,
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
