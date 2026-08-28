import type { DatabasePool } from "@maiks-yt/database";
import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { registerAccountDomainRoutes, type AuthSessionSnapshot } from "../../src/account/index.js";
import { registerRetiredAccountAuthRoutes } from "../../src/account/account-retired-auth.route.js";
import { registerSanitizedNotFoundHandler } from "../../src/api-request-logging.service.js";

const originalNodeEnv = process.env.NODE_ENV;

const restoreNodeEnv = (): void => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
};

afterEach(() => {
  restoreNodeEnv();
});

const fakeAuthSession: NonNullable<AuthSessionSnapshot> = {
  user: {
    id: "auth-user-1",
    name: "Michael",
    image: "https://avatar.example.test/michael.png",
    email: "owner@example.test"
  },
  session: {
    id: "session-1",
    userId: "auth-user-1"
  }
};

const buildAccountRouteServer = ({
  nodeEnv,
  session = fakeAuthSession,
  execute = async () => [[]],
  providerIds = ["github", "twitch"]
}: {
  nodeEnv: string;
  session?: AuthSessionSnapshot;
  execute?: DatabasePool["execute"];
  providerIds?: readonly string[];
}) => {
  process.env.NODE_ENV = nodeEnv;

  const calls = {
    database: 0,
    session: 0
  };
  const server = Fastify();

  registerAccountDomainRoutes(server, {
    configuredAuthProviderIds: providerIds,
    getAuthSession: async () => {
      calls.session += 1;
      return session;
    },
    getDatabasePool: () => {
      calls.database += 1;
      return {
        execute
      } as unknown as DatabasePool;
    }
  });

  return {
    calls,
    server
  };
};

const buildAuthCompositionServer = ({
  nodeEnv,
  session = fakeAuthSession,
  providerIds = ["github", "twitch"]
}: {
  nodeEnv: string;
  session?: AuthSessionSnapshot;
  providerIds?: readonly string[];
}) => {
  process.env.NODE_ENV = nodeEnv;

  const calls = {
    authHandler: 0,
    database: 0,
    session: 0
  };
  const server = Fastify();
  registerSanitizedNotFoundHandler(server);
  registerAccountDomainRoutes(server, {
    configuredAuthProviderIds: providerIds,
    getAuthSession: async () => {
      calls.session += 1;
      return session;
    },
    getDatabasePool: () => {
      calls.database += 1;
      throw new Error("database should not be used");
    }
  });

  registerRetiredAccountAuthRoutes(server);

  server.route({
    method: ["GET", "POST"],
    url: "/auth/*",
    async handler(request) {
      calls.authHandler += 1;
      return {
        ok: true,
        requestUrl: request.url
      };
    }
  });

  return {
    calls,
    server
  };
};

describe("account domain route registration", () => {
  it("does not register legacy dev identity or dev auth status endpoints in production", async () => {
    const { calls, server } = buildAccountRouteServer({
      nodeEnv: "production",
      execute: async () => {
        throw new Error("database should not be used");
      }
    });

    const creatorResponse = await server.inject({
      method: "GET",
      url: "/identity/dev/creator"
    });
    const claimOwnerResponse = await server.inject({
      method: "POST",
      url: "/identity/dev/claim-owner",
      payload: {
        confirm: "claim-dev-owner"
      }
    });
    const devStatusResponse = await server.inject({
      method: "GET",
      url: "/auth/dev/status"
    });

    expect(creatorResponse.statusCode).toBe(404);
    expect(creatorResponse.body).not.toContain("creator_not_seeded");
    expect(claimOwnerResponse.statusCode).toBe(404);
    expect(claimOwnerResponse.body).not.toContain("not_authenticated");
    expect(devStatusResponse.statusCode).toBe(404);
    expect(calls.database).toBe(0);
    expect(calls.session).toBe(0);
  });

  it("keeps the legacy dev endpoints registered outside production", async () => {
    const { calls, server } = buildAccountRouteServer({
      nodeEnv: "development",
      session: null
    });

    const creatorResponse = await server.inject({
      method: "GET",
      url: "/identity/dev/creator"
    });
    const claimOwnerResponse = await server.inject({
      method: "POST",
      url: "/identity/dev/claim-owner",
      payload: {
        confirm: "claim-dev-owner"
      }
    });
    const devStatusResponse = await server.inject({
      method: "GET",
      url: "/auth/dev/status"
    });

    expect(creatorResponse.statusCode).toBe(404);
    expect(creatorResponse.json()).toEqual({
      ok: false,
      reason: "creator_not_seeded"
    });
    expect(claimOwnerResponse.statusCode).toBe(401);
    expect(claimOwnerResponse.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
    expect(devStatusResponse.statusCode).toBe(200);
    expect(devStatusResponse.json()).toEqual({
      ok: true,
      authProvider: "better-auth",
      configuredProviders: ["github", "twitch"],
      domainIdentityModel: "maiks-linked-accounts"
    });
    expect(calls.database).toBe(1);
    expect(calls.session).toBe(1);
  });

  it("requires a signed-in session for the production-native connection provider list", async () => {
    const { calls, server } = buildAccountRouteServer({
      nodeEnv: "production",
      session: null,
      execute: async () => {
        throw new Error("database should not be used");
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/account/connections/providers"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
    expect(calls.session).toBe(1);
    expect(calls.database).toBe(0);
  });

  it("returns only configured provider IDs for signed-in connection settings", async () => {
    const { calls, server } = buildAccountRouteServer({
      nodeEnv: "production",
      providerIds: ["google", "discord"],
      execute: async () => {
        throw new Error("database should not be used");
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/account/connections/providers"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      configuredProviderIds: ["google", "discord"]
    });
    expect(response.json()).not.toHaveProperty("authProvider");
    expect(response.json()).not.toHaveProperty("domainIdentityModel");
    expect(response.json()).not.toHaveProperty("configuredProviders");
    expect(calls.session).toBe(1);
    expect(calls.database).toBe(0);
  });

  it("keeps signed-out account session projection as null", async () => {
    const { calls, server } = buildAccountRouteServer({
      nodeEnv: "production",
      session: null,
      execute: async () => {
        throw new Error("database should not be used");
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/account/session"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toBeNull();
    expect(calls.session).toBe(1);
    expect(calls.database).toBe(0);
  });

  it("returns only the Maiks-owned signed-in account session projection", async () => {
    const sessionWithBetterAuthInternals = {
      user: {
        id: "auth-user-1",
        name: "Michael",
        email: "owner@example.test",
        image: "https://avatar.example.test/michael.png",
        emailVerified: true,
        createdAt: "2026-08-28T12:00:00.000Z",
        unknownProviderField: "raw-provider-value"
      },
      session: {
        id: "session-1",
        userId: "auth-user-1",
        token: "session-token-secret",
        ipAddress: "203.0.113.9",
        userAgent: "Raw Browser UA",
        expiresAt: "2026-08-29T12:00:00.000Z",
        createdAt: "2026-08-28T12:00:00.000Z",
        updatedAt: "2026-08-28T12:05:00.000Z"
      }
    } as unknown as NonNullable<AuthSessionSnapshot>;
    const { calls, server } = buildAccountRouteServer({
      nodeEnv: "production",
      session: sessionWithBetterAuthInternals,
      execute: async () => {
        throw new Error("database should not be used");
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/account/session"
    });
    const body = response.json();
    const serialized = JSON.stringify(body);

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({
      ok: true,
      signedIn: true,
      currentUser: {
        name: "Michael",
        email: "owner@example.test",
        imageUrl: "https://avatar.example.test/michael.png"
      }
    });
    expect(Object.keys(body)).toEqual(["ok", "signedIn", "currentUser"]);
    expect(Object.keys(body.currentUser)).toEqual(["name", "email", "imageUrl"]);
    expect(serialized).not.toContain("auth-user-1");
    expect(serialized).not.toContain("session-1");
    expect(serialized).not.toContain("session-token-secret");
    expect(serialized).not.toContain("203.0.113.9");
    expect(serialized).not.toContain("Raw Browser UA");
    expect(serialized).not.toContain("expiresAt");
    expect(serialized).not.toContain("createdAt");
    expect(serialized).not.toContain("updatedAt");
    expect(serialized).not.toContain("unknownProviderField");
    expect(calls.session).toBe(1);
    expect(calls.database).toBe(0);
  });

  it("dedupes auth account providers without returning auth row data", async () => {
    const { server } = buildAccountRouteServer({
      nodeEnv: "production",
      execute: async () => [[
        {
          id: "auth-account-row-1",
          userId: "auth-user-1",
          accountId: "provider-subject-1",
          providerId: "github",
          scope: "user email",
          accessToken: "provider-token",
          createdAt: "2026-08-28T12:00:00.000Z",
          updatedAt: "2026-08-28T12:05:00.000Z"
        },
        {
          id: "auth-account-row-2",
          userId: "auth-user-1",
          accountId: "provider-subject-2",
          providerId: "github",
          scope: "repo",
          refreshToken: "provider-refresh-token"
        },
        {
          id: "auth-account-row-3",
          userId: "auth-user-1",
          accountId: "provider-subject-3",
          providerId: "discord",
          scope: "identify email"
        }
      ]]
    });

    const response = await server.inject({
      method: "GET",
      url: "/account/auth-accounts"
    });
    const body = response.json();
    const serialized = JSON.stringify(body);

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({
      ok: true,
      accounts: [
        { providerId: "discord" },
        { providerId: "github" }
      ]
    });
    expect(serialized).not.toContain("auth-account-row");
    expect(serialized).not.toContain("auth-user-1");
    expect(serialized).not.toContain("provider-subject");
    expect(serialized).not.toContain("scope");
    expect(serialized).not.toContain("token");
    expect(serialized).not.toContain("createdAt");
    expect(serialized).not.toContain("updatedAt");
  });

  it("returns a minimal domain account snapshot with only Web-needed fields", async () => {
    const execute = async (sql: string) => {
      if (sql.includes("auth_user_links")) {
        return [[{
          userId: "domain-user-1",
          displayName: "Maiks.yt member",
          profileVisibility: "minimal",
          avatarUrl: null,
          authUserId: "auth-user-1",
          createdAt: "2026-08-28T12:00:00.000Z"
        }]];
      }

      if (sql.includes("COUNT(*)")) {
        return [[{
          linkedAccountCount: 2,
          id: "linked-account-1",
          providerAccountId: "provider-subject-1",
          capabilities: ["login", "channel-routing"],
          audienceKey: "audience-internal",
          channelKey: "channel-internal"
        }]];
      }

      throw new Error(`Unexpected query: ${sql}`);
    };
    const { server } = buildAccountRouteServer({
      nodeEnv: "production",
      execute: execute as DatabasePool["execute"]
    });

    const response = await server.inject({
      method: "GET",
      url: "/account/domain"
    });
    const body = response.json();
    const serialized = JSON.stringify(body);

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({
      ok: true,
      domainUser: {
        displayName: "Maiks.yt member",
        profileVisibility: "minimal",
        avatarUrl: null
      },
      linkedAccountCount: 2,
      needsSync: false
    });
    expect(serialized).not.toContain("authUserId");
    expect(serialized).not.toContain("auth-user-1");
    expect(serialized).not.toContain("domain-user-1");
    expect(serialized).not.toContain("linked-account-1");
    expect(serialized).not.toContain("provider-subject-1");
    expect(serialized).not.toContain("audience-internal");
    expect(serialized).not.toContain("channel-internal");
    expect(serialized).not.toContain("capabilities");
    expect(serialized).not.toContain("createdAt");
  });

  it("returns only the minimal domain projection from sync and profile visibility saves", async () => {
    const execute = async (sql: string) => {
      if (sql.includes("auth_user_links")) {
        return [[{
          userId: "domain-user-1",
          displayName: "Maiks.yt member",
          profileVisibility: "private",
          avatarUrl: null
        }]];
      }

      if (sql.includes("SELECT account_id")) {
        return [[{
          accountId: "provider-subject-1",
          providerId: "github",
          id: "auth-account-row-1",
          scope: "user email",
          accessToken: "provider-token"
        }]];
      }

      if (sql.includes("SELECT id FROM linked_accounts")) {
        return [[]];
      }

      if (sql.includes("INSERT INTO linked_accounts") || sql.includes("UPDATE users")) {
        return [{ affectedRows: 1 }];
      }

      if (sql.includes("COUNT(*)")) {
        return [[{
          linkedAccountCount: 1,
          providerAccountId: "provider-subject-1",
          capabilities: ["login"],
          createdAt: "2026-08-28T12:00:00.000Z"
        }]];
      }

      throw new Error(`Unexpected query: ${sql}`);
    };
    const { server } = buildAccountRouteServer({
      nodeEnv: "production",
      execute: execute as DatabasePool["execute"]
    });

    const syncResponse = await server.inject({
      method: "POST",
      url: "/account/domain/sync",
      payload: {}
    });
    const visibilityResponse = await server.inject({
      method: "POST",
      url: "/account/domain/profile-visibility",
      payload: { profileVisibility: "public" }
    });

    expect(syncResponse.statusCode).toBe(200);
    expect(syncResponse.json()).toEqual({
      ok: true,
      domainUser: {
        displayName: "Maiks.yt member",
        profileVisibility: "private",
        avatarUrl: null
      },
      linkedAccountCount: 1,
      needsSync: false
    });
    expect(JSON.stringify(syncResponse.json())).not.toContain("createdLinkedAccounts");
    expect(JSON.stringify(syncResponse.json())).not.toContain("provider-subject-1");

    expect(visibilityResponse.statusCode).toBe(200);
    expect(visibilityResponse.json()).toEqual({
      ok: true,
      domainUser: {
        displayName: "Maiks.yt member",
        profileVisibility: "public",
        avatarUrl: null
      },
      linkedAccountCount: 1,
      needsSync: false
    });
    expect(JSON.stringify(visibilityResponse.json())).not.toContain("domain-user-1");
    expect(JSON.stringify(visibilityResponse.json())).not.toContain("createdAt");
  });
});

describe("account and Better Auth route composition", () => {
  it.each(["GET", "POST"] as const)(
    "tombstones %s requests to the retired production auth path before Better Auth",
    async (method) => {
      const { calls, server } = buildAuthCompositionServer({
        nodeEnv: "production"
      });

      const retiredResponse = await server.inject({
        method,
        url: "/auth/dev/status?source=retired"
      });

      expect(retiredResponse.statusCode).toBe(404);
      expect(retiredResponse.json()).toEqual({
        message: `Route ${method}:/auth/dev/status not found`,
        error: "Not Found",
        statusCode: 404
      });
      expect(calls).toEqual({
        authHandler: 0,
        database: 0,
        session: 0
      });

      const authResponse = await server.inject({
        method: "GET",
        url: "/auth/get-session?source=account-settings"
      });

      expect(authResponse.statusCode).toBe(200);
      expect(authResponse.json()).toEqual({
        ok: true,
        requestUrl: "/auth/get-session?source=account-settings"
      });
      expect(calls).toEqual({
        authHandler: 1,
        database: 0,
        session: 0
      });
    }
  );

  it("keeps the non-production legacy status route ahead of Better Auth", async () => {
    const { calls, server } = buildAuthCompositionServer({
      nodeEnv: "development"
    });

    const response = await server.inject({
      method: "GET",
      url: "/auth/dev/status?source=legacy"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      authProvider: "better-auth",
      configuredProviders: ["github", "twitch"],
      domainIdentityModel: "maiks-linked-accounts"
    });
    expect(calls).toEqual({
      authHandler: 0,
      database: 0,
      session: 0
    });
  });
});
