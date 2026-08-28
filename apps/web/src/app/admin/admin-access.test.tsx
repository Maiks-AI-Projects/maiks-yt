import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminAccessProvider, useAdminAccess } from "./admin-access";

vi.mock("../dev-auth-token", () => ({
  captureDevAuthTokenFromUrl: vi.fn(),
  createApiHeaders: vi.fn(() => ({})),
  getDevAuthToken: vi.fn(() => null)
}));

type AdminAccessSnapshot = ReturnType<typeof useAdminAccess>;

const jsonResponse = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
  headers: { "Content-Type": "application/json" },
  status
});

const AccessProbe = ({
  onRender
}: {
  onRender: (snapshot: AdminAccessSnapshot) => void;
}): React.ReactNode => {
  onRender(useAdminAccess());
  return null;
};

const renderAdminAccess = async (sessionBody: unknown): Promise<{
  fetchMock: ReturnType<typeof vi.fn>;
  snapshot: AdminAccessSnapshot;
}> => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);

    if (url.endsWith("/account/session")) {
      return jsonResponse(sessionBody);
    }

    if (url.endsWith("/account/domain")) {
      return jsonResponse({
        ok: true,
        domainUser: null
      });
    }

    if (url.endsWith("/admin/provider-integrations/status")) {
      return jsonResponse({ ok: true });
    }

    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  let snapshot: AdminAccessSnapshot | null = null;
  let renderer: ReactTestRenderer | null = null;

  await act(async () => {
    renderer = create(
      <AdminAccessProvider>
        <AccessProbe onRender={(nextSnapshot) => {
          snapshot = nextSnapshot;
        }} />
      </AdminAccessProvider>
    );
  });

  if (!snapshot) {
    throw new Error("Admin access state did not render.");
  }

  await act(async () => {
    renderer?.unmount();
  });

  return {
    fetchMock,
    snapshot
  };
};

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("admin account session boundary", () => {
  it("accepts the exact minimal session projection and reaches owner access", async () => {
    const { fetchMock, snapshot } = await renderAdminAccess({
      ok: true,
      signedIn: true,
      currentUser: {
        name: "Michael",
        email: "owner@example.test",
        imageUrl: "https://avatar.example.test/michael.png"
      }
    });

    expect(snapshot).toEqual({
      accessState: "owner",
      accountIdentity: {
        avatarUrl: "https://avatar.example.test/michael.png",
        displayName: "Michael",
        email: "owner@example.test",
        isSignedIn: true,
        sessionName: "Michael"
      },
      devAuthToken: null
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["signed-out null", null],
    ["malformed object", {}],
    ["legacy raw session", {
      user: {
        id: "raw-auth-user-id",
        name: "Legacy User",
        email: "legacy@example.test"
      },
      session: {
        token: "raw-session-token"
      }
    }],
    ["wrong field type", {
      ok: true,
      signedIn: true,
      currentUser: {
        name: "Michael",
        email: "owner@example.test",
        imageUrl: 42
      }
    }],
    ["extra raw field", {
      ok: true,
      signedIn: true,
      currentUser: {
        name: "Michael",
        email: "owner@example.test",
        imageUrl: null
      },
      session: {
        token: "raw-session-token"
      }
    }]
  ])("denies %s without crashing or requesting admin data", async (_label, sessionBody) => {
    const { fetchMock, snapshot } = await renderAdminAccess(sessionBody);

    expect(snapshot).toEqual({
      accessState: "none",
      accountIdentity: {
        avatarUrl: null,
        displayName: "Sign in",
        email: null,
        isSignedIn: false,
        sessionName: null
      },
      devAuthToken: null
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/account/session");
  });
});
