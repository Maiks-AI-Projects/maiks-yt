import { describe, expect, it } from "vitest";

import { canUseUrlAccessToken, type UrlAccessTokenRecord } from "../src/security/index.js";

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
});
