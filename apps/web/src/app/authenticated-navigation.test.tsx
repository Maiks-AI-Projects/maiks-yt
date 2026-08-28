import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createValidProviderIntegrationsStatusPayload } from "./admin/provider-integrations/provider-integrations-status-test-data";
import { AuthenticatedNavigation } from "./authenticated-navigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/account"
}));

vi.mock("./dev-auth-token", () => ({
  createApiHeaders: vi.fn(() => ({}))
}));

const jsonResponse = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
  headers: { "Content-Type": "application/json" },
  status
});

const sessionPayload = {
  ok: true,
  signedIn: true,
  currentUser: {
    name: "Michael",
    email: "owner@example.test",
    imageUrl: null
  }
};

const renderNavigation = async (
  ownerStatusBody: unknown,
  ownerStatusCode = 200
): Promise<{ fetchMock: ReturnType<typeof vi.fn>; labels: string[] }> => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);

    if (url.endsWith("/account/session")) {
      return jsonResponse(sessionPayload);
    }

    if (url.endsWith("/admin/provider-integrations/status")) {
      return jsonResponse(ownerStatusBody, ownerStatusCode);
    }

    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  let renderer: ReactTestRenderer | null = null;

  await act(async () => {
    renderer = create(<AuthenticatedNavigation context="account" />);
  });

  const mountedRenderer = renderer as ReactTestRenderer | null;

  if (!mountedRenderer) {
    throw new Error("Authenticated navigation did not render.");
  }

  const labels = mountedRenderer.root.findAllByType("a").map((link) => String(link.props.children));

  await act(async () => {
    renderer?.unmount();
  });

  return { fetchMock, labels };
};

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("authenticated owner navigation", () => {
  it("shows Admin for an exact provider-status success response", async () => {
    const { fetchMock, labels } = await renderNavigation(createValidProviderIntegrationsStatusPayload());

    expect(labels).toContain("Overview");
    expect(labels).toContain("Admin");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["malformed status", {}],
    ["legacy status", {
      ok: true,
      generatedAt: "2026-08-28T08:00:00.000Z",
      readOnly: true,
      providers: []
    }],
    ["extra-field status", {
      ...createValidProviderIntegrationsStatusPayload(),
      diagnostics: { sdk: "secret-provider-library" }
    }]
  ])("hides Admin for %s while preserving account navigation", async (_label, ownerStatusBody) => {
    const { labels } = await renderNavigation(ownerStatusBody);

    expect(labels).toContain("Overview");
    expect(labels).not.toContain("Admin");
  });

  it("requires a successful HTTP response as well as an exact success body", async () => {
    const { labels } = await renderNavigation(createValidProviderIntegrationsStatusPayload(), 403);

    expect(labels).toContain("Overview");
    expect(labels).not.toContain("Admin");
  });
});
