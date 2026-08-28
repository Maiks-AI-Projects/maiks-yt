import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it } from "vitest";

import { createValidProviderIntegrationsStatusPayload } from "./provider-integrations-status-test-data";
import { parseProviderIntegrationsStatusResponse } from "./provider-integrations-status.service";
import ProviderIntegrationsWorkspace from "./provider-integrations-workspace";
import type {
  ProviderIntegrationsStatusResponse,
  TwitchEventSubDefaultSubscriptionStatus
} from "./provider-integrations-status.types";

type ProviderSnapshot = Extract<ProviderIntegrationsStatusResponse, { ok: true }>;

const noop = (): void => undefined;

const createReadySnapshot = (): ProviderSnapshot => {
  const payload = createValidProviderIntegrationsStatusPayload();
  payload.providers[0]!.capabilities[3]!.state = "available";
  payload.providers[2]!.capabilities[2]!.state = "available";
  const snapshot = parseProviderIntegrationsStatusResponse(payload);

  if (!snapshot?.ok) {
    throw new Error("Provider Integrations display test payload is invalid.");
  }

  return snapshot;
};

const renderWorkspace = async (input: {
  twitchEventSubDefaults: readonly TwitchEventSubDefaultSubscriptionStatus[];
  twitchEventSubSubscriptionsLoaded: boolean;
}): Promise<ReactTestRenderer> => {
  let renderer: ReactTestRenderer | null = null;

  await act(async () => {
    renderer = create(
      <ProviderIntegrationsWorkspace
        onConnectYouTube={noop}
        onDiscoverYouTubeChannels={noop}
        onDiscordChatAction={noop}
        onEnsureTwitchSubscriptions={noop}
        onPollYouTubeActivities={noop}
        onRefreshAll={noop}
        onRefreshDiscord={noop}
        onRefreshTwitch={noop}
        onRefreshYouTube={noop}
        onSelectTwitchEventSubBroadcaster={noop}
        onSelectYouTubeChannel={noop}
        onTwitchChatAction={noop}
        onYouTubeLiveChatAction={noop}
        onYouTubePubSubAction={noop}
        snapshot={createReadySnapshot()}
        twitchEventSubBroadcasterLogin="maiksmc"
        twitchEventSubBroadcasterLogins={["maiksmc"]}
        twitchEventSubDefaults={input.twitchEventSubDefaults}
        twitchEventSubSubscriptionCount={input.twitchEventSubDefaults.length}
        twitchEventSubSubscriptionsLoaded={input.twitchEventSubSubscriptionsLoaded}
        youtubeActivitiesPoll={null}
        youtubeChannels={[]}
        youtubeCredential={{ state: "connected" }}
        youtubePubSubSubscription={null}
        youtubeSelectedChannelRef={null}
      />
    );
  });

  if (!renderer) {
    throw new Error("Provider Integrations workspace did not render.");
  }

  return renderer;
};

describe("ProviderIntegrationsWorkspace setup state", () => {
  it("does not show all-clear before Twitch subscription state is loaded", async () => {
    const renderer = await renderWorkspace({
      twitchEventSubDefaults: [],
      twitchEventSubSubscriptionsLoaded: false
    });

    expect(JSON.stringify(renderer.toJSON())).not.toContain("No setup issues detected.");

    await act(async () => {
      renderer.unmount();
    });
  });

  it("shows all-clear only after loaded Twitch subscription evidence has no missing entries", async () => {
    const renderer = await renderWorkspace({
      twitchEventSubDefaults: [{ state: "enabled", type: "stream.online" }],
      twitchEventSubSubscriptionsLoaded: true
    });

    expect(JSON.stringify(renderer.toJSON())).toContain("No setup issues detected.");

    await act(async () => {
      renderer.unmount();
    });
  });
});
