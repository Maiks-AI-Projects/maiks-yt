"use client";

import { useCallback, useEffect, useState } from "react";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";

import {
  getFailureMessage,
  getLoadStateForFailure,
  parseJson
} from "./provider-integrations-status.service";
import ProviderIntegrationsWorkspace from "./provider-integrations-workspace";
import type {
  DiscordChatIntakeResponse,
  DiscordChatIntakeStatus,
  LoadState,
  ProviderIntegrationsStatusResponse,
  TwitchChatIntakeResponse,
  TwitchChatIntakeStatus,
  TwitchEventSubDefaultSubscriptionStatus,
  TwitchEventSubEnsureDefaultsResponse,
  TwitchEventSubSubscriptionListResponse,
  YouTubeActivitiesPollResponse,
  YouTubeChannelSelectionResponse,
  YouTubeConsentResponse,
  YouTubeCredentialSummary,
  YouTubeLiveChatIntakeResponse,
  YouTubeLiveChatIntakeStatus,
  YouTubePubSubSubscriptionRequestResponse,
  YouTubePubSubSubscriptionResponse,
  YouTubeSavedChannel
} from "./provider-integrations-status.types";
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";
const youtubeLiveChatReadScope = "https://www.googleapis.com/auth/youtube.readonly";
const ProviderIntegrationsStatusClient = (): React.ReactNode => {
  const [snapshot, setSnapshot] = useState<Extract<ProviderIntegrationsStatusResponse, { ok: true }> | null>(null);
  const [twitchChatStatus, setTwitchChatStatus] = useState<TwitchChatIntakeStatus | null>(null);
  const [discordChatStatus, setDiscordChatStatus] = useState<DiscordChatIntakeStatus | null>(null);
  const [youtubeLiveChatStatus, setYouTubeLiveChatStatus] = useState<YouTubeLiveChatIntakeStatus | null>(null);
  const [youtubeCredential, setYouTubeCredential] = useState<YouTubeCredentialSummary | null>(null);
  const [youtubeChannels, setYouTubeChannels] = useState<readonly YouTubeSavedChannel[]>([]);
  const [youtubeSelectedChannelId, setYouTubeSelectedChannelId] = useState<string | null>(null);
  const [twitchEventSubDefaults, setTwitchEventSubDefaults] = useState<readonly TwitchEventSubDefaultSubscriptionStatus[]>([]);
  const [twitchEventSubSubscriptionCount, setTwitchEventSubSubscriptionCount] = useState<number>(0);
  const [twitchEventSubCallbackUrl, setTwitchEventSubCallbackUrl] = useState<string | null>(null);
  const [youtubePubSubSubscription, setYouTubePubSubSubscription] = useState<Extract<YouTubePubSubSubscriptionResponse, { ok: true }> | null>(null);
  const [youtubeActivitiesPoll, setYouTubeActivitiesPoll] = useState<Extract<YouTubeActivitiesPollResponse, { ok: true }> | null>(null);
  const [youtubeRedirectUri, setYouTubeRedirectUri] = useState<string>(
    `${apiBaseUrl}/admin/provider-integrations/youtube/callback`
  );
  const [youtubeRequiredScope, setYouTubeRequiredScope] = useState<string>(youtubeLiveChatReadScope);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string>("Loading provider integration status...");
  const [twitchActionMessage, setTwitchActionMessage] = useState<string>("Twitch chat intake status not loaded.");
  const [discordActionMessage, setDiscordActionMessage] = useState<string>("Discord chat intake status not loaded.");
  const [youtubeActionMessage, setYouTubeActionMessage] = useState<string>("YouTube owner consent not checked.");
  const [youtubeChannelActionMessage, setYouTubeChannelActionMessage] = useState<string>("YouTube channels not discovered yet.");
  const [youtubeLiveChatActionMessage, setYouTubeLiveChatActionMessage] = useState<string>("YouTube live-chat polling status not loaded.");
  const [twitchEventSubActionMessage, setTwitchEventSubActionMessage] = useState<string>("Twitch EventSub subscriptions not checked.");
  const [youtubePubSubActionMessage, setYouTubePubSubActionMessage] = useState<string>("YouTube PubSub subscription target not checked.");
  const [youtubeActivitiesActionMessage, setYouTubeActivitiesActionMessage] = useState<string>("YouTube activities have not been polled yet.");

  const loadStatus = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    setMessage("Loading provider integration status...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/status`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<ProviderIntegrationsStatusResponse>(response);

      if (response.ok && payload?.ok) {
        setSnapshot(payload);
        setLoadState("ready");
        setMessage("Provider integration status loaded.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState(getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Provider integration status request failed.");
    }
  }, []);

  const loadTwitchChatStatus = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/twitch-chat`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<TwitchChatIntakeResponse>(response);

      if (response.ok && payload?.ok) {
        setTwitchChatStatus(payload.status);
        setTwitchActionMessage("Twitch chat intake status loaded.");
        return;
      }

      setTwitchActionMessage(`Twitch chat intake status failed with ${response.status}.`);
    } catch (error) {
      setTwitchActionMessage(error instanceof Error ? error.message : "Twitch chat intake status failed.");
    }
  }, []);

  const loadDiscordChatStatus = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/discord-chat`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<DiscordChatIntakeResponse>(response);

      if (response.ok && payload?.ok) {
        setDiscordChatStatus(payload.status);
        setDiscordActionMessage("Discord chat intake status loaded.");
        return;
      }

      setDiscordActionMessage(`Discord chat intake status failed with ${response.status}.`);
    } catch (error) {
      setDiscordActionMessage(error instanceof Error ? error.message : "Discord chat intake status failed.");
    }
  }, []);

  const loadYouTubeCredential = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/youtube/credential`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<YouTubeConsentResponse>(response);

      if (response.ok && payload?.ok) {
        setYouTubeCredential(payload.credential);
        setYouTubeRedirectUri(payload.redirectUri);
        setYouTubeRequiredScope(payload.requiredScope);
        setYouTubeActionMessage(payload.credential?.status === "active"
          ? "YouTube owner credential is active."
          : "YouTube owner credential is not connected yet.");
        if (!payload.credential || payload.credential.status !== "active") {
          setYouTubeChannels([]);
          setYouTubeSelectedChannelId(null);
          setYouTubeChannelActionMessage("Connect YouTube owner consent before discovering channels.");
        }
        return;
      }

      setYouTubeActionMessage(`YouTube credential status failed with ${response.status}.`);
    } catch (error) {
      setYouTubeActionMessage(error instanceof Error ? error.message : "YouTube credential status failed.");
    }
  }, []);

  const loadYouTubeLiveChatStatus = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/youtube-live-chat`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<YouTubeLiveChatIntakeResponse>(response);

      if (response.ok && payload?.ok) {
        setYouTubeLiveChatStatus(payload.status);
        setYouTubeLiveChatActionMessage("YouTube live-chat polling status loaded.");
        return;
      }

      setYouTubeLiveChatActionMessage(`YouTube live-chat polling status failed with ${response.status}.`);
    } catch (error) {
      setYouTubeLiveChatActionMessage(error instanceof Error ? error.message : "YouTube live-chat polling status failed.");
    }
  }, []);

  const loadYouTubeChannelSelection = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/youtube/channel-selection`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<YouTubeChannelSelectionResponse>(response);

      if (response.ok && payload?.ok) {
        setYouTubeChannels(payload.channels);
        setYouTubeSelectedChannelId(payload.selectedChannelId);
        setYouTubeChannelActionMessage(payload.channels.length > 0
          ? "Saved YouTube channels loaded."
          : "No saved YouTube channels yet. Discover channels to save them.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : `http_${response.status}`;
      setYouTubeChannelActionMessage(`YouTube channel selection failed: ${reason}.`);
    } catch (error) {
      setYouTubeChannelActionMessage(error instanceof Error ? error.message : "YouTube channel selection failed.");
    }
  }, []);

  const loadTwitchEventSubSubscriptions = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/twitch-eventsub/subscriptions`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<TwitchEventSubSubscriptionListResponse>(response);

      if (response.ok && payload?.ok) {
        setTwitchEventSubDefaults(payload.defaults);
        setTwitchEventSubSubscriptionCount(payload.subscriptions.length);
        setTwitchEventSubCallbackUrl(payload.callbackUrl);
        setTwitchEventSubActionMessage(payload.defaults.every((entry) => entry.state === "enabled")
          ? "Default Twitch EventSub subscriptions are enabled."
          : "Some default Twitch EventSub subscriptions need attention.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : `http_${response.status}`;
      setTwitchEventSubActionMessage(`Twitch EventSub subscription status failed: ${reason}.`);
    } catch (error) {
      setTwitchEventSubActionMessage(error instanceof Error ? error.message : "Twitch EventSub subscription status failed.");
    }
  }, []);

  const loadYouTubePubSubSubscription = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/youtube-pubsub/subscription`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<YouTubePubSubSubscriptionResponse>(response);

      if (response.ok && payload?.ok) {
        setYouTubePubSubSubscription(payload);
        setYouTubePubSubActionMessage("YouTube PubSub target is ready.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : `http_${response.status}`;
      setYouTubePubSubSubscription(null);
      setYouTubePubSubActionMessage(`YouTube PubSub target failed: ${reason}.`);
    } catch (error) {
      setYouTubePubSubSubscription(null);
      setYouTubePubSubActionMessage(error instanceof Error ? error.message : "YouTube PubSub target failed.");
    }
  }, []);

  const requestYouTubePubSubSubscription = useCallback(async (mode: "subscribe" | "unsubscribe"): Promise<void> => {
    setYouTubePubSubActionMessage(mode === "subscribe"
      ? "Requesting YouTube PubSub subscription..."
      : "Requesting YouTube PubSub unsubscribe...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/youtube-pubsub/${mode}`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<YouTubePubSubSubscriptionRequestResponse>(response);

      if (response.ok && payload?.ok) {
        setYouTubePubSubSubscription({
          ok: true,
          callbackUrl: payload.callbackUrl,
          channelId: payload.channelId,
          hubUrl: payload.hubUrl,
          readOnly: true,
          state: "ready",
          topicUrl: payload.topicUrl
        });
        setYouTubePubSubActionMessage(mode === "subscribe"
          ? "YouTube PubSub subscription requested. The hub should verify the callback."
          : "YouTube PubSub unsubscribe requested.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : `http_${response.status}`;
      setYouTubePubSubActionMessage(`YouTube PubSub ${mode} failed: ${reason}.`);
    } catch (error) {
      setYouTubePubSubActionMessage(error instanceof Error ? error.message : `YouTube PubSub ${mode} failed.`);
    }
  }, []);

  const pollYouTubeActivities = useCallback(async (): Promise<void> => {
    setYouTubeActivitiesActionMessage("Polling recent YouTube channel activities...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/youtube-activities/poll`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<YouTubeActivitiesPollResponse>(response);

      if (response.ok && payload?.ok) {
        setYouTubeActivitiesPoll(payload);
        setYouTubeActivitiesActionMessage(`Polled ${payload.fetched} YouTube activities; ${payload.inserted} new intake rows stored.`);
        return;
      }

      const reason = payload?.ok === false ? payload.reason : `http_${response.status}`;
      setYouTubeActivitiesActionMessage(`YouTube activities poll failed: ${reason}.`);
    } catch (error) {
      setYouTubeActivitiesActionMessage(error instanceof Error ? error.message : "YouTube activities poll failed.");
    }
  }, []);

  const ensureTwitchEventSubSubscriptions = useCallback(async (): Promise<void> => {
    setTwitchEventSubActionMessage("Creating missing Twitch EventSub subscriptions...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/twitch-eventsub/default-subscriptions`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<TwitchEventSubEnsureDefaultsResponse>(response);

      if (response.ok && payload?.ok) {
        const createdCount = payload.results.filter((entry) => entry.state === "created").length;
        setTwitchEventSubActionMessage(createdCount > 0
          ? `Created ${createdCount} missing Twitch EventSub subscription${createdCount === 1 ? "" : "s"}.`
          : "Twitch EventSub defaults already existed or were pending verification.");
        await loadTwitchEventSubSubscriptions();
        await loadStatus();
        return;
      }

      const reason = payload?.ok === false ? payload.reason : `http_${response.status}`;
      setTwitchEventSubActionMessage(`Twitch EventSub subscription creation failed: ${reason}.`);
    } catch (error) {
      setTwitchEventSubActionMessage(error instanceof Error ? error.message : "Twitch EventSub subscription creation failed.");
    }
  }, [loadStatus, loadTwitchEventSubSubscriptions]);

  const discoverYouTubeChannels = useCallback(async (): Promise<void> => {
    setYouTubeChannelActionMessage("Discovering and saving YouTube channels...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/youtube/channel-selection/discover`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<YouTubeChannelSelectionResponse>(response);

      if (response.ok && payload?.ok) {
        setYouTubeChannels(payload.channels);
        setYouTubeSelectedChannelId(payload.selectedChannelId);
        setYouTubeChannelActionMessage(payload.channels.length > 0
          ? `Discovered and saved ${payload.channels.length} YouTube channel${payload.channels.length === 1 ? "" : "s"}.`
          : "No YouTube channels were returned for this owner credential.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : `http_${response.status}`;
      setYouTubeChannels([]);
      setYouTubeSelectedChannelId(null);
      setYouTubeChannelActionMessage(`YouTube channel discovery failed: ${reason}.`);
    } catch (error) {
      setYouTubeChannels([]);
      setYouTubeSelectedChannelId(null);
      setYouTubeChannelActionMessage(error instanceof Error ? error.message : "YouTube channel discovery failed.");
    }
  }, []);

  const selectYouTubeChannel = useCallback(async (channelId: string | null): Promise<void> => {
    setYouTubeChannelActionMessage(channelId ? "Saving selected YouTube live-chat channel..." : "Clearing selected YouTube live-chat channel...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/youtube/channel-selection`, {
        method: "PUT",
        headers: createApiHeaders({
          "content-type": "application/json"
        }),
        credentials: "include",
        body: JSON.stringify({ channelId })
      });
      const payload = await parseJson<YouTubeChannelSelectionResponse>(response);

      if (response.ok && payload?.ok) {
        setYouTubeChannels(payload.channels);
        setYouTubeSelectedChannelId(payload.selectedChannelId);
        setYouTubeChannelActionMessage(payload.selectedChannelId
          ? "Selected YouTube live-chat channel saved."
          : "YouTube live-chat channel selection cleared.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : `http_${response.status}`;
      setYouTubeChannelActionMessage(`YouTube channel selection failed: ${reason}.`);
    } catch (error) {
      setYouTubeChannelActionMessage(error instanceof Error ? error.message : "YouTube channel selection failed.");
    }
  }, []);

  const connectYouTube = useCallback(async (): Promise<void> => {
    setYouTubeActionMessage("Creating YouTube owner consent URL...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/youtube/consent-url`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<YouTubeConsentResponse>(response);

      if (response.ok && payload?.ok && payload.consentUrl) {
        setYouTubeCredential(payload.credential);
        setYouTubeRedirectUri(payload.redirectUri);
        setYouTubeRequiredScope(payload.requiredScope);
        setYouTubeActionMessage("Opening Google owner consent...");
        window.location.assign(payload.consentUrl);
        return;
      }

      const reason = payload?.ok === false ? payload.reason : "missing_consent_url";
      setYouTubeActionMessage(`YouTube owner consent failed: ${reason}.`);
    } catch (error) {
      setYouTubeActionMessage(error instanceof Error ? error.message : "YouTube owner consent failed.");
    }
  }, []);

  const runTwitchChatAction = useCallback(async (action: "start" | "stop"): Promise<void> => {
    setTwitchActionMessage(action === "start" ? "Starting Twitch chat intake..." : "Stopping Twitch chat intake...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/twitch-chat/${action}`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<TwitchChatIntakeResponse>(response);

      if (response.ok && payload?.ok) {
        setTwitchChatStatus(payload.status);
        setTwitchActionMessage(action === "start" ? "Twitch chat intake started." : "Twitch chat intake stopped.");
        await loadStatus();
        return;
      }

      setTwitchActionMessage(`Twitch chat intake ${action} failed with ${response.status}.`);
    } catch (error) {
      setTwitchActionMessage(error instanceof Error ? error.message : `Twitch chat intake ${action} failed.`);
    }
  }, [loadStatus]);

  const runDiscordChatAction = useCallback(async (action: "start" | "stop"): Promise<void> => {
    setDiscordActionMessage(action === "start" ? "Starting Discord chat intake..." : "Stopping Discord chat intake...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/discord-chat/${action}`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<DiscordChatIntakeResponse>(response);

      if (response.ok && payload?.ok) {
        setDiscordChatStatus(payload.status);
        setDiscordActionMessage(action === "start" ? "Discord chat intake started." : "Discord chat intake stopped.");
        await loadStatus();
        return;
      }

      setDiscordActionMessage(`Discord chat intake ${action} failed with ${response.status}.`);
    } catch (error) {
      setDiscordActionMessage(error instanceof Error ? error.message : `Discord chat intake ${action} failed.`);
    }
  }, [loadStatus]);

  const runYouTubeLiveChatAction = useCallback(async (action: "start" | "stop"): Promise<void> => {
    setYouTubeLiveChatActionMessage(action === "start" ? "Starting YouTube live-chat polling..." : "Stopping YouTube live-chat polling...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/youtube-live-chat/${action}`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<YouTubeLiveChatIntakeResponse>(response);

      if (response.ok && payload?.ok) {
        setYouTubeLiveChatStatus(payload.status);
        setYouTubeLiveChatActionMessage(action === "start" ? "YouTube live-chat polling started." : "YouTube live-chat polling stopped.");
        await loadStatus();
        return;
      }

      setYouTubeLiveChatActionMessage(`YouTube live-chat polling ${action} failed with ${response.status}.`);
    } catch (error) {
      setYouTubeLiveChatActionMessage(error instanceof Error ? error.message : `YouTube live-chat polling ${action} failed.`);
    }
  }, [loadStatus]);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadStatus();
    void loadTwitchChatStatus();
    void loadTwitchEventSubSubscriptions();
    void loadDiscordChatStatus();
    void loadYouTubeCredential();
    void loadYouTubeChannelSelection();
    void loadYouTubeLiveChatStatus();
    void loadYouTubePubSubSubscription();
  }, [
    loadDiscordChatStatus,
    loadStatus,
    loadTwitchChatStatus,
    loadTwitchEventSubSubscriptions,
    loadYouTubeChannelSelection,
    loadYouTubeCredential,
    loadYouTubeLiveChatStatus,
    loadYouTubePubSubSubscription
  ]);

  return (
    <>
      {!snapshot ? (
        <>
          <header className="project-admin-header">
            <p className="eyebrow">Owner status</p>
            <h1>Provider Integrations</h1>
            <p>Runtime connections for Twitch, YouTube, and Discord.</p>
          </header>
          <section className={`project-admin-state ${loadState}`}>
            <div>
              <h2>{loadState === "loading" ? "Loading" : "Needs attention"}</h2>
              <p>{message}</p>
            </div>
            <div className="project-admin-actions">
              <button type="button" onClick={() => void loadStatus()}>Refresh</button>
            </div>
          </section>
        </>
      ) : (
        <ProviderIntegrationsWorkspace
          actionMessages={{
            twitch: twitchActionMessage,
            discord: discordActionMessage,
            youtube: youtubeActionMessage,
            youtubeChannel: youtubeChannelActionMessage,
            youtubeLiveChat: youtubeLiveChatActionMessage,
            twitchEventSub: twitchEventSubActionMessage,
            youtubePubSub: youtubePubSubActionMessage,
            youtubeActivities: youtubeActivitiesActionMessage
          }}
          discordChatStatus={discordChatStatus}
          onConnectYouTube={() => void connectYouTube()}
          onDiscoverYouTubeChannels={() => void discoverYouTubeChannels()}
          onDiscordChatAction={(action) => void runDiscordChatAction(action)}
          onEnsureTwitchSubscriptions={() => void ensureTwitchEventSubSubscriptions()}
          onPollYouTubeActivities={() => void pollYouTubeActivities()}
          onRefreshAll={() => {
            void loadStatus();
            void loadTwitchChatStatus();
            void loadTwitchEventSubSubscriptions();
            void loadDiscordChatStatus();
            void loadYouTubeCredential();
            void loadYouTubeChannelSelection();
            void loadYouTubeLiveChatStatus();
            void loadYouTubePubSubSubscription();
          }}
          onRefreshDiscord={() => {
            void loadDiscordChatStatus();
            void loadStatus();
          }}
          onRefreshTwitch={() => {
            void loadTwitchChatStatus();
            void loadTwitchEventSubSubscriptions();
            void loadStatus();
          }}
          onRefreshYouTube={() => {
            void loadYouTubeCredential();
            void loadYouTubeChannelSelection();
            void loadYouTubeLiveChatStatus();
            void loadYouTubePubSubSubscription();
          }}
          onSelectYouTubeChannel={(channelId) => void selectYouTubeChannel(channelId)}
          onTwitchChatAction={(action) => void runTwitchChatAction(action)}
          onYouTubeLiveChatAction={(action) => void runYouTubeLiveChatAction(action)}
          onYouTubePubSubAction={(mode) => void requestYouTubePubSubSubscription(mode)}
          snapshot={snapshot}
          twitchChatStatus={twitchChatStatus}
          twitchEventSubCallbackUrl={twitchEventSubCallbackUrl}
          twitchEventSubDefaults={twitchEventSubDefaults}
          twitchEventSubSubscriptionCount={twitchEventSubSubscriptionCount}
          youtubeActivitiesPoll={youtubeActivitiesPoll}
          youtubeChannels={youtubeChannels}
          youtubeCredential={youtubeCredential}
          youtubeLiveChatStatus={youtubeLiveChatStatus}
          youtubePubSubSubscription={youtubePubSubSubscription}
          youtubeRedirectUri={youtubeRedirectUri}
          youtubeRequiredScope={youtubeRequiredScope}
          youtubeSelectedChannelId={youtubeSelectedChannelId}
        />
      )}
    </>
  );
};

export default ProviderIntegrationsStatusClient;
