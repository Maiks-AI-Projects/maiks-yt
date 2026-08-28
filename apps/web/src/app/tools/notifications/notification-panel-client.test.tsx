import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NotificationPanelClient from "./notification-panel-client";

vi.mock("../../dev-auth-token", () => ({
  captureDevAuthTokenFromUrl: vi.fn(),
  createApiHeaders: vi.fn(() => ({}))
}));

const signedOutResponse = new Response(JSON.stringify({
  ok: false,
  reason: "not_authenticated"
}), {
  headers: { "Content-Type": "application/json" },
  status: 401
});

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("window", {
    clearInterval: vi.fn(),
    location: {
      href: "https://maiks.yt/tools/notifications?notificationToken=private&accessToken=launch#blocked"
    },
    setInterval: vi.fn(() => 1)
  });
  vi.stubGlobal("navigator", {});
  vi.stubGlobal("fetch", vi.fn(async () => signedOutResponse.clone()));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Notifications signed-out panel", () => {
  it("offers a clean access-recovery link without forwarding location data", async () => {
    let renderer: ReactTestRenderer | null = null;

    await act(async () => {
      renderer = create(<NotificationPanelClient />);
      await Promise.resolve();
    });

    const mountedRenderer = renderer as ReactTestRenderer | null;

    if (!mountedRenderer) {
      throw new Error("Notifications panel did not render.");
    }

    const links = mountedRenderer.root.findAllByType("a");
    const recoveryLink = links.find((link) => link.props.children === "Renew sign-in");
    const href = String(recoveryLink?.props.href);

    expect(recoveryLink).toBeDefined();
    expect(href).toBe(
      "/access/recovery?returnTo=https%3A%2F%2Fmaiks.yt%2Ftools%2Fnotifications"
    );
    expect(href).not.toMatch(/notificationToken|accessToken|private|launch|blocked|#/i);

    await act(async () => {
      renderer?.unmount();
    });
  });
});
