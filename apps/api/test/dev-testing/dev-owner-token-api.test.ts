import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { registerDevOwnerTokenRoutes } from "../../src/dev-testing/dev-owner-token.route.js";
import { DevOwnerTokenService } from "../../src/dev-testing/dev-owner-token.service.js";
import type {
  DevOwnerTokenInsertInput,
  DevOwnerTokenOwner,
  DevOwnerTokenRepository
} from "../../src/dev-testing/dev-owner-token.types.js";
import { hashToken } from "../../src/security/token-hash.service.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalMintSecret = process.env.DEV_OWNER_TOKEN_MINT_SECRET;
const originalLegacyMintSecret = process.env.DEV_TEST_AUTH_MINT_SECRET;
const originalNotificationSecret = process.env.DEV_NOTIFICATION_POST_SECRET;

class FakeDevOwnerTokenRepository implements DevOwnerTokenRepository {
  public owner: DevOwnerTokenOwner | null = {
    authUserId: "auth-owner",
    domainUserId: "domain-owner"
  };
  public inserts: DevOwnerTokenInsertInput[] = [];

  public async findOwnerAuthUser(): Promise<DevOwnerTokenOwner | null> {
    return this.owner;
  }

  public async insertToken(input: DevOwnerTokenInsertInput): Promise<void> {
    this.inserts.push(input);
  }
}

const resetEnv = (): void => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  if (originalMintSecret === undefined) {
    delete process.env.DEV_OWNER_TOKEN_MINT_SECRET;
  } else {
    process.env.DEV_OWNER_TOKEN_MINT_SECRET = originalMintSecret;
  }

  if (originalLegacyMintSecret === undefined) {
    delete process.env.DEV_TEST_AUTH_MINT_SECRET;
  } else {
    process.env.DEV_TEST_AUTH_MINT_SECRET = originalLegacyMintSecret;
  }

  if (originalNotificationSecret === undefined) {
    delete process.env.DEV_NOTIFICATION_POST_SECRET;
  } else {
    process.env.DEV_NOTIFICATION_POST_SECRET = originalNotificationSecret;
  }
};

afterEach(() => {
  resetEnv();
});

describe("DevOwnerTokenService", () => {
  it("mints a short-lived owner dev auth token without storing the raw token", async () => {
    const repository = new FakeDevOwnerTokenRepository();
    const service = new DevOwnerTokenService(repository, {
      env: {
        NODE_ENV: "development",
        DEV_OWNER_TOKEN_MINT_SECRET: "mint-secret"
      },
      now: () => new Date("2026-07-04T10:00:00.000Z"),
      webBaseUrl: "https://web-dev.maiks.yt"
    });

    const result = await service.mint({
      label: " Codex smoke ",
      path: "/admin/provider-integrations",
      ttlMinutes: 5
    });

    expect(result).toMatchObject({
      ok: true,
      expiresAt: "2026-07-04T10:05:00.000Z",
      loginUrl: expect.stringMatching(/^https:\/\/web-dev\.maiks\.yt\/admin\/provider-integrations\?devAuthToken=/),
      token: expect.any(String)
    });
    expect(repository.inserts).toHaveLength(1);
    expect(repository.inserts[0]).toMatchObject({
      authUserId: "auth-owner",
      label: "Codex smoke",
      tokenHash: hashToken(result.ok ? result.token : "")
    });
    expect(repository.inserts[0]?.tokenHash).not.toBe(result.ok ? result.token : "");
  });

  it("rejects production, invalid TTLs, and missing owner users", async () => {
    const repository = new FakeDevOwnerTokenRepository();

    await expect(new DevOwnerTokenService(repository, {
      env: {
        NODE_ENV: "production",
        DEV_OWNER_TOKEN_MINT_SECRET: "mint-secret"
      }
    }).mint()).resolves.toEqual({
      ok: false,
      reason: "dev_owner_token_disabled"
    });

    await expect(new DevOwnerTokenService(repository, {
      env: {
        NODE_ENV: "development",
        DEV_OWNER_TOKEN_MINT_SECRET: "mint-secret"
      }
    }).mint({ ttlMinutes: 60 })).resolves.toEqual({
      ok: false,
      reason: "dev_owner_token_invalid_input"
    });

    repository.owner = null;
    await expect(new DevOwnerTokenService(repository, {
      env: {
        NODE_ENV: "development",
        DEV_OWNER_TOKEN_MINT_SECRET: "mint-secret"
      }
    }).mint()).resolves.toEqual({
      ok: false,
      reason: "dev_owner_token_owner_missing"
    });
  });
});

describe("dev owner token route", () => {
  it("requires the mint secret before touching the service", async () => {
    process.env.NODE_ENV = "development";
    process.env.DEV_OWNER_TOKEN_MINT_SECRET = "mint-secret";
    delete process.env.DEV_TEST_AUTH_MINT_SECRET;
    delete process.env.DEV_NOTIFICATION_POST_SECRET;

    const server = Fastify();

    registerDevOwnerTokenRoutes(server, {
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => {
        throw new Error("service should not be used");
      }
    });

    const response = await server.inject({
      method: "POST",
      url: "/dev/testing/owner-token",
      payload: {}
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      ok: false,
      reason: "dev_owner_token_forbidden"
    });
  });

  it("returns a one-time visible login URL for valid dev requests", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.DEV_OWNER_TOKEN_MINT_SECRET;
    delete process.env.DEV_TEST_AUTH_MINT_SECRET;
    process.env.DEV_NOTIFICATION_POST_SECRET = "fallback-secret";

    const server = Fastify();

    registerDevOwnerTokenRoutes(server, {
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => ({
        mint: async () => ({
          ok: true,
          token: "raw-dev-token",
          expiresAt: "2026-07-04T10:10:00.000Z",
          loginUrl: "https://web-dev.maiks.yt/admin/provider-integrations?devAuthToken=raw-dev-token"
        })
      })
    });

    const response = await server.inject({
      method: "POST",
      url: "/dev/testing/owner-token",
      headers: {
        authorization: "Bearer fallback-secret"
      },
      payload: {
        path: "/admin/provider-integrations",
        ttlMinutes: 10
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      token: "raw-dev-token",
      expiresAt: "2026-07-04T10:10:00.000Z",
      loginUrl: "https://web-dev.maiks.yt/admin/provider-integrations?devAuthToken=raw-dev-token"
    });
  });

  it("is unavailable in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.DEV_OWNER_TOKEN_MINT_SECRET = "mint-secret";

    const server = Fastify();

    registerDevOwnerTokenRoutes(server, {
      getDatabasePool: () => {
        throw new Error("database should not be used");
      }
    });

    expect(server.hasRoute({ method: "POST", url: "/dev/testing/owner-token" })).toBe(false);

    const response = await server.inject({
      method: "POST",
      url: "/dev/testing/owner-token",
      headers: {
        "x-dev-testing-secret": "mint-secret"
      },
      payload: {}
    });

    expect(response.statusCode).toBe(404);
  });
});
