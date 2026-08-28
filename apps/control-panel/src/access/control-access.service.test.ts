import { validateUrlAccessGate } from "@maiks-yt/ui";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "../dev-auth-token.js";

import {
  getControlAccessRetryDelay,
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

beforeEach(() => {
  vi.resetAllMocks();
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
});

describe("login-required control access", () => {
  it("allows a valid token with the minimal signed-in session projection", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({
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
    expect(apiFetchMock).toHaveBeenCalledWith("https://api.example.test/account/session");
  });

  it("preserves the email and generic display-name fallbacks", async () => {
    apiFetchMock
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

  it("denies a signed-out null session", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(null));

    await expect(validateControlPanelAccess("https://api.example.test")).resolves.toEqual({
      status: "blocked",
      kind: "login-required",
      message: "Your sign-in needs to be renewed."
    });
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
    apiFetchMock.mockResolvedValue(jsonResponse(session));

    await expect(validateControlPanelAccess("https://api.example.test")).resolves.toEqual({
      status: "blocked",
      kind: "unavailable",
      message: "The account service returned an invalid session response."
    });
  });
});
