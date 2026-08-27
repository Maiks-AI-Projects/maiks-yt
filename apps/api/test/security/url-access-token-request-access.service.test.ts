import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";

import { createRequireUrlAccessTokenForRequest } from "../../src/url-access-token-request-access.service.js";

const request = {} as FastifyRequest;

const createPool = (linked = true): DatabasePool => ({
  execute: vi.fn(async () => [
    linked
      ? [{
        userId: "owner-user",
        displayName: "Owner",
        profileVisibility: "private",
        avatarUrl: null
      }]
      : [],
    []
  ])
}) as unknown as DatabasePool;

describe("request-aware URL access token gate", () => {
  it("rejects a valid control token that requires login when no session is present", async () => {
    const requireAccess = createRequireUrlAccessTokenForRequest({
      getAuthSession: async () => null,
      getDatabasePool: () => createPool(),
      validateUrlAccessToken: async () => ({ valid: true, requiresLogin: true })
    });

    await expect(requireAccess(request, {
      deniedReason: "control_panel_access_denied",
      scope: "control:open",
      surface: "control-panel",
      token: "a".repeat(32),
      userUnlinkedReason: "control_panel_user_unlinked"
    })).resolves.toEqual({
      ok: false,
      statusCode: 401,
      reason: "not_authenticated"
    });
  });

  it("allows a valid control token when its required session is linked to a domain user", async () => {
    const pool = createPool();
    const requireAccess = createRequireUrlAccessTokenForRequest({
      getAuthSession: async () => ({ user: { id: "auth-owner" }, session: { userId: "auth-owner" } }),
      getDatabasePool: () => pool,
      validateUrlAccessToken: async () => ({ valid: true, requiresLogin: true })
    });

    await expect(requireAccess(request, {
      deniedReason: "control_panel_access_denied",
      scope: "control:open",
      surface: "control-panel",
      token: "a".repeat(32),
      userUnlinkedReason: "control_panel_user_unlinked"
    })).resolves.toMatchObject({
      ok: true,
      requiresLogin: true,
      user: {
        id: "owner-user"
      }
    });
    expect(pool.execute).toHaveBeenCalledWith(
      expect.stringContaining("auth_user_links.auth_user_id"),
      ["auth-owner"]
    );
  });

  it("preserves token-only behavior for valid overlay tokens that do not require login", async () => {
    const getAuthSession = vi.fn(async () => null);
    const getDatabasePool = vi.fn(() => createPool());
    const requireAccess = createRequireUrlAccessTokenForRequest({
      getAuthSession,
      getDatabasePool,
      validateUrlAccessToken: async () => ({ valid: true, requiresLogin: false })
    });

    await expect(requireAccess(request, {
      deniedReason: "overlay_access_denied",
      scope: "overlay:connect",
      surface: "overlay",
      token: "a".repeat(32)
    })).resolves.toEqual({
      ok: true,
      requiresLogin: false,
      session: null,
      user: null
    });
    expect(getAuthSession).not.toHaveBeenCalled();
    expect(getDatabasePool).not.toHaveBeenCalled();
  });

  it("rejects a token that does not match the requested surface or scope before session work", async () => {
    const getAuthSession = vi.fn(async () => ({ user: { id: "auth-owner" }, session: { userId: "auth-owner" } }));
    const requireAccess = createRequireUrlAccessTokenForRequest({
      getAuthSession,
      getDatabasePool: () => createPool(),
      validateUrlAccessToken: async () => ({
        valid: false,
        requiresLogin: true,
        reason: "token_not_valid_for_scope"
      })
    });

    await expect(requireAccess(request, {
      deniedReason: "control_panel_access_denied",
      scope: "control:open",
      surface: "control-panel",
      token: "a".repeat(32)
    })).resolves.toEqual({
      ok: false,
      statusCode: 403,
      reason: "token_not_valid_for_scope"
    });
    expect(getAuthSession).not.toHaveBeenCalled();
  });
});
