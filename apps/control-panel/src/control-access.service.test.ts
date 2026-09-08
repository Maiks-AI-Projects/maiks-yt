import type { UrlAccessGateState } from "@maiks-yt/ui";
import { describe, expect, it, vi } from "vitest";

import { validateControlPanelAccess } from "./control-access.service.js";

const emptyHeaders = (): HeadersInit => ({});

const allowedGate = (requiresLogin = true): UrlAccessGateState => ({
  requiresLogin,
  status: "allowed"
});

describe("validateControlPanelAccess", () => {
  it("renders a neutral reconnecting state for transient URL-token validation throttles", async () => {
    await expect(validateControlPanelAccess({
      apiBaseUrl: "https://api-dev.maiks.yt",
      createHeaders: emptyHeaders,
      validateGate: vi.fn(async () => ({
        message: "Access check temporarily unavailable (429).",
        status: "transient-error"
      } satisfies UrlAccessGateState))
    })).resolves.toEqual({
      message: "Access check temporarily unavailable (429).",
      retryAfterMs: 5_000,
      status: "reconnecting"
    });
  });

  it("renders a neutral reconnecting state for transient session refresh failures", async () => {
    await expect(validateControlPanelAccess({
      apiBaseUrl: "https://api-dev.maiks.yt",
      createHeaders: emptyHeaders,
      fetchSession: vi.fn(async () => new Response(JSON.stringify({
        ok: false,
        reason: "rate_limited"
      }), {
        status: 429
      })),
      validateGate: vi.fn(async () => allowedGate())
    })).resolves.toEqual({
      message: "Session refresh temporarily unavailable (429).",
      retryAfterMs: 5_000,
      status: "reconnecting"
    });
  });

  it("keeps genuine unauthenticated sessions fail-closed", async () => {
    await expect(validateControlPanelAccess({
      apiBaseUrl: "https://api-dev.maiks.yt",
      createHeaders: emptyHeaders,
      fetchSession: vi.fn(async () => new Response(null, {
        status: 401
      })),
      validateGate: vi.fn(async () => allowedGate())
    })).resolves.toEqual({
      message: "Sign in on the main site before opening the control panel.",
      status: "blocked"
    });
  });

  it("keeps null sessions fail-closed", async () => {
    await expect(validateControlPanelAccess({
      apiBaseUrl: "https://api-dev.maiks.yt",
      createHeaders: emptyHeaders,
      fetchSession: vi.fn(async () => new Response("null", {
        status: 200
      })),
      validateGate: vi.fn(async () => allowedGate())
    })).resolves.toEqual({
      message: "Sign in on the main site before opening the control panel.",
      status: "blocked"
    });
  });

  it("allows verified sessions and uses the session display name only after verification", async () => {
    await expect(validateControlPanelAccess({
      apiBaseUrl: "https://api-dev.maiks.yt",
      createHeaders: emptyHeaders,
      fetchSession: vi.fn(async () => new Response(JSON.stringify({
        user: {
          email: "owner@example.test",
          name: "Michael"
        }
      }), {
        status: 200
      })),
      validateGate: vi.fn(async () => allowedGate())
    })).resolves.toEqual({
      displayName: "Michael",
      status: "allowed"
    });
  });
});
