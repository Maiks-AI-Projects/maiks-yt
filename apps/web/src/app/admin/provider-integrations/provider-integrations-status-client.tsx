"use client";

import { useCallback, useEffect, useState } from "react";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";

import {
  getFailureMessage,
  getLoadStateForFailure,
  parseJson
} from "./provider-integrations-status.service";
import ProviderIntegrationsWorkspace from "./provider-integrations-workspace";
import {
  providerIntegrationInitialLoadOperations,
  providerIntegrationRequestPaths
} from "./provider-integrations-workspace.rules";
import type {
  LoadState,
  ProviderIntegrationsStatusResponse,
  TwitchEventSubDefaultSubscriptionStatus,
  TwitchEventSubEnsureDefaultsResponse,
  TwitchEventSubSubscriptionListResponse,
  YouTubeActivitiesPollResponse,
  YouTubeChannelSelectionResponse,
  YouTubeConsentResponse,
  YouTubeCredentialSummary,
  YouTubePubSubSubscriptionRequestResponse,
  YouTubePubSubSubscriptionResponse,
  YouTubeSavedChannel
} from "./provider-integrations-status.types";
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.maiks.yt";
const youtubeLiveChatReadScope = "https://www.googleapis.com/auth/youtube.readonly";

const ProviderIntegrationsStatusClient = (): React.ReactNode => {
  const [snapshot, setSnapshot] = useState<Extract<ProviderIntegrationsStatusResponse, { ok: true }> | null>(null);
  const [youtubeCredential, setYouTubeCredential] = useState<YouTubeCredentialSummary | null>(null);
  const [youtubeChannels, setYouTubeChannels] = useState<readonly YouTubeSavedChannel[]>([]);
  const [youtubeSelectedChannelId, setYouTubeSelectedChannelId] = useState<string | null>(null);
  const [twitchEventSubDefaults, setTwitchEventSubDefaults] = useState<readonly TwitchEventSubDefaultSubscriptionStatus[]>([]);
  const [twitchEventSubBroadcasterLogin, setTwitchEventSubBroadcasterLogin] = useState<string | null>(null);
  const [twitchEventSubBroadcasterLogins, setTwitchEventSubBroadcasterLogins] = useState<readonly string[]>([]);
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
  const loadStatus = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    setMessage("Loading provider integration status...");

    try {
      const response = await fetch(`${apiBaseUrl}${providerIntegrationRequestPaths.status}`, {
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

  const loadYouTubeCredential = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}${providerIntegrationRequestPaths.youtubeCredential}`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<YouTubeConsentResponse>(response);

      if (response.ok && payload?.ok) {
        setYouTubeCredential(payload.credential);
        setYouTubeRedirectUri(payload.redirectUri);
        setYouTubeRequiredScope(payload.requiredScope);
        if (!payload.credential || payload.credential.status !== "active") {
          setYouTubeChannels([]);
          setYouTubeSelectedChannelId(null);
        }
        return;
      }
    } catch {}
  }, []);

  const loadYouTubeChannelSelection = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}${providerIntegrationRequestPaths.youtubeChannelSelection}`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<YouTubeChannelSelectionResponse>(response);

      if (response.ok && payload?.ok) {
        setYouTubeChannels(payload.channels);
        setYouTubeSelectedChannelId(payload.selectedChannelId);
        return;
      }
    } catch {}
  }, []);

  const loadTwitchEventSubSubscriptions = useCallback(async (requestedBroadcaster?: string): Promise<void> => {
    try {
      const broadcasterLogin = requestedBroadcaster ?? twitchEventSubBroadcasterLogin;
      const query = broadcasterLogin ? `?broadcaster=${encodeURIComponent(broadcasterLogin)}` : "";
      const response = await fetch(`${apiBaseUrl}${providerIntegrationRequestPaths.twitchEventSubSubscriptions}${query}`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<TwitchEventSubSubscriptionListResponse>(response);

      if (response.ok && payload?.ok) {
        setTwitchEventSubBroadcasterLogin(payload.broadcasterLogin);
        setTwitchEventSubBroadcasterLogins(payload.broadcasterLogins);
        setTwitchEventSubDefaults(payload.defaults);
        setTwitchEventSubSubscriptionCount(payload.subscriptions.length);
        setTwitchEventSubCallbackUrl(payload.callbackUrl);
        return;
      }
    } catch {}
  }, [twitchEventSubBroadcasterLogin]);

  const loadYouTubePubSubSubscription = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}${providerIntegrationRequestPaths.youtubePubSubSubscription}`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<YouTubePubSubSubscriptionResponse>(response);

      if (response.ok && payload?.ok) {
        setYouTubePubSubSubscription(payload);
        return;
      }

      setYouTubePubSubSubscription(null);
    } catch {
      setYouTubePubSubSubscription(null);
    }
  }, []);

  const requestYouTubePubSubSubscription = useCallback(async (mode: "subscribe" | "unsubscribe"): Promise<void> => {
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
        return;
      }
    } catch {}
  }, []);

  const pollYouTubeActivities = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/youtube-activities/poll`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<YouTubeActivitiesPollResponse>(response);

      if (response.ok && payload?.ok) {
        setYouTubeActivitiesPoll(payload);
        return;
      }
    } catch {}
  }, []);

  const ensureTwitchEventSubSubscriptions = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/twitch-eventsub/default-subscriptions`, {
        method: "POST",
        headers: createApiHeaders({ "content-type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          ...(twitchEventSubBroadcasterLogin ? { broadcasterLogin: twitchEventSubBroadcasterLogin } : {})
        })
      });
      const payload = await parseJson<TwitchEventSubEnsureDefaultsResponse>(response);

      if (response.ok && payload?.ok) {
        await loadTwitchEventSubSubscriptions(twitchEventSubBroadcasterLogin ?? undefined);
        await loadStatus();
        return;
      }
    } catch {}
  }, [loadStatus, loadTwitchEventSubSubscriptions, twitchEventSubBroadcasterLogin]);

  const discoverYouTubeChannels = useCallback(async (): Promise<void> => {
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
        return;
      }

      setYouTubeChannels([]);
      setYouTubeSelectedChannelId(null);
    } catch {
      setYouTubeChannels([]);
      setYouTubeSelectedChannelId(null);
    }
  }, []);

  const selectYouTubeChannel = useCallback(async (channelId: string | null): Promise<void> => {
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
        return;
      }
    } catch {}
  }, []);

  const connectYouTube = useCallback(async (): Promise<void> => {
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
        window.location.assign(payload.consentUrl);
        return;
      }
    } catch {}
  }, []);

  const runTwitchChatAction = useCallback(async (action: "start" | "stop"): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/twitch-chat/${action}`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include"
      });

      if (response.ok) {
        await loadStatus();
        return;
      }
    } catch {}
  }, [loadStatus]);

  const runDiscordChatAction = useCallback(async (action: "start" | "stop"): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/discord-chat/${action}`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include"
      });

      if (response.ok) {
        await loadStatus();
        return;
      }
    } catch {}
  }, [loadStatus]);

  const runYouTubeLiveChatAction = useCallback(async (action: "start" | "stop"): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/youtube-live-chat/${action}`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include"
      });

      if (response.ok) {
        await loadStatus();
        return;
      }
    } catch {}
  }, [loadStatus]);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    for (const operation of providerIntegrationInitialLoadOperations) {
      if (operation === "status") {
        void loadStatus();
      } else {
        void loadYouTubeCredential();
      }
    }
  }, [
    loadStatus,
    loadYouTubeCredential
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
          onConnectYouTube={() => void connectYouTube()}
          onDiscoverYouTubeChannels={() => void discoverYouTubeChannels()}
          onDiscordChatAction={(action) => void runDiscordChatAction(action)}
          onEnsureTwitchSubscriptions={() => void ensureTwitchEventSubSubscriptions()}
          onPollYouTubeActivities={() => void pollYouTubeActivities()}
          onRefreshAll={() => {
            void loadStatus();
            void loadTwitchEventSubSubscriptions();
            void loadYouTubeCredential();
            void loadYouTubeChannelSelection();
            void loadYouTubePubSubSubscription();
          }}
          onRefreshDiscord={() => void loadStatus()}
          onRefreshTwitch={() => {
            void loadTwitchEventSubSubscriptions();
            void loadStatus();
          }}
          onRefreshYouTube={() => {
            void loadStatus();
            void loadYouTubeCredential();
            void loadYouTubeChannelSelection();
            void loadYouTubePubSubSubscription();
          }}
          onSelectYouTubeChannel={(channelId) => void selectYouTubeChannel(channelId)}
          onSelectTwitchEventSubBroadcaster={(broadcasterLogin) => {
            setTwitchEventSubBroadcasterLogin(broadcasterLogin);
            void loadTwitchEventSubSubscriptions(broadcasterLogin);
          }}
          onTwitchChatAction={(action) => void runTwitchChatAction(action)}
          onYouTubeLiveChatAction={(action) => void runYouTubeLiveChatAction(action)}
          onYouTubePubSubAction={(mode) => void requestYouTubePubSubSubscription(mode)}
          snapshot={snapshot}
          twitchEventSubCallbackUrl={twitchEventSubCallbackUrl}
          twitchEventSubBroadcasterLogin={twitchEventSubBroadcasterLogin}
          twitchEventSubBroadcasterLogins={twitchEventSubBroadcasterLogins}
          twitchEventSubDefaults={twitchEventSubDefaults}
          twitchEventSubSubscriptionCount={twitchEventSubSubscriptionCount}
          youtubeActivitiesPoll={youtubeActivitiesPoll}
          youtubeChannels={youtubeChannels}
          youtubeCredential={youtubeCredential}
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
