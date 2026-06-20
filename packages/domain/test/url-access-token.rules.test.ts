import { describe, expect, it } from "vitest";

import {
  buildUrlAccessTokenDevUrl,
  canManageUrlAccessTokens,
  canUseUrlAccessToken,
  getUrlAccessTokenAdminTargetDefinition,
  getUrlAccessTokenAdminTargetForRecord,
  normalizeUrlAccessTokenLabel,
  type UrlAccessTokenRecord
} from "../src/security/index.js";

const now = new Date("2026-06-09T12:00:00.000Z");

const tokenRecord = (overrides: Partial<UrlAccessTokenRecord> = {}): UrlAccessTokenRecord => ({
  id: "token",
  surface: "control-panel",
  scopes: ["control:open"],
  requiresLogin: true,
  ...overrides
});

describe("canUseUrlAccessToken", () => {
  it("allows an active token for the matching surface and scope", () => {
    expect(canUseUrlAccessToken(tokenRecord(), {
      surface: "control-panel",
      scope: "control:open",
      now
    })).toBe(true);
  });

  it("blocks revoked tokens", () => {
    expect(canUseUrlAccessToken(tokenRecord({ revokedAt: now }), {
      surface: "control-panel",
      scope: "control:open",
      now
    })).toBe(false);
  });

  it("blocks expired tokens", () => {
    expect(canUseUrlAccessToken(tokenRecord({ expiresAt: new Date("2026-06-09T11:59:59.000Z") }), {
      surface: "control-panel",
      scope: "control:open",
      now
    })).toBe(false);
  });

  it("blocks tokens for a different surface", () => {
    expect(canUseUrlAccessToken(tokenRecord(), {
      surface: "overlay",
      scope: "control:open",
      now
    })).toBe(false);
  });

  it("blocks overlay tokens from control-panel access even when the scope name is guessed", () => {
    expect(canUseUrlAccessToken(tokenRecord({
      surface: "overlay",
      scopes: ["overlay:connect"],
      requiresLogin: false
    }), {
      surface: "control-panel",
      scope: "control:open",
      now
    })).toBe(false);
  });

  it("blocks control-panel tokens from overlay access", () => {
    expect(canUseUrlAccessToken(tokenRecord(), {
      surface: "overlay",
      scope: "overlay:connect",
      now
    })).toBe(false);
  });
});

describe("url access token admin helpers", () => {
  it("defines strict first-slice overlay and control-panel targets", () => {
    expect(getUrlAccessTokenAdminTargetDefinition("overlay")).toMatchObject({
      surface: "overlay",
      scope: "overlay:connect",
      requiresLogin: false,
      devBaseUrl: "https://overlay-dev.maiks.yt/"
    });
    expect(getUrlAccessTokenAdminTargetDefinition("control-panel")).toMatchObject({
      surface: "control-panel",
      scope: "control:open",
      requiresLogin: true,
      devBaseUrl: "https://control-dev.maiks.yt/"
    });
  });

  it("maps existing records to supported admin targets without widening scopes", () => {
    expect(getUrlAccessTokenAdminTargetForRecord({
      surface: "overlay",
      scopes: ["overlay:connect"]
    })).toBe("overlay");
    expect(getUrlAccessTokenAdminTargetForRecord({
      surface: "admin",
      scopes: ["control:open"]
    })).toBeNull();
  });

  it("builds dev URLs with the raw token in the accessToken query field", () => {
    expect(buildUrlAccessTokenDevUrl({
      target: "control-panel",
      token: "raw-token"
    })).toBe("https://control-dev.maiks.yt/?accessToken=raw-token");
  });

  it("normalizes labels and allows only token managers", () => {
    expect(normalizeUrlAccessTokenLabel("  OBS   main  ")).toBe("OBS main");
    expect(canManageUrlAccessTokens(["tokens:manage"])).toBe(true);
    expect(canManageUrlAccessTokens(["*"])).toBe(true);
    expect(canManageUrlAccessTokens(["creator-links:manage"])).toBe(false);
  });
});
