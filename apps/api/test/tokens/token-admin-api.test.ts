import type {
  UrlAccessTokenAdminLaunchEnvironment,
  UrlAccessTokenAdminTarget
} from "@maiks-yt/domain/security";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerUrlAccessTokenAdminRoutes } from "../../src/tokens/token-admin.route.js";
import { UrlAccessTokenAdminService } from "../../src/tokens/token-admin.service.js";
import type {
  UrlAccessTokenAdminActor,
  UrlAccessTokenAdminInsertInput,
  UrlAccessTokenAdminListItem,
  UrlAccessTokenAdminRepository
} from "../../src/tokens/token-admin.types.js";

const createToken = (overrides: Partial<UrlAccessTokenAdminListItem> = {}): UrlAccessTokenAdminListItem => ({
  id: "token-1",
  label: "Main OBS overlay",
  target: "overlay",
  surface: "overlay",
  scopes: ["overlay:connect"],
  requiresLogin: false,
  baseUrl: "https://overlay-dev.maiks.yt/",
  expiresAt: null,
  revokedAt: null,
  lastUsedAt: null,
  createdAt: "2026-06-20T10:00:00.000Z",
  updatedAt: "2026-06-20T10:00:00.000Z",
  ...overrides
});

const getBaseUrl = (
  target: UrlAccessTokenAdminTarget,
  environment: UrlAccessTokenAdminLaunchEnvironment
): string => {
  if (target === "overlay") {
    return environment === "production" ? "https://overlay.maiks.yt/" : "https://overlay-dev.maiks.yt/";
  }

  return environment === "production" ? "https://control.maiks.yt/" : "https://control-dev.maiks.yt/";
};

class FakeUrlAccessTokenAdminRepository implements UrlAccessTokenAdminRepository {
  public actor: UrlAccessTokenAdminActor | null = {
    domainUserId: "domain-user",
    rolePermissionValues: [["*"]]
  };
  public readonly tokens = new Map<string, UrlAccessTokenAdminListItem>();
  public lastInsert: UrlAccessTokenAdminInsertInput | null = null;
  public lastRotatedHash: string | null = null;

  public constructor(private readonly launchEnvironment: UrlAccessTokenAdminLaunchEnvironment = "development") {
    this.tokens.set("token-1", createToken({
      baseUrl: getBaseUrl("overlay", this.launchEnvironment)
    }));
    this.tokens.set("control-token", createToken({
      id: "control-token",
      label: "Control tablet",
      target: "control-panel",
      surface: "control-panel",
      scopes: ["control:open"],
      requiresLogin: true,
      baseUrl: getBaseUrl("control-panel", this.launchEnvironment)
    }));
  }

  public async resolveActor(): Promise<UrlAccessTokenAdminActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }

  public async listTokens(): Promise<readonly UrlAccessTokenAdminListItem[]> {
    return [...this.tokens.values()].map((token) => structuredClone(token));
  }

  public async getToken(id: string): Promise<UrlAccessTokenAdminListItem | null> {
    const token = this.tokens.get(id);

    return token ? structuredClone(token) : null;
  }

  public async createToken(input: UrlAccessTokenAdminInsertInput): Promise<UrlAccessTokenAdminListItem> {
    this.lastInsert = structuredClone(input);
    const target: UrlAccessTokenAdminTarget = input.surface === "overlay" ? "overlay" : "control-panel";
    const token = createToken({
      id: "created-token",
      label: input.label,
      target,
      surface: input.surface,
      scopes: [...input.scopes],
      requiresLogin: input.requiresLogin,
      baseUrl: getBaseUrl(target, this.launchEnvironment)
    });
    this.tokens.set(token.id, token);

    return structuredClone(token);
  }

  public async rotateToken(id: string, tokenHash: string) {
    const token = this.tokens.get(id);

    if (!token) {
      return "not-found" as const;
    }

    this.lastRotatedHash = tokenHash;
    const rotatedToken = {
      ...token,
      revokedAt: null,
      lastUsedAt: null,
      updatedAt: "2026-06-20T11:00:00.000Z"
    };
    this.tokens.set(id, rotatedToken);

    return structuredClone(rotatedToken);
  }

  public async revokeToken(id: string) {
    const token = this.tokens.get(id);

    if (!token) {
      return "not-found" as const;
    }

    const revokedToken = {
      ...token,
      revokedAt: "2026-06-20T11:00:00.000Z"
    };
    this.tokens.set(id, revokedToken);

    return structuredClone(revokedToken);
  }
}

describe("UrlAccessTokenAdminService", () => {
  it("lists tokens without exposing hashes", async () => {
    const repository = new FakeUrlAccessTokenAdminRepository();
    const service = new UrlAccessTokenAdminService(repository);

    const result = await service.listTokens({ authUserId: "auth-user" });

    expect(result).toMatchObject({
      ok: true,
      tokens: [
        {
          id: "token-1",
          surface: "overlay",
          scopes: ["overlay:connect"]
        },
        {
          id: "control-token",
          surface: "control-panel",
          scopes: ["control:open"]
        }
      ]
    });
    expect(JSON.stringify(result)).not.toContain("tokenHash");
  });

  it("creates overlay and control-panel tokens with strict surfaces and scopes", async () => {
    const repository = new FakeUrlAccessTokenAdminRepository("production");
    const service = new UrlAccessTokenAdminService(repository, {
      launchEnvironment: "production"
    });

    const overlayResult = await service.createToken({
      authUserId: "auth-user",
      target: "overlay",
      label: " Main OBS "
    });

    expect(overlayResult).toMatchObject({
      ok: true,
      token: {
        label: "Main OBS",
        surface: "overlay",
        scopes: ["overlay:connect"],
        requiresLogin: false,
        baseUrl: "https://overlay.maiks.yt/",
        launchUrl: expect.stringMatching(/^https:\/\/overlay\.maiks\.yt\/\?accessToken=/)
      }
    });
    expect(repository.lastInsert).toMatchObject({
      label: "Main OBS",
      surface: "overlay",
      scopes: ["overlay:connect"],
      requiresLogin: false
    });
    expect(repository.lastInsert?.tokenHash).toHaveLength(64);

    const controlResult = await service.createToken({
      authUserId: "auth-user",
      target: "control-panel",
      label: "Control tablet"
    });
    expect(controlResult).toMatchObject({
      ok: true,
      token: {
        baseUrl: "https://control.maiks.yt/",
        launchUrl: expect.stringMatching(/^https:\/\/control\.maiks\.yt\/\?accessToken=/)
      }
    });
    expect(repository.lastInsert).toMatchObject({
      surface: "control-panel",
      scopes: ["control:open"],
      requiresLogin: true
    });
  });

  it("keeps dev launch URLs when the public API host is dev under a production Node process", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousApiPublicBaseUrl = process.env.API_PUBLIC_BASE_URL;
    process.env.NODE_ENV = "production";
    process.env.API_PUBLIC_BASE_URL = "https://api-dev.maiks.yt";

    try {
      const repository = new FakeUrlAccessTokenAdminRepository("development");
      const service = new UrlAccessTokenAdminService(repository);
      const result = await service.createToken({
        authUserId: "auth-user",
        target: "overlay",
        label: "OBS"
      });

      expect(result).toMatchObject({
        ok: true,
        token: {
          baseUrl: "https://overlay-dev.maiks.yt/",
          launchUrl: expect.stringMatching(/^https:\/\/overlay-dev\.maiks\.yt\/\?accessToken=/)
        }
      });
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }

      if (previousApiPublicBaseUrl === undefined) {
        delete process.env.API_PUBLIC_BASE_URL;
      } else {
        process.env.API_PUBLIC_BASE_URL = previousApiPublicBaseUrl;
      }
    }
  });

  it("rotates with a one-time raw URL and revokes lost tokens", async () => {
    const repository = new FakeUrlAccessTokenAdminRepository("development");
    const service = new UrlAccessTokenAdminService(repository, {
      launchEnvironment: "development"
    });

    const rotateResult = await service.rotateToken({
      authUserId: "auth-user",
      id: "control-token"
    });

    expect(rotateResult).toMatchObject({
      ok: true,
      token: {
        id: "control-token",
        rawToken: expect.any(String),
        baseUrl: "https://control-dev.maiks.yt/",
        launchUrl: expect.stringMatching(/^https:\/\/control-dev\.maiks\.yt\/\?accessToken=/)
      }
    });
    expect(repository.lastRotatedHash).toHaveLength(64);

    await expect(service.revokeToken({
      authUserId: "auth-user",
      id: "control-token"
    })).resolves.toMatchObject({
      ok: true,
      token: {
        revokedAt: "2026-06-20T11:00:00.000Z"
      }
    });
  });

  it("denies unlinked and non-token admins", async () => {
    const repository = new FakeUrlAccessTokenAdminRepository();
    const service = new UrlAccessTokenAdminService(repository);

    repository.actor = null;
    await expect(service.listTokens({ authUserId: "auth-user" })).resolves.toEqual({
      ok: false,
      reason: "url_token_admin_user_unlinked"
    });

    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [["creator-links:manage"]]
    };
    await expect(service.createToken({
      authUserId: "auth-user",
      target: "overlay",
      label: "OBS"
    })).resolves.toEqual({
      ok: false,
      reason: "url_token_admin_forbidden"
    });
  });
});

describe("URL access token admin route boundary", () => {
  it("requires an auth session before listing tokens", async () => {
    const server = Fastify();
    registerUrlAccessTokenAdminRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/tokens"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });

  it("returns a raw token only from create and rotate responses", async () => {
    const repository = new FakeUrlAccessTokenAdminRepository("production");
    const server = Fastify();
    registerUrlAccessTokenAdminRoutes(server, {
      launchEnvironment: "production",
      getAuthSession: async () => ({
        user: {
          id: "auth-user"
        }
      }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new UrlAccessTokenAdminService(repository, {
        launchEnvironment: "production"
      })
    });

    const listResponse = await server.inject({
      method: "GET",
      url: "/admin/tokens"
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).not.toHaveProperty("rawToken");
    expect(JSON.stringify(listResponse.json())).not.toContain("rawToken");
    expect(JSON.stringify(listResponse.json())).not.toContain("tokenHash");

    const createResponse = await server.inject({
      method: "POST",
      url: "/admin/tokens",
      payload: {
        target: "overlay",
        label: "OBS"
      }
    });

    expect(createResponse.statusCode).toBe(200);
    expect(createResponse.json()).toMatchObject({
      ok: true,
      token: {
        rawToken: expect.any(String),
        baseUrl: "https://overlay.maiks.yt/",
        launchUrl: expect.stringMatching(/^https:\/\/overlay\.maiks\.yt\/\?accessToken=/)
      }
    });
    expect(createResponse.json().token).not.toHaveProperty("devUrl");

    const rotateResponse = await server.inject({
      method: "POST",
      url: "/admin/tokens/token-1/rotate"
    });

    expect(rotateResponse.statusCode).toBe(200);
    expect(rotateResponse.json()).toMatchObject({
      ok: true,
      token: {
        rawToken: expect.any(String)
      }
    });
  });
});
