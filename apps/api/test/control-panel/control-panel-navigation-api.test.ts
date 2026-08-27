import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { registerControlPanelNavigationRoutes } from "../../src/control-panel/index.js";
import type { RequireUrlAccessTokenForRequest } from "../../src/url-access-token-request-access.service.js";

const validAccessToken = "test-control-access-token-123456";

const createSuccessfulAccessResult = (): Awaited<ReturnType<RequireUrlAccessTokenForRequest>> => ({
  ok: true,
  requiresLogin: true,
  session: { user: { id: "auth-owner" }, session: { userId: "auth-owner" } },
  user: {
    id: "owner-user",
    displayName: "Owner",
    profileVisibility: "private",
    avatarUrl: null
  }
});

const createTokenOnlyAccessResult = (): Awaited<ReturnType<RequireUrlAccessTokenForRequest>> => ({
  ok: true,
  requiresLogin: false,
  session: null,
  user: null
});

const servers: ReturnType<typeof Fastify>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

const createServer = async (
  requireUrlAccessTokenForRequest: RequireUrlAccessTokenForRequest,
  rolePermissionValues: readonly unknown[] = [["*"]]
) => {
  const server = Fastify();
  const databasePool = {
    execute: vi.fn(async () => [
      rolePermissionValues.map((permissions) => ({ permissions }))
    ])
  };

  registerControlPanelNavigationRoutes(server, {
    getDatabasePool: () => databasePool as never,
    requireUrlAccessTokenForRequest
  });
  await server.ready();
  servers.push(server);

  return { databasePool, server };
};

describe("control panel navigation API", () => {
  it("requires a well-formed control access token", async () => {
    const requireUrlAccessTokenForRequest = vi.fn(async () => createSuccessfulAccessResult());
    const { databasePool, server } = await createServer(requireUrlAccessTokenForRequest);

    const response = await server.inject({
      method: "GET",
      url: "/control/navigation"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      ok: false,
      reason: "control_navigation_request_invalid"
    });
    expect(requireUrlAccessTokenForRequest).not.toHaveBeenCalled();
    expect(databasePool.execute).not.toHaveBeenCalled();
  });

  it("preserves the Control URL-token and signed-in-user boundary", async () => {
    const requireUrlAccessTokenForRequest = vi.fn(async () => ({
      ok: false as const,
      statusCode: 401 as const,
      reason: "not_authenticated"
    }));
    const { databasePool, server } = await createServer(requireUrlAccessTokenForRequest);

    const response = await server.inject({
      method: "GET",
      url: `/control/navigation?accessToken=${validAccessToken}`
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
    expect(requireUrlAccessTokenForRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        surface: "control-panel",
        scope: "control:open",
        token: validAccessToken
      })
    );
    expect(databasePool.execute).not.toHaveBeenCalled();
  });

  it("rejects a token-only result before reading role permissions", async () => {
    const { databasePool, server } = await createServer(async () => createTokenOnlyAccessResult());

    const response = await server.inject({
      method: "GET",
      url: `/control/navigation?accessToken=${validAccessToken}`
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
    expect(databasePool.execute).not.toHaveBeenCalled();
  });

  it("returns every current Control page for the owner wildcard", async () => {
    const { server } = await createServer(async () => createSuccessfulAccessResult());

    const response = await server.inject({
      method: "GET",
      url: `/control/navigation?accessToken=${validAccessToken}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      pages: ["overview", "stream", "overlays", "actions", "music", "providers"]
    });
  });

  it("only adds optional pages backed by the signed-in user's active rights", async () => {
    const { databasePool, server } = await createServer(
      async () => createSuccessfulAccessResult(),
      [
        JSON.stringify(["music:play-control"]),
        ["action-panel:view", "chat:view"]
      ]
    );

    const response = await server.inject({
      method: "GET",
      url: `/control/navigation?accessToken=${validAccessToken}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      pages: ["overview", "stream", "overlays", "actions", "music", "providers"]
    });
    const permissionSql = String(databasePool.execute.mock.calls[0]?.[0] ?? "");
    expect(permissionSql).toContain("user_roles.revoked_at IS NULL");
    expect(permissionSql).toContain("user_roles.expires_at IS NULL OR user_roles.expires_at > NOW()");
  });

  it("returns a sanitized unavailable result when permission loading fails", async () => {
    const { databasePool, server } = await createServer(async () => createSuccessfulAccessResult());
    databasePool.execute.mockRejectedValueOnce(new Error("database host and credential must stay private"));

    const response = await server.inject({
      method: "GET",
      url: `/control/navigation?accessToken=${validAccessToken}`
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ok: false,
      reason: "control_navigation_unavailable"
    });
    expect(response.body).not.toContain("database host");
    expect(response.body).not.toContain("credential");
  });
});
