import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildProviderProfileSelectionPayload } from "./profile-identity-settings";
import ProviderConnections from "./provider-connections";
import StreamVisibilitySettings from "./stream-visibility-settings";
import type { StreamVisibilityPreferencesSnapshot } from "./account.types";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("account production response contract consumers", () => {
  it("renders connection rows from provider IDs and provider profile refs without raw account identifiers", () => {
    const markup = renderToStaticMarkup(
      <ProviderConnections
        accounts={[{ providerId: "github" }]}
        busyProvider={null}
        configuredProviderIds={["github"]}
        loadingProviderOptions={false}
        providerOptions={[{
          profileOptionRef: "profile-option:v1:opaque-ref",
          providerId: "github",
          displayName: "MaiksProvider",
          email: "provider-owned@example.test",
          imageUrl: "https://avatars.githubusercontent.com/u/123"
        }]}
        syncing={false}
        onLinkProvider={() => undefined}
        onSync={() => undefined}
      />
    );

    expect(markup).toContain("GitHub");
    expect(markup).toContain("Connected");
    expect(markup).toContain("MaiksProvider");
    expect(markup).toContain("provider-owned@example.test");
    expect(markup).not.toContain("profile-option:v1:opaque-ref");
    expect(markup).not.toContain("accountId");
    expect(markup).not.toContain("providerAccountId");
  });

  it("builds provider profile selection payloads with opaque refs instead of raw auth account ids", () => {
    const payload = buildProviderProfileSelectionPayload({
      profileOptionRef: "profile-option:v1:opaque-ref",
      providerId: "github",
      displayName: "MaiksProvider",
      email: "provider-owned@example.test",
      imageUrl: null
    }, "name");

    expect(payload).toEqual({
      profileOptionRef: "profile-option:v1:opaque-ref",
      useDisplayName: true,
      useImage: false
    });
    expect(payload).not.toHaveProperty("accountId");
  });

  it("renders stream controls from a preferences-only account response", () => {
    const snapshot: StreamVisibilityPreferencesSnapshot = {
      ok: true,
      preferences: [{
        scope: "all_stream_visible_website_events",
        label: "All website/community moments",
        description: "Hide your website and community activity from stream-visible notifications.",
        optedOut: true
      }]
    };
    const markup = renderToStaticMarkup(
      <StreamVisibilitySettings
        globalPreference={snapshot.ok ? snapshot.preferences[0] : undefined}
        perEventPreferences={[]}
        savingScope={null}
        onChange={() => undefined}
      />
    );

    expect(markup).toContain("All website/community moments");
    expect(markup).toContain("Hidden");
    expect(markup).not.toContain("domainUser");
    expect(markup).not.toContain("authUserId");
    expect(markup).not.toContain("providerAccountId");
  });
});
