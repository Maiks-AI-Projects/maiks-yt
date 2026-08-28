import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProviderIntakeRecentClient from "./provider-intake-recent-client";

vi.mock("../../dev-auth-token", () => ({
  captureDevAuthTokenFromUrl: vi.fn(),
  createApiHeaders: vi.fn((headers: HeadersInit = {}) => headers)
}));

const createJsonResponse = (body: unknown): Response => new Response(JSON.stringify(body), {
  headers: { "Content-Type": "application/json" },
  status: 200
});

const reviewRef = "provider-intake-review:v1:opaque.review.tag";

const renderProviderIntake = async (
  fetchMock: ReturnType<typeof vi.fn>
): Promise<ReactTestRenderer> => {
  vi.stubGlobal("fetch", fetchMock);

  let renderer: ReactTestRenderer | null = null;
  await act(async () => {
    renderer = create(<ProviderIntakeRecentClient onSourceChange={() => undefined} source="twitch" />);
    await Promise.resolve();
  });

  if (!renderer) {
    throw new Error("Provider intake panel did not render.");
  }

  return renderer;
};

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("provider intake recent client", () => {
  it("renders the compact safe projection and reviews through the opaque ref", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);

      if (url.endsWith("/admin/connections/intake/health")) {
        return Promise.resolve(createJsonResponse({
          entries: [],
          generatedAt: "2026-07-05T16:00:01.000Z",
          ok: true,
          readOnly: true,
          staleAfterMinutes: 10080
        }));
      }

      if (url.includes("/admin/connections/intake?")) {
        return Promise.resolve(createJsonResponse({
          ok: true,
          readOnly: true,
          rows: [{
            catalogKnown: true,
            category: "chat",
            internalTrigger: "provider.twitch.irc.privmsg",
            mechanism: "twitch-irc",
            occurredAt: "2026-07-04T16:00:00.000Z",
            overlayEligibleByDefault: false,
            processingStatus: "stored",
            provider: "twitch",
            providerEventName: "PRIVMSG",
            receivedAt: "2026-07-04T16:00:01.000Z",
            reviewRef,
            reviewable: true,
            safeSummary: "Twitch PRIVMSG from Viewer",
            safetyFlags: {
              authOrTokenShaped: false,
              highVolume: true,
              moderationShaped: false,
              moneyShaped: false
            }
          }]
        }));
      }

      if (url.endsWith(`/admin/connections/intake/${encodeURIComponent(reviewRef)}/review`) && init?.method === "POST") {
        return Promise.resolve(createJsonResponse({
          action: "map_internal",
          ok: true,
          processingStatus: "mapped_to_event_history",
          publicPlayback: false
        }));
      }

      return Promise.reject(new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`));
    });
    const renderer = await renderProviderIntake(fetchMock);
    const rendered = JSON.stringify(renderer.toJSON());

    expect(rendered).toContain("Twitch PRIVMSG from Viewer");
    for (const forbidden of [
      "Redacted payload preview",
      "raw-actor-secret",
      "raw-history-secret",
      "raw-channel-secret",
      "raw-message-secret",
      "raw-source-event-secret",
      "secret chat body"
    ]) {
      expect(rendered).not.toContain(forbidden);
    }

    const mapButton = renderer.root.findAllByType("button")
      .find((button) => button.children.includes("Map internal"));

    if (!mapButton) {
      throw new Error("Map internal button did not render.");
    }

    await act(async () => {
      mapButton.props.onClick();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/admin/connections/intake/${encodeURIComponent(reviewRef)}/review`),
      expect.objectContaining({
        body: JSON.stringify({ action: "map_internal" }),
        method: "POST"
      })
    );
    expect(JSON.stringify(renderer.toJSON())).toContain("Mapped to internal audit.");

    await act(async () => {
      renderer.unmount();
    });
  });

  it("fails closed before rendering legacy raw intake row fields", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url.endsWith("/admin/connections/intake/health")) {
        return Promise.resolve(createJsonResponse({
          entries: [],
          generatedAt: "2026-07-05T16:00:01.000Z",
          ok: true,
          readOnly: true,
          staleAfterMinutes: 10080
        }));
      }

      if (url.includes("/admin/connections/intake?")) {
        return Promise.resolve(createJsonResponse({
          ok: true,
          readOnly: true,
          rows: [{
            actorExternalId: "raw-actor-secret",
            catalogKnown: true,
            category: "chat",
            internalTrigger: "provider.twitch.irc.privmsg",
            mechanism: "twitch-irc",
            occurredAt: "2026-07-04T16:00:00.000Z",
            overlayEligibleByDefault: false,
            processingStatus: "stored",
            provider: "twitch",
            providerChannelId: "raw-channel-secret",
            providerEventName: "PRIVMSG",
            receivedAt: "2026-07-04T16:00:01.000Z",
            redactedPayloadPreview: {
              message: "secret chat body"
            },
            reviewRef,
            reviewable: true,
            safeSummary: "Twitch PRIVMSG from Viewer",
            safetyFlags: {
              authOrTokenShaped: false,
              highVolume: true,
              moderationShaped: false,
              moneyShaped: false
            },
            sourceEventId: "raw-source-event-secret"
          }]
        }));
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    const renderer = await renderProviderIntake(fetchMock);
    const rendered = JSON.stringify(renderer.toJSON());

    expect(rendered).toContain("Observed history is unavailable.");
    for (const forbidden of [
      "raw-actor-secret",
      "raw-channel-secret",
      "raw-source-event-secret",
      "secret chat body"
    ]) {
      expect(rendered).not.toContain(forbidden);
    }

    await act(async () => {
      renderer.unmount();
    });
  });
});
