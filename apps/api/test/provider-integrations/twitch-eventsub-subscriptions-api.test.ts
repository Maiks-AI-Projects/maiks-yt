import type {
  TwitchEventSubEnsureDefaultsResult,
  TwitchEventSubSubscriptionListResult
} from "@maiks-yt/integrations";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerTwitchEventSubSubscriptionRoutes } from "../../src/provider-integrations/twitch-eventsub-subscriptions.route.js";
import { TwitchEventSubSubscriptionControlService } from "../../src/provider-integrations/twitch-eventsub-subscriptions.service.js";
import type {
  TwitchEventSubSubscriptionActor,
  TwitchEventSubSubscriptionRepository
} from "../../src/provider-integrations/twitch-eventsub-subscriptions.types.js";

class FakeTwitchEventSubRepository implements TwitchEventSubSubscriptionRepository {
  public actor: TwitchEventSubSubscriptionActor | null = {
    domainUserId: "owner-user",
    rolePermissionValues: [["*"]]
  };

  public async resolveActor(): Promise<TwitchEventSubSubscriptionActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }
}

class FakeTwitchEventSubService {
  public ensureCalls = 0;
  public listResponse: TwitchEventSubSubscriptionListResult = {
    ok: true,
    broadcasterLogin: "maiksmc",
    broadcasterUserId: "617410645",
    callbackUrl: "https://api-dev.maiks.yt/provider-webhooks/twitch/eventsub",
    defaults: [
      {
        desired: {
          conditionKind: "broadcaster",
          type: "stream.online",
          version: "1"
        },
        existing: null,
        state: "missing"
      }
    ],
    readOnly: true,
    subscriptions: []
  };

  public ensureResponse: TwitchEventSubEnsureDefaultsResult = {
    ok: true,
    broadcasterLogin: "maiksmc",
    broadcasterUserId: "617410645",
    callbackUrl: "https://api-dev.maiks.yt/provider-webhooks/twitch/eventsub",
    results: [
      {
        created: {
          callbackMatches: true,
          condition: {
            broadcaster_user_id: "617410645"
          },
          cost: 0,
          createdAt: "2026-07-05T08:00:00Z",
          id: "stream-online",
          status: "webhook_callback_verification_pending",
          type: "stream.online",
          version: "1"
        },
        desired: {
          conditionKind: "broadcaster",
          type: "stream.online",
          version: "1"
        },
        existing: null,
        state: "created"
      }
    ]
  };

  public async ensureDefaults(): Promise<TwitchEventSubEnsureDefaultsResult> {
    this.ensureCalls += 1;
    return structuredClone(this.ensureResponse);
  }

  public async listDefaults(): Promise<TwitchEventSubSubscriptionListResult> {
    return structuredClone(this.listResponse);
  }
}

describe("TwitchEventSubSubscriptionControlService", () => {
  it("allows owner wildcard to list and create default subscriptions", async () => {
    const providerService = new FakeTwitchEventSubService();
    const service = new TwitchEventSubSubscriptionControlService(
      new FakeTwitchEventSubRepository(),
      providerService
    );

    await expect(service.listDefaults({ authUserId: "auth-owner" })).resolves.toMatchObject({
      ok: true,
      readOnly: true,
      broadcasterLogin: "maiksmc"
    });
    await expect(service.ensureDefaults({ authUserId: "auth-owner" })).resolves.toMatchObject({
      ok: true,
      results: [
        {
          state: "created"
        }
      ]
    });
  });

  it("denies unlinked and non-provider-management users", async () => {
    const repository = new FakeTwitchEventSubRepository();
    const service = new TwitchEventSubSubscriptionControlService(repository, new FakeTwitchEventSubService());

    repository.actor = null;
    await expect(service.listDefaults({ authUserId: "missing-user" })).resolves.toEqual({
      ok: false,
      reason: "twitch_eventsub_user_unlinked"
    });

    repository.actor = {
      domainUserId: "helper-user",
      rolePermissionValues: [["moderators:manage"]]
    };
    await expect(service.ensureDefaults({ authUserId: "helper-user" })).resolves.toEqual({
      ok: false,
      reason: "twitch_eventsub_forbidden"
    });
  });
});

describe("Twitch EventSub subscription routes", () => {
  it("returns 401 for unauthenticated access", async () => {
    const server = Fastify();

    registerTwitchEventSubSubscriptionRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => new TwitchEventSubSubscriptionControlService(
        new FakeTwitchEventSubRepository(),
        new FakeTwitchEventSubService()
      )
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/twitch-eventsub/subscriptions"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });

  it("lists and creates defaults through authenticated owner routes", async () => {
    const server = Fastify();
    const providerService = new FakeTwitchEventSubService();
    const service = new TwitchEventSubSubscriptionControlService(
      new FakeTwitchEventSubRepository(),
      providerService
    );

    registerTwitchEventSubSubscriptionRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => service
    });

    const listResponse = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/twitch-eventsub/subscriptions"
    });
    const createResponse = await server.inject({
      method: "POST",
      url: "/admin/provider-integrations/twitch-eventsub/default-subscriptions"
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      ok: true,
      broadcasterLogin: "maiksmc",
      defaults: [
        {
          state: "missing"
        }
      ]
    });
    expect(createResponse.statusCode).toBe(200);
    expect(createResponse.json()).toMatchObject({
      ok: true,
      results: [
        {
          state: "created"
        }
      ]
    });
    expect(providerService.ensureCalls).toBe(1);
  });

  it("returns safe errors without leaking thrown values", async () => {
    const server = Fastify();
    const service = {
      ensureDefaults: vi.fn(async () => {
        throw new Error("secret-eventsub-token-value exploded");
      }),
      listDefaults: vi.fn(async () => {
        throw new Error("secret-eventsub-token-value exploded");
      })
    };

    registerTwitchEventSubSubscriptionRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => service
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/provider-integrations/twitch-eventsub/subscriptions"
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      reason: "twitch_eventsub_unavailable"
    });
    expect(response.body).not.toContain("secret-eventsub-token-value");
  });
});
