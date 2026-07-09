"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";

import {
  formatDate,
  getFailureMessage,
  getLoadStateForFailure,
  parseJson
} from "./provider-integrations-status.service";
import ProviderIntegrationsStatusSection from "./provider-integrations-status-section";
import type {
  DiscordChatIntakeResponse,
  DiscordChatIntakeStatus,
  LoadState,
  ProviderIntegrationState,
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
  const [youtubeRedirectUri, setYouTubeRedirectUri] = useState<string>("https://api-dev.maiks.yt/admin/provider-integrations/youtube/callback");
  const [youtubeRequiredScope, setYouTubeRequiredScope] = useState<string>("https://www.googleapis.com/auth/youtube.readonly");
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

  const stateCounts = useMemo(() => {
    const counts: Record<ProviderIntegrationState, number> = {
      configured: 0,
      missing: 0,
      invalid: 0,
      disabled: 0,
      error: 0
    };

    for (const provider of snapshot?.providers ?? []) {
      counts[provider.state] += 1;
    }

    return counts;
  }, [snapshot]);

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
      <header className="project-admin-header">
        <p className="eyebrow">Owner status</p>
        <h1>Provider Integrations</h1>
        <p>Twitch, YouTube, and Discord configuration readiness.</p>
      </header>

      <section className={`project-admin-state ${loadState}`}>
        <div>
          <h2>{loadState === "ready" ? "Status" : loadState === "loading" ? "Loading" : "Needs attention"}</h2>
          <p>{message}</p>
        </div>
        <div className="project-admin-actions">
          <button type="button" onClick={() => void loadStatus()}>Refresh</button>
        </div>
      </section>

      {snapshot ? (
        <>
          <section className="provider-integrations-summary-grid" aria-label="Provider integration summary">
            <div className="live-helper-kpi">
              <span>Configured</span>
              <strong>{stateCounts.configured}</strong>
            </div>
            <div className="live-helper-kpi">
              <span>Missing</span>
              <strong>{stateCounts.missing}</strong>
            </div>
            <div className="live-helper-kpi">
              <span>Invalid</span>
              <strong>{stateCounts.invalid}</strong>
            </div>
            <div className="live-helper-kpi">
              <span>Disabled</span>
              <strong>{stateCounts.disabled}</strong>
            </div>
          </section>

          <section className="project-admin-panel">
            <div className="project-admin-panel-heading">
              <div>
                <h2>Discord Chat Intake</h2>
                <p>Read-only dev Gateway connection for private streamer chat.</p>
              </div>
              <div className="project-admin-actions">
                <button
                  type="button"
                  disabled={discordChatStatus?.state === "connected" || discordChatStatus?.state === "connecting"}
                  onClick={() => void runDiscordChatAction("start")}
                >
                  Start
                </button>
                <button
                  type="button"
                  disabled={discordChatStatus?.state === "stopped" || discordChatStatus?.state === "unconfigured"}
                  onClick={() => void runDiscordChatAction("stop")}
                >
                  Stop
                </button>
                <button type="button" onClick={() => void loadDiscordChatStatus()}>Refresh</button>
              </div>
            </div>
            <div className="provider-chat-status-grid">
              <div className={`provider-chat-state ${discordChatStatus?.state ?? "unconfigured"}`}>
                <span>State</span>
                <strong>{discordChatStatus?.state ?? "Unknown"}</strong>
              </div>
              <div>
                <span>Channels</span>
                <strong>{discordChatStatus?.channelIds.length ? `${discordChatStatus.channelIds.length} configured` : "Guild-wide"}</strong>
              </div>
              <div>
                <span>Last message</span>
                <strong>{discordChatStatus?.lastMessageAt ? formatDate(discordChatStatus.lastMessageAt) : "None yet"}</strong>
              </div>
            </div>
            <p className="provider-chat-action-message">{discordActionMessage}</p>
            {discordChatStatus?.lastError ? (
              <p className="provider-chat-error">{discordChatStatus.lastError}</p>
            ) : null}
            {discordChatStatus?.recentMessages.length ? (
              <ol className="provider-chat-recent-list" aria-label="Recent Discord chat messages">
                {discordChatStatus.recentMessages.slice(0, 5).map((chatMessage) => (
                  <li key={chatMessage.id}>
                    <div>
                      <strong>{chatMessage.authorName}</strong>
                      <span>{chatMessage.channelName}</span>
                      <time dateTime={chatMessage.createdAt}>{formatDate(chatMessage.createdAt)}</time>
                    </div>
                    <p>{chatMessage.message}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="provider-chat-empty">No Discord messages captured in this API runtime yet.</p>
            )}
          </section>

          <section className="project-admin-panel">
            <div className="project-admin-panel-heading">
              <div>
                <h2>Twitch Chat Intake</h2>
                <p>Read-only dev connection for private streamer chat.</p>
              </div>
              <div className="project-admin-actions">
                <button
                  type="button"
                  disabled={twitchChatStatus?.state === "connected" || twitchChatStatus?.state === "connecting"}
                  onClick={() => void runTwitchChatAction("start")}
                >
                  Start
                </button>
                <button
                  type="button"
                  disabled={twitchChatStatus?.state === "stopped" || twitchChatStatus?.state === "unconfigured"}
                  onClick={() => void runTwitchChatAction("stop")}
                >
                  Stop
                </button>
                <button type="button" onClick={() => void loadTwitchChatStatus()}>Refresh</button>
              </div>
            </div>
            <div className="provider-chat-status-grid">
              <div className={`provider-chat-state ${twitchChatStatus?.state ?? "unconfigured"}`}>
                <span>State</span>
                <strong>{twitchChatStatus?.state ?? "Unknown"}</strong>
              </div>
              <div>
                <span>Channel</span>
                <strong>{twitchChatStatus?.channelName ?? "Not configured"}</strong>
              </div>
              <div>
                <span>Last message</span>
                <strong>{twitchChatStatus?.lastMessageAt ? formatDate(twitchChatStatus.lastMessageAt) : "None yet"}</strong>
              </div>
            </div>
            <p className="provider-chat-action-message">{twitchActionMessage}</p>
            {twitchChatStatus?.lastError ? (
              <p className="provider-chat-error">{twitchChatStatus.lastError}</p>
            ) : null}
            {twitchChatStatus?.recentMessages.length ? (
              <ol className="provider-chat-recent-list" aria-label="Recent Twitch chat messages">
                {twitchChatStatus.recentMessages.slice(0, 5).map((chatMessage) => (
                  <li key={chatMessage.id}>
                    <div>
                      <strong>{chatMessage.authorName}</strong>
                      <time dateTime={chatMessage.createdAt}>{formatDate(chatMessage.createdAt)}</time>
                    </div>
                    <p>{chatMessage.message}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="provider-chat-empty">No Twitch messages captured in this API runtime yet.</p>
            )}
          </section>

          <section className="project-admin-panel">
            <div className="project-admin-panel-heading">
              <div>
                <h2>Twitch EventSub</h2>
                <p>Verified log-only webhook subscriptions for offline and online Twitch events.</p>
              </div>
              <div className="project-admin-actions">
                <button type="button" onClick={() => void ensureTwitchEventSubSubscriptions()}>
                  Create missing
                </button>
                <button type="button" onClick={() => void loadTwitchEventSubSubscriptions()}>Refresh</button>
              </div>
            </div>
            <div className="provider-chat-status-grid">
              <div>
                <span>Defaults</span>
                <strong>{twitchEventSubDefaults.length ? `${twitchEventSubDefaults.length} tracked` : "Unknown"}</strong>
              </div>
              <div>
                <span>Subscriptions</span>
                <strong>{twitchEventSubSubscriptionCount}</strong>
              </div>
              <div>
                <span>Callback</span>
                <strong>{twitchEventSubCallbackUrl ? "Configured" : "Unknown"}</strong>
              </div>
            </div>
            <p className="provider-chat-action-message">{twitchEventSubActionMessage}</p>
            {twitchEventSubDefaults.length ? (
              <ol className="provider-chat-recent-list" aria-label="Twitch EventSub default subscriptions">
                {twitchEventSubDefaults.map((entry) => (
                  <li key={`${entry.desired.type}:${entry.desired.version}`}>
                    <div>
                      <strong>{entry.desired.type}</strong>
                      <span>v{entry.desired.version}</span>
                      <span>{entry.state}</span>
                      {entry.existing?.status ? <span>{entry.existing.status}</span> : null}
                    </div>
                    <p>{entry.existing?.id ?? "No matching subscription yet."}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="provider-chat-empty">Twitch EventSub subscription status has not loaded yet.</p>
            )}
          </section>

          <section className="project-admin-panel">
            <div className="project-admin-panel-heading">
              <div>
                <h2>YouTube Owner Consent</h2>
                <p>Read-only OAuth credential and channel discovery for future live-chat intake.</p>
              </div>
              <div className="project-admin-actions">
                <button type="button" onClick={() => void connectYouTube()}>Connect</button>
                <button type="button" onClick={() => void loadYouTubeCredential()}>Refresh</button>
                <button
                  type="button"
                  disabled={youtubeCredential?.status !== "active"}
                  onClick={() => void discoverYouTubeChannels()}
                >
                  Discover channels
                </button>
              </div>
            </div>
            <div className="provider-chat-status-grid">
              <div className={`provider-chat-state ${youtubeCredential?.status ?? "unconfigured"}`}>
                <span>Credential</span>
                <strong>{youtubeCredential?.status ?? "Not connected"}</strong>
              </div>
              <div>
                <span>Last verified</span>
                <strong>{youtubeCredential?.lastVerifiedAt ? formatDate(youtubeCredential.lastVerifiedAt) : "Never"}</strong>
              </div>
              <div>
                <span>Scope</span>
                <strong>{youtubeRequiredScope}</strong>
              </div>
            </div>
            <p className="provider-chat-action-message">{youtubeActionMessage}</p>
            <p className="provider-chat-action-message">{youtubeChannelActionMessage}</p>
            {youtubeCredential?.lastError ? (
              <p className="provider-chat-error">{youtubeCredential.lastError}</p>
            ) : null}
            {youtubeSelectedChannelId ? (
              <p className="provider-chat-empty">Selected live-chat channel: {youtubeSelectedChannelId}</p>
            ) : null}
            {youtubeChannels.length ? (
              <ol className="provider-chat-recent-list youtube-channel-list" aria-label="Saved YouTube channels">
                {youtubeChannels.map((channel) => (
                  <li key={channel.id}>
                    <div>
                      {channel.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" src={channel.thumbnailUrl} />
                      ) : null}
                      <strong>{channel.title}</strong>
                      {channel.customUrl ? <span>{channel.customUrl}</span> : null}
                      <time dateTime={channel.lastSeenAt}>{formatDate(channel.lastSeenAt)}</time>
                      {channel.selectedForLiveChat ? <span>Selected</span> : null}
                    </div>
                    <p>{channel.id}</p>
                    <div className="project-admin-actions">
                      <button
                        type="button"
                        disabled={channel.selectedForLiveChat}
                        onClick={() => void selectYouTubeChannel(channel.id)}
                      >
                        Select for live chat
                      </button>
                      {channel.selectedForLiveChat ? (
                        <button type="button" onClick={() => void selectYouTubeChannel(null)}>
                          Clear selection
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="provider-chat-empty">No YouTube channels saved yet.</p>
            )}
            <div className="project-admin-panel-heading">
              <div>
                <h3>YouTube Live Chat Polling</h3>
                <p>Read-only polling from the selected channel into private streamer chat.</p>
              </div>
              <div className="project-admin-actions">
                <button
                  type="button"
                  disabled={
                    youtubeLiveChatStatus?.state === "connected"
                    || youtubeLiveChatStatus?.state === "connecting"
                    || youtubeLiveChatStatus?.state === "waiting"
                  }
                  onClick={() => void runYouTubeLiveChatAction("start")}
                >
                  Start
                </button>
                <button
                  type="button"
                  disabled={youtubeLiveChatStatus?.state === "stopped" || youtubeLiveChatStatus?.state === "unconfigured"}
                  onClick={() => void runYouTubeLiveChatAction("stop")}
                >
                  Stop
                </button>
                <button type="button" onClick={() => void loadYouTubeLiveChatStatus()}>Refresh</button>
              </div>
            </div>
            <div className="provider-chat-status-grid">
              <div className={`provider-chat-state ${youtubeLiveChatStatus?.state ?? "unconfigured"}`}>
                <span>Polling</span>
                <strong>{youtubeLiveChatStatus?.state ?? "Unknown"}</strong>
              </div>
              <div>
                <span>Selected channel</span>
                <strong>{youtubeLiveChatStatus?.channelName ?? youtubeSelectedChannelId ?? "None"}</strong>
              </div>
              <div>
                <span>Last message</span>
                <strong>{youtubeLiveChatStatus?.lastMessageAt ? formatDate(youtubeLiveChatStatus.lastMessageAt) : "None yet"}</strong>
              </div>
            </div>
            <p className="provider-chat-action-message">{youtubeLiveChatActionMessage}</p>
            {youtubeLiveChatStatus?.nextPollAt ? (
              <p className="provider-chat-empty">Next poll: {formatDate(youtubeLiveChatStatus.nextPollAt)}</p>
            ) : null}
            {youtubeLiveChatStatus?.lastError ? (
              <p className="provider-chat-error">{youtubeLiveChatStatus.lastError}</p>
            ) : null}
            {youtubeLiveChatStatus?.recentMessages.length ? (
              <ol className="provider-chat-recent-list" aria-label="Recent YouTube live chat messages">
                {youtubeLiveChatStatus.recentMessages.slice(0, 5).map((chatMessage) => (
                  <li key={chatMessage.id}>
                    <div>
                      <strong>{chatMessage.authorName}</strong>
                      <time dateTime={chatMessage.createdAt}>{formatDate(chatMessage.createdAt)}</time>
                    </div>
                    <p>{chatMessage.message}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="provider-chat-empty">No YouTube live chat messages captured in this API runtime yet.</p>
            )}
            <div className="provider-env-grid" aria-label="YouTube OAuth setup details">
              <div className="provider-env-item">
                <span>Google redirect URI</span>
                <strong>{youtubeRedirectUri}</strong>
                <small>Add this exact URI in Google OAuth before connecting.</small>
              </div>
            </div>
            <div className="project-admin-panel-heading">
              <div>
                <h3>YouTube PubSub</h3>
                <p>Read-only push notifications for uploads and video metadata updates.</p>
              </div>
              <div className="project-admin-actions">
                <button
                  type="button"
                  disabled={!youtubePubSubSubscription}
                  onClick={() => void requestYouTubePubSubSubscription("subscribe")}
                >
                  Subscribe
                </button>
                <button
                  type="button"
                  disabled={!youtubePubSubSubscription}
                  onClick={() => void requestYouTubePubSubSubscription("unsubscribe")}
                >
                  Unsubscribe
                </button>
                <button type="button" onClick={() => void loadYouTubePubSubSubscription()}>Refresh</button>
              </div>
            </div>
            <div className="provider-chat-status-grid">
              <div className={`provider-chat-state ${youtubePubSubSubscription ? "configured" : "unconfigured"}`}>
                <span>Target</span>
                <strong>{youtubePubSubSubscription ? "Ready" : "Not ready"}</strong>
              </div>
              <div>
                <span>Channel</span>
                <strong>{youtubePubSubSubscription?.channelId ?? youtubeSelectedChannelId ?? "None"}</strong>
              </div>
              <div>
                <span>Hub</span>
                <strong>{youtubePubSubSubscription ? "Google hub" : "Unknown"}</strong>
              </div>
            </div>
            <p className="provider-chat-action-message">{youtubePubSubActionMessage}</p>
            {youtubePubSubSubscription ? (
              <div className="provider-env-grid" aria-label="YouTube PubSub setup details">
                <div className="provider-env-item">
                  <span>Callback</span>
                  <strong>{youtubePubSubSubscription.callbackUrl}</strong>
                  <small>Google hub verifies this public callback.</small>
                </div>
                <div className="provider-env-item">
                  <span>Topic</span>
                  <strong>{youtubePubSubSubscription.topicUrl}</strong>
                  <small>Selected channel feed topic.</small>
                </div>
              </div>
            ) : null}
            <div className="project-admin-panel-heading">
              <div>
                <h3>YouTube Activities</h3>
                <p>Manual read-only poll for recent channel activity into the intake ledger.</p>
              </div>
              <div className="project-admin-actions">
                <button type="button" onClick={() => void pollYouTubeActivities()}>
                  Poll recent
                </button>
              </div>
            </div>
            <p className="provider-chat-action-message">{youtubeActivitiesActionMessage}</p>
            {youtubeActivitiesPoll ? (
              <>
                <div className="provider-chat-status-grid">
                  <div>
                    <span>Fetched</span>
                    <strong>{youtubeActivitiesPoll.fetched}</strong>
                  </div>
                  <div>
                    <span>Inserted</span>
                    <strong>{youtubeActivitiesPoll.inserted}</strong>
                  </div>
                  <div>
                    <span>Polled</span>
                    <strong>{formatDate(youtubeActivitiesPoll.polledAt)}</strong>
                  </div>
                </div>
                {youtubeActivitiesPoll.events.length ? (
                  <ol className="provider-chat-recent-list" aria-label="Recent YouTube activities">
                    {youtubeActivitiesPoll.events.slice(0, 5).map((event) => (
                      <li key={event.sourceEventId}>
                        <div>
                          <strong>{event.providerEventName}</strong>
                          <span>{event.catalogKnown ? "Cataloged" : "Unknown-safe"}</span>
                          <span>{event.inserted ? "Stored" : "Already stored"}</span>
                        </div>
                        <p>{event.providerMessageId ?? event.sourceEventId}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="provider-chat-empty">No recent YouTube activities returned by the API.</p>
                )}
              </>
            ) : null}
          </section>

          <ProviderIntegrationsStatusSection snapshot={snapshot} />
        </>
      ) : null}
    </>
  );
};

export default ProviderIntegrationsStatusClient;
