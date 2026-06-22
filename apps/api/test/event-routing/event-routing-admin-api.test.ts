import type { EventRoutingRuleInput } from "@maiks-yt/domain/events";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerEventRoutingAdminRoutes } from "../../src/event-routing/event-routing-admin.route.js";
import { EventRoutingAdminService } from "../../src/event-routing/event-routing-admin.service.js";
import type {
  EventRoutingAdminActor,
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

class FakeEventRoutingAdminRepository implements EventRoutingAdminRepository {
  public actor: EventRoutingAdminActor | null = {
    domainUserId: "domain-user",
    rolePermissionValues: [["*"]]
  };
  public readonly rules = new Map<string, EventRoutingAdminRuleRecord>();
  public lastUpsert: EventRoutingAdminUpsertInput | null = null;

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
});
