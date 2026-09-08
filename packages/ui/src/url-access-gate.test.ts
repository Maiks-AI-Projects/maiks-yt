import { describe, expect, it, vi } from "vitest";

import { validateUrlAccessGate } from "./url-access-gate.js";

const installWindow = (href = "https://control-dev.maiks.yt/control?accessToken=test-control-access-token-000000"): void => {
  const store = new Map<string, string>();

  vi.stubGlobal("window", {
    history: {
      replaceState: vi.fn()
    },
    location: {
      href
    },
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      removeItem: (key: string) => {
        store.delete(key);
      },
      setItem: (key: string, value: string) => {
        store.set(key, value);
      }
    }
  });
};

describe("validateUrlAccessGate", () => {
  it("keeps transient validation throttles out of hard denied state", async () => {
    installWindow();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: false,
      reason: "rate_limited"
    }), {
      status: 429
    })));

    await expect(validateUrlAccessGate({
      apiBaseUrl: "https://api-dev.maiks.yt",
      scope: "control:open",
      storageKey: "maiks.yt.control.accessToken",
      surface: "control-panel"
    })).resolves.toEqual({
      message: "Access check temporarily unavailable (429).",
      status: "transient-error"
    });
  });

  it("still treats explicit invalid tokens as denied", async () => {
    installWindow();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      reason: "token_not_valid_for_scope",
      valid: false
    }), {
      status: 200
    })));

    await expect(validateUrlAccessGate({
      apiBaseUrl: "https://api-dev.maiks.yt",
      scope: "control:open",
      storageKey: "maiks.yt.control.accessToken",
      surface: "control-panel"
    })).resolves.toEqual({
      message: "token_not_valid_for_scope",
      status: "denied"
    });
  });

  it.each([401, 403])("fails closed when validation returns HTTP %i", async (status) => {
    installWindow();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: false,
      reason: "access_denied"
    }), {
      status
    })));

    await expect(validateUrlAccessGate({
      apiBaseUrl: "https://api-dev.maiks.yt",
      scope: "control:open",
      storageKey: "maiks.yt.control.accessToken",
      surface: "control-panel"
    })).resolves.toEqual({
      message: "Access token was not accepted.",
      status: "denied"
    });
  });

  it("still requires a launch token when none is stored or present in the URL", async () => {
    installWindow("https://control-dev.maiks.yt/control");

    await expect(validateUrlAccessGate({
      apiBaseUrl: "https://api-dev.maiks.yt",
      scope: "control:open",
      storageKey: "maiks.yt.control.accessToken",
      surface: "control-panel"
    })).resolves.toEqual({
      message: "Access token required.",
      status: "missing-token"
    });
  });
});
