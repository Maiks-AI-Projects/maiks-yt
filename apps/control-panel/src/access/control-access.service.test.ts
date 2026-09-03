import { validateUrlAccessGate } from "@maiks-yt/ui";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "../dev-auth-token.js";

import {
  getControlAccessRetryDelay,
  refreshControlSessionCookie,
  resetControlAccessSessionRefreshStateForTest,
  validateControlPanelAccess
} from "./control-access.service.js";

vi.mock("@maiks-yt/ui", () => ({
  validateUrlAccessGate: vi.fn()
}));

vi.mock("../dev-auth-token.js", () => ({
  apiFetch: vi.fn()
}));

const validateUrlAccessGateMock = vi.mocked(validateUrlAccessGate);
const apiFetchMock = vi.mocked(apiFetch);

const jsonResponse = (body: unknown): Response => new Response(JSON.stringify(body), {
  headers: {
    "Content-Type": "application/json"
  },
  status: 200
});

const deferredResponse = (): {
  readonly promise: Promise<Response>;
  readonly resolve: (response: Response) => void;
} => {
  let resolveResponse!: (response: Response) => void;
  const promise = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });

  return {
    promise,
    resolve: resolveResponse
  };
};

beforeEach(() => {
  vi.resetAllMocks();
  resetControlAccessSessionRefreshStateForTest();
  vi.restoreAllMocks();
  validateUrlAccessGateMock.mockResolvedValue({
    status: "allowed",
    requiresLogin: true
  });
});

describe("control access recovery", () => {
  it("caps transient retry delay at thirty seconds", () => {
    expect(getControlAccessRetryDelay(0)).toBe(2_000);
    expect(getControlAccessRetryDelay(2)).toBe(10_000);
    expect(getControlAccessRetryDelay(99)).toBe(30_000);
  });

  it("backs off after transient session refresh failures instead of retrying immediately", async () => {
    let nowMs = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => nowMs);
    apiFetchMock.mockResolvedValueOnce(new Response("Too many requests", { status: 429 }));

    await expect(refreshControlSessionCookie("https://api.example.test")).resolves.toEqual({
      ok: false,
      kind: "unavailable",
      message: "Session refresh failed with 429."
    });
    await expect(refreshControlSessionCookie("https://api.example.test")).resolves.toEqual({
      ok: false,
      kind: "unavailable",
      message: "Session refresh failed with 429."
    });
    expect(apiFetchMock).toHaveBeenCalledTimes(1);

    nowMs += getControlAccessRetryDelay(0) + 1;
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      session: { id: "rotated-session" },
      user: { id: "auth-owner" }
    }));

    await expect(refreshControlSessionCookie("https://api.example.test")).resolves.toEqual({ ok: true });
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });

  it("requires three consecutive null session responses before confirming sign-in loss", async () => {
    let nowMs = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => nowMs);
    apiFetchMock.mockImplementation(async () => jsonResponse(null));

    await expect(refreshControlSessionCookie("https://api.example.test")).resolves.toEqual({
      ok: false,
      kind: "unavailable",
      message: "Checking whether the account session is still valid."
    });

    nowMs += getControlAccessRetryDelay(0) + 1;
    await expect(refreshControlSessionCookie("https://api.example.test")).resolves.toEqual({
      ok: false,
      kind: "unavailable",
      message: "Checking whether the account session is still valid."
    });

    nowMs += getControlAccessRetryDelay(1) + 1;
    await expect(refreshControlSessionCookie("https://api.example.test")).resolves.toEqual({
      ok: false,
      kind: "login-required",
      message: "Your sign-in needs to be renewed."
    });
    expect(apiFetchMock).toHaveBeenCalledTimes(3);
  });

  it("recovers after a transient null session without confirming sign-in loss", async () => {
    let nowMs = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => nowMs);
    apiFetchMock
      .mockResolvedValueOnce(jsonResponse(null))
      .mockResolvedValueOnce(jsonResponse({
        session: { id: "session-1" },
        user: { id: "auth-owner" }
      }));

    await expect(refreshControlSessionCookie("https://api.example.test")).resolves.toMatchObject({
      ok: false,
      kind: "unavailable"
    });
    nowMs += getControlAccessRetryDelay(0) + 1;
    await expect(refreshControlSessionCookie("https://api.example.test")).resolves.toEqual({ ok: true });
  });
});

describe("login-required control access", () => {
  it("coalesces overlapping Better Auth cookie refreshes before reading the safe session projection", async () => {
    const refreshRequest = deferredResponse();

    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/auth/get-session")) {
        return await refreshRequest.promise;
      }

      return jsonResponse({
        ok: true,
        signedIn: true,
        currentUser: {
          name: "Michael",
          email: "owner@example.test",
          imageUrl: null
        }
      });
    });

    const firstAccessCheck = validateControlPanelAccess("https://api.example.test");
    const secondAccessCheck = validateControlPanelAccess("https://api.example.test");

    await Promise.resolve();
    await Promise.resolve();

    expect(apiFetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/get-session"))).toHaveLength(1);

    refreshRequest.resolve(jsonResponse({
      session: { id: "session-1" },
      user: { id: "auth-owner" }
    }));

    await expect(firstAccessCheck).resolves.toEqual({
      status: "allowed",
      displayName: "Michael"
    });
    await expect(secondAccessCheck).resolves.toEqual({
      status: "allowed",
      displayName: "Michael"
    });
  });

  it("allows a valid token with the minimal signed-in session projection", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      session: {
        id: "session-1",
        userId: "auth-owner"
      },
      user: {
        id: "auth-owner"
      }
    }));
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      signedIn: true,
      currentUser: {
        name: "Michael",
        email: "owner@example.test",
        imageUrl: "https://avatar.example.test/michael.png"
      }
    }));

    await expect(validateControlPanelAccess("https://api.example.test")).resolves.toEqual({
      status: "allowed",
      displayName: "Michael"
    });
    expect(validateUrlAccessGateMock).toHaveBeenCalledWith({
      apiBaseUrl: "https://api.example.test",
      surface: "control-panel",
      scope: "control:open",
      storageKey: "maiks.yt.control.accessToken"
    });
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, "https://api.example.test/auth/get-session", {
      cache: "no-store"
    });
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, "https://api.example.test/account/session");
  });

  it("preserves the email and generic display-name fallbacks", async () => {
    apiFetchMock
      .mockResolvedValueOnce(jsonResponse({
        session: { id: "session-1" },
        user: { id: "auth-owner" }
      }))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        signedIn: true,
        currentUser: {
          name: null,
          email: "owner@example.test",
          imageUrl: null
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        session: { id: "session-1" },
        user: { id: "auth-owner" }
      }))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        signedIn: true,
        currentUser: {
          name: null,
          email: null,
          imageUrl: null
        }
      }));

    await expect(validateControlPanelAccess("https://api.example.test")).resolves.toEqual({
      status: "allowed",
      displayName: "owner@example.test"
    });
    await expect(validateControlPanelAccess("https://api.example.test")).resolves.toEqual({
      status: "allowed",
      displayName: "Signed-in user"
    });
  });

  it("retries a null projection after a valid refresh instead of projecting permanent auth loss", async () => {
    apiFetchMock
      .mockResolvedValueOnce(jsonResponse({
        session: { id: "session-1" },
        user: { id: "auth-owner" }
      }))
      .mockResolvedValueOnce(jsonResponse(null));

    await expect(validateControlPanelAccess("https://api.example.test")).resolves.toEqual({
      status: "blocked",
      kind: "unavailable",
      message: "The account session changed while it was being checked.",
      preserveOperationalShell: true
    });
  });

  it("refreshes the Better Auth cookie through the auth endpoint before reading the safe session projection", async () => {
    apiFetchMock
      .mockResolvedValueOnce(jsonResponse({
        session: { id: "session-1" },
        user: { id: "auth-owner" }
      }))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        signedIn: true,
        currentUser: {
          name: "Michael",
          email: "owner@example.test",
          imageUrl: null
        }
      }));

    await validateControlPanelAccess("https://api.example.test");

    expect(apiFetchMock).toHaveBeenNthCalledWith(1, "https://api.example.test/auth/get-session", {
      cache: "no-store"
    });
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, "https://api.example.test/account/session");
  });

  it("fails closed before private data reads when session refresh is rejected", async () => {
    apiFetchMock.mockResolvedValue(new Response("null", { status: 401 }));

    await expect(validateControlPanelAccess("https://api.example.test")).resolves.toEqual({
      status: "blocked",
      kind: "login-required",
      message: "Your sign-in needs to be renewed."
    });
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith("https://api.example.test/auth/get-session", {
      cache: "no-store"
    });
  });

  it("marks transient refresh failures as safe to retry without evicting an already allowed shell", async () => {
    apiFetchMock.mockResolvedValueOnce(new Response("Too many requests", { status: 429 }));

    await expect(validateControlPanelAccess("https://api.example.test")).resolves.toEqual({
      status: "blocked",
      kind: "unavailable",
      message: "Session refresh failed with 429.",
      preserveOperationalShell: true
    });
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    {},
    [],
    false,
    {
      user: {
        name: "Legacy raw user",
        email: "legacy@example.test",
        image: "https://avatar.example.test/legacy.png"
      },
      session: {
        token: "raw-session-token"
      }
    },
    {
      ok: true,
      signedIn: true,
      currentUser: {
        name: "Michael",
        email: "owner@example.test",
        imageUrl: 42
      }
    }
  ])("fails closed for malformed session payload %#", async (session) => {
    apiFetchMock
      .mockResolvedValueOnce(jsonResponse({
        session: { id: "session-1" },
        user: { id: "auth-owner" }
      }))
      .mockResolvedValueOnce(jsonResponse(session));

    await expect(validateControlPanelAccess("https://api.example.test")).resolves.toEqual({
      status: "blocked",
      kind: "unavailable",
      message: "The account service returned an invalid session response."
    });
  });
});
