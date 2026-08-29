import type { DatabasePool } from "@maiks-yt/database";
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAuthDataCipherFromBase64Key,
  type AuthDataCipher
} from "../../src/auth/auth-sensitive-field-crypto.service.js";
import {
  createProviderProfileOptionRef,
  getProviderProfileOptionRefSecret,
  registerAccountProfileRoutes,
  type AuthSessionSnapshot,
  type ProviderProfileAccount
} from "../../src/account/index.js";

const originalBetterAuthSecret = process.env.BETTER_AUTH_SECRET;
const originalNodeEnv = process.env.NODE_ENV;
const keyV1 = Buffer.from("c".repeat(32), "utf8").toString("base64");

const restoreEnvironment = (): void => {
  if (originalBetterAuthSecret === undefined) {
    delete process.env.BETTER_AUTH_SECRET;
  } else {
    process.env.BETTER_AUTH_SECRET = originalBetterAuthSecret;
  }

  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
};

const authAccount: ProviderProfileAccount = {
  id: "raw-auth-account-row-id",
  accountId: "raw-provider-subject-id",
  providerId: "github",
  accessToken: "provider-access-token"
};

const authSession = (authUserId: string): NonNullable<AuthSessionSnapshot> => ({
  user: {
    id: authUserId,
    email: `${authUserId}@example.test`
  },
  session: {
    id: `session-${authUserId}`,
    userId: authUserId
  }
});

const providerProfileResponse = {
  login: "MaiksProvider",
  email: "provider-owned@example.test",
  avatar_url: "https://avatars.githubusercontent.com/u/123"
};

const createServer = ({
  execute,
  session = authSession("auth-user-1"),
  authDataCipher = null
}: {
  execute: DatabasePool["execute"];
  session?: AuthSessionSnapshot;
  authDataCipher?: AuthDataCipher | null;
}) => {
  const server = Fastify({ logger: false });

  registerAccountProfileRoutes(server, {
    getAuthSession: async () => session,
    getDatabasePool: () => ({
      execute
    }) as unknown as DatabasePool,
    authDataCipher
  });

  return server;
};

afterEach(() => {
  restoreEnvironment();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("account provider profile production refs", () => {
  it("returns provider profile options with opaque refs and no raw account row data", async () => {
    process.env.NODE_ENV = "production";
    process.env.BETTER_AUTH_SECRET = "production-secret";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(providerProfileResponse), {
      headers: { "content-type": "application/json" },
      status: 200
    })));
    const server = createServer({
      execute: (async () => [[{
        ...authAccount,
        scope: "read:user user:email",
        createdAt: "2026-08-28T12:00:00.000Z",
        updatedAt: "2026-08-28T12:05:00.000Z"
      }]]) as DatabasePool["execute"]
    });

    const response = await server.inject({
      method: "GET",
      url: "/account/domain/provider-profile-options"
    });
    const body = response.json();
    const serialized = JSON.stringify(body);

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({
      ok: true,
      options: [{
        providerId: "github",
        displayName: "MaiksProvider",
        email: "provider-owned@example.test",
        imageUrl: "https://avatars.githubusercontent.com/u/123",
        profileOptionRef: expect.stringMatching(/^profile-option:v1:[A-Za-z0-9_-]+$/u)
      }]
    });
    expect(serialized).not.toContain("raw-auth-account-row-id");
    expect(serialized).not.toContain("raw-provider-subject-id");
    expect(serialized).not.toContain("provider-access-token");
    expect(serialized).not.toContain("scope");
    expect(serialized).not.toContain("createdAt");
    expect(serialized).not.toContain("updatedAt");
  });

  it("decrypts encrypted direct SQL account rows before fetching provider profile options", async () => {
    process.env.NODE_ENV = "production";
    process.env.BETTER_AUTH_SECRET = "production-secret";
    const authDataCipher = createAuthDataCipherFromBase64Key(keyV1);
    const encryptedAccount: ProviderProfileAccount = {
      ...authAccount,
      accessToken: authDataCipher.encrypt({
        model: "account",
        field: "accessToken",
        plaintext: authAccount.accessToken ?? ""
      })
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(providerProfileResponse), {
      headers: { "content-type": "application/json" },
      status: 200
    }));
    vi.stubGlobal("fetch", fetchMock);
    const server = createServer({
      execute: (async () => [[encryptedAccount]]) as DatabasePool["execute"],
      authDataCipher
    });

    const response = await server.inject({
      method: "GET",
      url: "/account/domain/provider-profile-options"
    });

    expect(response.statusCode).toBe(200);
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("authorization")).toBe("Bearer provider-access-token");
    expect(JSON.stringify(response.json())).not.toContain(String(encryptedAccount.accessToken));
  });

  it("accepts a valid same-user provider option ref without accepting a raw account id", async () => {
    process.env.NODE_ENV = "production";
    process.env.BETTER_AUTH_SECRET = "production-secret";
    const secret = getProviderProfileOptionRefSecret();
    expect(secret).not.toBeNull();
    const profileOptionRef = createProviderProfileOptionRef({
      account: authAccount,
      authUserId: "auth-user-1",
      secret: secret ?? ""
    });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(providerProfileResponse), {
      headers: { "content-type": "application/json" },
      status: 200
    }));
    vi.stubGlobal("fetch", fetchMock);
    const execute = vi.fn(async (sql: string) => {
      if (sql.includes("FROM auth_accounts")) {
        return [[authAccount]];
      }

      if (sql.includes("auth_user_links")) {
        return [[{
          userId: "domain-user-1",
          displayName: "Current Name",
          profileVisibility: "private",
          avatarUrl: null
        }]];
      }

      if (sql.includes("UPDATE users")) {
        return [{ affectedRows: 1 }];
      }

      throw new Error(`Unexpected query: ${sql}`);
    }) as unknown as DatabasePool["execute"];
    const server = createServer({ execute });

    const response = await server.inject({
      method: "PUT",
      url: "/account/domain/provider-profile",
      payload: {
        profileOptionRef,
        useDisplayName: true,
        useImage: false
      }
    });
    const body = response.json();
    const serialized = JSON.stringify(body);

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({
      ok: true,
      domainUser: {
        displayName: "MaiksProvider",
        profileVisibility: "private",
        avatarUrl: null
      }
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("authorization")).toBe("Bearer provider-access-token");
    expect(serialized).not.toContain("raw-auth-account-row-id");
    expect(serialized).not.toContain("raw-provider-subject-id");
    expect(serialized).not.toContain("provider-access-token");
    expect(serialized).not.toContain("domain-user-1");

    const legacyRawIdResponse = await server.inject({
      method: "PUT",
      url: "/account/domain/provider-profile",
      payload: {
        accountId: "raw-auth-account-row-id",
        useDisplayName: true,
        useImage: false
      }
    });

    expect(legacyRawIdResponse.statusCode).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("decrypts encrypted direct SQL account rows before applying provider profile choices", async () => {
    process.env.NODE_ENV = "production";
    process.env.BETTER_AUTH_SECRET = "production-secret";
    const authDataCipher = createAuthDataCipherFromBase64Key(keyV1);
    const encryptedAccount: ProviderProfileAccount = {
      ...authAccount,
      accessToken: authDataCipher.encrypt({
        model: "account",
        field: "accessToken",
        plaintext: authAccount.accessToken ?? ""
      })
    };
    const secret = getProviderProfileOptionRefSecret();
    expect(secret).not.toBeNull();
    const profileOptionRef = createProviderProfileOptionRef({
      account: authAccount,
      authUserId: "auth-user-1",
      secret: secret ?? ""
    });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(providerProfileResponse), {
      headers: { "content-type": "application/json" },
      status: 200
    }));
    vi.stubGlobal("fetch", fetchMock);
    const execute = vi.fn(async (sql: string) => {
      if (sql.includes("FROM auth_accounts")) {
        return [[encryptedAccount]];
      }

      if (sql.includes("auth_user_links")) {
        return [[{
          userId: "domain-user-1",
          displayName: "Current Name",
          profileVisibility: "private",
          avatarUrl: null
        }]];
      }

      if (sql.includes("UPDATE users")) {
        return [{ affectedRows: 1 }];
      }

      throw new Error(`Unexpected query: ${sql}`);
    }) as unknown as DatabasePool["execute"];
    const server = createServer({ execute, authDataCipher });

    const response = await server.inject({
      method: "PUT",
      url: "/account/domain/provider-profile",
      payload: {
        profileOptionRef,
        useDisplayName: true,
        useImage: false
      }
    });

    expect(response.statusCode).toBe(200);
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("authorization")).toBe("Bearer provider-access-token");
  });

  it("rejects a tampered provider option ref before provider profile fetch", async () => {
    process.env.NODE_ENV = "production";
    process.env.BETTER_AUTH_SECRET = "production-secret";
    const secret = getProviderProfileOptionRefSecret();
    expect(secret).not.toBeNull();
    const validRef = createProviderProfileOptionRef({
      account: authAccount,
      authUserId: "auth-user-1",
      secret: secret ?? ""
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const server = createServer({
      execute: (async () => [[authAccount]]) as DatabasePool["execute"]
    });

    const response = await server.inject({
      method: "PUT",
      url: "/account/domain/provider-profile",
      payload: {
        profileOptionRef: `${validRef.slice(0, -1)}x`,
        useDisplayName: true,
        useImage: false
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      ok: false,
      reason: "provider_profile_not_found"
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects another user's provider option ref while scanning only the signed-in user's accounts", async () => {
    process.env.NODE_ENV = "production";
    process.env.BETTER_AUTH_SECRET = "production-secret";
    const secret = getProviderProfileOptionRefSecret();
    expect(secret).not.toBeNull();
    const otherUserRef = createProviderProfileOptionRef({
      account: authAccount,
      authUserId: "auth-user-1",
      secret: secret ?? ""
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const execute = vi.fn(async (sql: string, params?: readonly unknown[]) => {
      expect(sql).not.toContain("WHERE id = ?");
      expect(params).toEqual(["auth-user-2"]);
      return [[authAccount]];
    }) as unknown as DatabasePool["execute"];
    const server = createServer({
      execute,
      session: authSession("auth-user-2")
    });

    const response = await server.inject({
      method: "PUT",
      url: "/account/domain/provider-profile",
      payload: {
        profileOptionRef: otherUserRef,
        useDisplayName: true,
        useImage: false
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      ok: false,
      reason: "provider_profile_not_found"
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
