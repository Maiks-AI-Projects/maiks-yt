import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerProviderEventIntakeAdminRoutes } from "../../src/provider-integrations/provider-event-intake-admin.route.js";
import { ProviderEventIntakeAdminService } from "../../src/provider-integrations/provider-event-intake-admin.service.js";
import type {
  NormalizedProviderEventIntakeAdminFilters,
  ProviderEventIntakeAdminActor,
  ProviderEventIntakeAdminRepository,
  ProviderEventIntakeAdminResult
} from "../../src/provider-integrations/provider-event-intake-admin.types.js";

class FakeProviderEventIntakeRepository implements ProviderEventIntakeAdminRepository {
  public actor: ProviderEventIntakeAdminActor | null = {
    domainUserId: "owner-user",
    rolePermissionValues: [["*"]]
  };
  public lastFilters: NormalizedProviderEventIntakeAdminFilters | null = null;

  public async resolveActor(): Promise<ProviderEventIntakeAdminActor | null> {
    return this.actor;
  }

  public async listRecent(filters: NormalizedProviderEventIntakeAdminFilters) {
    this.lastFilters = filters;
    return [{
      actorDisplayName: "Viewer",
      actorExternalId: null,
      authOrTokenShaped: false,
      catalogKnown: true,
      category: "chat" as const,
      eventHistoryId: null,
      highVolume: true,
      id: "intake-1",
      internalTrigger: "provider.twitch.irc.privmsg",
      mechanism: "twitch-irc" as const,
      moderationShaped: false,
      moneyShaped: false,
      occurredAt: "2026-07-04T16:00:00.000Z",
      overlayEligibleByDefault: false as const,
      processingStatus: "stored" as const,
      provider: "twitch" as const,
      providerChannelId: "maiksmc",
      providerEventName: "PRIVMSG",
      providerMessageId: "message-1",
      receivedAt: "2026-07-04T16:00:01.000Z",
      redactedPayloadPreview: {
        message: "hello"
      },
      sourceEventId: "message-1"
    }];
  }
}

describe("ProviderEventIntakeAdminService", () => {
  it("allows owner wildcard to list recent intake rows", async () => {
    const repository = new FakeProviderEventIntakeRepository();
    const service = new ProviderEventIntakeAdminService(repository);

    await expect(service.listRecent({
      authUserId: "auth-owner",
      filters: {
        provider: "twitch",
        moneyShaped: false,
        limit: 25
      }
    })).resolves.toMatchObject({
      filters: {
        limit: 25,
        moneyShaped: false,
        provider: "twitch"
      },
      ok: true,
      readOnly: true,
      rows: [{
        id: "intake-1",
        provider: "twitch"
      }]
    });
  });

  it("denies unlinked and non-owner users", async () => {
    const repository = new FakeProviderEventIntakeRepository();
    const service = new ProviderEventIntakeAdminService(repository);

    repository.actor = null;
    await expect(service.listRecent({ authUserId: "missing" })).resolves.toEqual({
      ok: false,
      reason: "provider_event_intake_user_unlinked"
    });

    repository.actor = {
      domainUserId: "helper",
      rolePermissionValues: [["moderators:manage"]]
    };
    await expect(service.listRecent({ authUserId: "helper" })).resolves.toEqual({
      ok: false,
      reason: "provider_event_intake_forbidden"
    });
  });
});

describe("provider event intake admin routes", () => {
  it("returns 401 for unauthenticated access", async () => {
    const server = Fastify();

    registerProviderEventIntakeAdminRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("database should not be used");
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/connections/intake"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });

  it("passes parsed filters to the service", async () => {
    const server = Fastify();
    const service = {
      listRecent: async (): Promise<ProviderEventIntakeAdminResult> => ({
        filters: {
          authOrTokenShaped: null,
          catalogKnown: true,
          highVolume: null,
          limit: 10,
          moderationShaped: null,
          moneyShaped: true,
          processingStatus: "stored",
          provider: "youtube"
        },
        ok: true,
        readOnly: true,
        rows: []
      })
    };

    registerProviderEventIntakeAdminRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => service
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/connections/intake?provider=youtube&processingStatus=stored&moneyShaped=true&catalogKnown=true&limit=10"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      filters: {
        catalogKnown: true,
        limit: 10,
        moneyShaped: true,
        processingStatus: "stored",
        provider: "youtube"
      },
      ok: true
    });
  });

  it("rejects invalid filters", async () => {
    const server = Fastify();

    registerProviderEventIntakeAdminRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => ({
        listRecent: async () => {
          throw new Error("service should not be used");
        }
      })
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/connections/intake?provider=bad-provider"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      ok: false,
      reason: "provider_event_intake_invalid_input"
    });
  });
});
