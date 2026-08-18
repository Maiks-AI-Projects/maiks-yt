"use client";

import { useMemo, useState } from "react";
import {
  FiActivity,
  FiAlertCircle,
  FiBell,
  FiCheckCircle,
  FiChevronDown,
  FiRefreshCw,
  FiShield,
  FiUser
} from "react-icons/fi";
import { FaDiscord, FaTwitch, FaYoutube } from "react-icons/fa6";

import styles from "./provider-integrations-workspace.module.css";
import { formatDate } from "./provider-integrations-status.service";
import type {
  DiscordChatIntakeStatus,
  ProviderIntegrationStatus,
  ProviderIntegrationsStatusResponse,
  TwitchChatIntakeStatus,
  TwitchEventSubDefaultSubscriptionStatus,
  YouTubeActivitiesPollResponse,
  YouTubeCredentialSummary,
  YouTubeLiveChatIntakeStatus,
  YouTubePubSubSubscriptionResponse,
  YouTubeSavedChannel
} from "./provider-integrations-status.types";

type ProviderId = "twitch" | "youtube" | "discord";
type ActivityFilter = "all" | ProviderId;
type ProviderSnapshot = Extract<ProviderIntegrationsStatusResponse, { ok: true }>;
type YouTubePubSubStatus = Extract<YouTubePubSubSubscriptionResponse, { ok: true }>;
type YouTubeActivitiesStatus = Extract<YouTubeActivitiesPollResponse, { ok: true }>;

type ProviderIntegrationsWorkspaceProps = {
  snapshot: ProviderSnapshot;
  twitchChatStatus: TwitchChatIntakeStatus | null;
  discordChatStatus: DiscordChatIntakeStatus | null;
  youtubeLiveChatStatus: YouTubeLiveChatIntakeStatus | null;
  youtubeCredential: YouTubeCredentialSummary | null;
  youtubeChannels: readonly YouTubeSavedChannel[];
  youtubeSelectedChannelId: string | null;
  youtubePubSubSubscription: YouTubePubSubStatus | null;
  youtubeActivitiesPoll: YouTubeActivitiesStatus | null;
  twitchEventSubDefaults: readonly TwitchEventSubDefaultSubscriptionStatus[];
  twitchEventSubSubscriptionCount: number;
  twitchEventSubCallbackUrl: string | null;
  youtubeRedirectUri: string;
  youtubeRequiredScope: string;
  actionMessages: {
    twitch: string;
    discord: string;
    youtube: string;
    youtubeChannel: string;
    youtubeLiveChat: string;
    twitchEventSub: string;
    youtubePubSub: string;
    youtubeActivities: string;
  };
  onRefreshAll: () => void;
  onRefreshTwitch: () => void;
  onRefreshDiscord: () => void;
  onRefreshYouTube: () => void;
  onTwitchChatAction: (action: "start" | "stop") => void;
  onDiscordChatAction: (action: "start" | "stop") => void;
  onYouTubeLiveChatAction: (action: "start" | "stop") => void;
  onEnsureTwitchSubscriptions: () => void;
  onConnectYouTube: () => void;
  onDiscoverYouTubeChannels: () => void;
  onSelectYouTubeChannel: (channelId: string | null) => void;
  onYouTubePubSubAction: (mode: "subscribe" | "unsubscribe") => void;
  onPollYouTubeActivities: () => void;
};

type ActivityMessage = {
  id: string;
  provider: ProviderId;
  authorName: string;
  channelName: string;
  createdAt: string;
  message: string;
};

const providerOrder: readonly ProviderId[] = ["twitch", "youtube", "discord"];

const providerIcons = {
  twitch: FaTwitch,
  youtube: FaYoutube,
  discord: FaDiscord
} as const;

const providerLabels = {
  twitch: "Twitch",
  youtube: "YouTube",
  discord: "Discord"
} as const;

const runtimeIsActive = (state: string | undefined): boolean =>
  state === "connected" || state === "connecting" || state === "waiting";

const runtimeLabel = (state: string | undefined): string => {
  if (!state) return "Unknown";
  if (state === "connected") return "Connected";
  if (state === "connecting") return "Connecting";
  if (state === "waiting") return "Waiting for live chat";
  if (state === "unconfigured") return "Not configured";
  return "Stopped";
};

const providerStateLabel = (provider: ProviderIntegrationStatus | undefined): string => {
  if (!provider) return "Checking credentials";
  if (provider.state === "configured") return "Credentials ready";
  if (provider.state === "missing") return "Credentials missing";
  if (provider.state === "invalid") return "Credentials invalid";
  if (provider.state === "disabled") return "Disabled";
  return "Configuration error";
};

const stateTone = (state: string | undefined): "ready" | "warning" | "error" | "neutral" => {
  if (state === "connected" || state === "configured" || state === "active") return "ready";
  if (state === "error" || state === "invalid" || state === "revoked" || state === "unconfigured") return "error";
  if (state === "stopped" || state === "connecting" || state === "waiting" || state === "missing") return "warning";
  return "neutral";
};

const ProviderMark = ({ provider }: { provider: ProviderId }): React.ReactNode => {
  const Icon = providerIcons[provider];
  return <Icon aria-hidden="true" className={`provider-workspace-mark ${provider}`} />;
};

const StatusDot = ({ tone }: { tone: "ready" | "warning" | "error" | "neutral" }): React.ReactNode => (
  <span aria-hidden="true" className={`provider-workspace-dot ${tone}`} />
);

const getEventGroupState = (
  defaults: readonly TwitchEventSubDefaultSubscriptionStatus[],
  prefixes: readonly string[]
): "enabled" | "partial" | "missing" | "unknown" => {
  const entries = defaults.filter((entry) => prefixes.some((prefix) => entry.desired.type.startsWith(prefix)));
  if (entries.length === 0) return "unknown";
  const enabled = entries.filter((entry) => entry.state === "enabled").length;
  if (enabled === entries.length) return "enabled";
  if (enabled > 0) return "partial";
  return "missing";
};

const eventGroupLabel = (state: ReturnType<typeof getEventGroupState>): string => {
  if (state === "enabled") return "Enabled";
  if (state === "partial") return "Partial";
  if (state === "missing") return "Missing";
  return "Check subscription";
};

const getLastError = (provider: ProviderId, props: ProviderIntegrationsWorkspaceProps): string | null => {
  if (provider === "twitch") return props.twitchChatStatus?.lastError ?? null;
  if (provider === "youtube") return props.youtubeCredential?.lastError ?? props.youtubeLiveChatStatus?.lastError ?? null;
  return props.discordChatStatus?.lastError ?? null;
};

const ProviderIntegrationsWorkspace = (props: ProviderIntegrationsWorkspaceProps): React.ReactNode => {
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("twitch");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [detailTab, setDetailTab] = useState<string>("primary");
  const providers = useMemo(
    () => new Map(props.snapshot.providers.map((provider) => [provider.id, provider])),
    [props.snapshot.providers]
  );

  const selectedYouTubeChannel = props.youtubeChannels.find((channel) => channel.id === props.youtubeSelectedChannelId) ?? null;
  const targetLabels: Record<ProviderId, string> = {
    twitch: props.twitchChatStatus?.channelName ?? "Not configured",
    youtube: selectedYouTubeChannel?.title ?? props.youtubeLiveChatStatus?.channelName ?? "No channel selected",
    discord: props.discordChatStatus?.channelIds.length
      ? `${props.discordChatStatus.channelIds.length} channels`
      : "Guild-wide"
  };
  const runtimeStates: Record<ProviderId, string | undefined> = {
    twitch: props.twitchChatStatus?.state,
    youtube: props.youtubeLiveChatStatus?.state,
    discord: props.discordChatStatus?.state
  };

  const messages = useMemo<readonly ActivityMessage[]>(() => {
    const twitchMessages = (props.twitchChatStatus?.recentMessages ?? []).map((message) => ({
      ...message,
      provider: "twitch" as const
    }));
    const youtubeMessages = (props.youtubeLiveChatStatus?.recentMessages ?? []).map((message) => ({
      ...message,
      provider: "youtube" as const,
      channelName: props.youtubeLiveChatStatus?.channelName ?? "YouTube"
    }));
    const discordMessages = (props.discordChatStatus?.recentMessages ?? []).map((message) => ({
      ...message,
      provider: "discord" as const
    }));

    return [...twitchMessages, ...youtubeMessages, ...discordMessages]
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 12);
  }, [props.discordChatStatus, props.twitchChatStatus, props.youtubeLiveChatStatus]);

  const filteredMessages = activityFilter === "all"
    ? messages
    : messages.filter((message) => message.provider === activityFilter);
  const twitchSubscriptionsLoaded = props.twitchEventSubDefaults.length > 0;
  const twitchEnabledCount = props.twitchEventSubDefaults.filter((entry) => entry.state === "enabled").length;
  const twitchMissingCount = props.twitchEventSubDefaults.filter((entry) => entry.state === "missing").length;
  const twitchProblemCount = props.twitchEventSubDefaults.filter((entry) => entry.state === "problem").length;
  const youtubeConsentActive = props.youtubeCredential?.status === "active";
  const discordWebhookMissing = providers.get("discord")?.capabilities.some(
    (capability) => capability.key === "discord-webhook-events" && capability.state === "missing"
  ) ?? false;

  const selectProvider = (provider: ProviderId): void => {
    setSelectedProvider(provider);
    setDetailTab("primary");
  };

  const renderProviderDetail = (): React.ReactNode => {
    const provider = providers.get(selectedProvider);
    const lastError = getLastError(selectedProvider, props);

    if (selectedProvider === "twitch") {
      const groups = [
        { label: "Stream online / offline", prefixes: ["stream."] },
        { label: "Channel updates", prefixes: ["channel.update"] },
        { label: "Follows and subscriptions", prefixes: ["channel.follow", "channel.subscribe", "channel.subscription"] },
        { label: "Cheers, raids and rewards", prefixes: ["channel.cheer", "channel.bits", "channel.raid", "channel.channel_points", "channel.custom_power"] },
        { label: "Goals, hype trains and shoutouts", prefixes: ["channel.goal", "channel.hype_train", "channel.shoutout"] }
      ] as const;
      const tabs = [
        { id: "primary", label: "Subscriptions" },
        { id: "errors", label: "Recent errors" },
        { id: "setup", label: "Setup" }
      ];

      return (
        <>
          <div className="provider-workspace-detail-header">
            <div><ProviderMark provider="twitch" /><h2>Twitch · {targetLabels.twitch}</h2></div>
            <div className="provider-workspace-actions">
              <button
                className="secondary-action"
                disabled={runtimeIsActive(props.twitchChatStatus?.state)}
                onClick={() => props.onTwitchChatAction("start")}
                type="button"
              >Start intake</button>
              {runtimeIsActive(props.twitchChatStatus?.state) ? <button className="secondary-action" onClick={() => props.onTwitchChatAction("stop")} type="button">Stop</button> : null}
              <button
                className="secondary-action"
                disabled={!twitchSubscriptionsLoaded || twitchMissingCount === 0}
                onClick={props.onEnsureTwitchSubscriptions}
                type="button"
              >{twitchSubscriptionsLoaded ? `Create ${twitchMissingCount} missing` : "Checking subscriptions…"}</button>
              <button aria-label="Refresh Twitch" className="provider-workspace-icon-button" onClick={props.onRefreshTwitch} title="Refresh Twitch" type="button">
                <FiRefreshCw aria-hidden="true" />
              </button>
            </div>
          </div>
          <dl className="provider-workspace-state-table">
            <div><dt><FiShield aria-hidden="true" />Credentials</dt><dd className={provider?.state === "configured" ? "ready" : "error"}>{providerStateLabel(provider)}</dd></div>
            <div><dt><FiUser aria-hidden="true" />Owner consent</dt><dd>Not required</dd></div>
            <div><dt><FiActivity aria-hidden="true" />Runtime intake</dt><dd className={stateTone(props.twitchChatStatus?.state)}>{runtimeLabel(props.twitchChatStatus?.state)}</dd></div>
            <div><dt><FiBell aria-hidden="true" />Event subscriptions</dt><dd className={twitchMissingCount || twitchProblemCount ? "warning" : twitchSubscriptionsLoaded ? "ready" : "neutral"}>{twitchSubscriptionsLoaded ? `${twitchEnabledCount} active · ${twitchMissingCount} missing${twitchProblemCount ? ` · ${twitchProblemCount} problem` : ""}` : "Checking subscriptions"}</dd></div>
            <div><dt><FiAlertCircle aria-hidden="true" />Reconnect / error</dt><dd className={lastError ? "error" : "ready"}>{lastError ?? "No recent error"}</dd></div>
          </dl>
          <nav className="provider-workspace-tabs" aria-label="Twitch details">
            {tabs.map((tab) => <button aria-current={detailTab === tab.id ? "page" : undefined} key={tab.id} onClick={() => setDetailTab(tab.id)} type="button">{tab.label}</button>)}
          </nav>
          {detailTab === "primary" ? (
            <div className="provider-workspace-capability-list">
              <div className="header"><span>Capability</span><span>Status</span></div>
              {groups.map((group) => {
                const state = getEventGroupState(props.twitchEventSubDefaults, group.prefixes);
                return <div key={group.label}><span>{group.label}</span><strong className={state === "enabled" ? "ready" : state === "unknown" ? "neutral" : "warning"}>{eventGroupLabel(state)}</strong></div>;
              })}
            </div>
          ) : detailTab === "errors" ? (
            <div className="provider-workspace-detail-copy">
              <h3>{lastError ? "Latest runtime error" : "No recent Twitch error"}</h3>
              <p>{lastError ?? props.actionMessages.twitchEventSub}</p>
              <p>{props.actionMessages.twitch}</p>
            </div>
          ) : (
            <div className="provider-workspace-detail-copy">
              <h3>Read-only Twitch setup</h3>
              <p>Channel: {targetLabels.twitch}</p>
              <p>Provider subscriptions reported: {props.twitchEventSubSubscriptionCount}</p>
              <p>EventSub callback: {props.twitchEventSubCallbackUrl ? "Configured" : "Not available"}</p>
              {provider?.issues.map((issue) => <p className="error" key={issue}>{issue}</p>)}
            </div>
          )}
          <p className="provider-workspace-boundary"><FiShield aria-hidden="true" />Verified log-only EventSub intake · no chat or moderation writes</p>
        </>
      );
    }

    if (selectedProvider === "youtube") {
      const tabs = [
        { id: "primary", label: "Runtime" },
        { id: "channels", label: `Channels${props.youtubeChannels.length ? ` ${props.youtubeChannels.length}` : ""}` },
        { id: "push", label: "PubSub & activity" },
        { id: "setup", label: "Setup" }
      ];
      return (
        <>
          <div className="provider-workspace-detail-header">
            <div><ProviderMark provider="youtube" /><h2>YouTube · {targetLabels.youtube}</h2></div>
            <div className="provider-workspace-actions">
              {!youtubeConsentActive ? <button className="secondary-action" onClick={props.onConnectYouTube} type="button">Connect</button> : null}
              <button
                className="secondary-action"
                disabled={!youtubeConsentActive || !props.youtubeSelectedChannelId || runtimeIsActive(props.youtubeLiveChatStatus?.state)}
                onClick={() => props.onYouTubeLiveChatAction("start")}
                type="button"
              >Start polling</button>
              <button aria-label="Refresh YouTube" className="provider-workspace-icon-button" onClick={props.onRefreshYouTube} title="Refresh YouTube" type="button"><FiRefreshCw aria-hidden="true" /></button>
            </div>
          </div>
          <dl className="provider-workspace-state-table">
            <div><dt><FiShield aria-hidden="true" />Client credentials</dt><dd className={provider?.state === "configured" ? "ready" : "error"}>{providerStateLabel(provider)}</dd></div>
            <div><dt><FiUser aria-hidden="true" />Owner consent</dt><dd className={youtubeConsentActive ? "ready" : "error"}>{youtubeConsentActive ? "Connected" : "Disconnected"}</dd></div>
            <div><dt><FiActivity aria-hidden="true" />Runtime intake</dt><dd className={stateTone(props.youtubeLiveChatStatus?.state)}>{runtimeLabel(props.youtubeLiveChatStatus?.state)}</dd></div>
            <div><dt><FiBell aria-hidden="true" />PubSub target</dt><dd className={props.youtubePubSubSubscription ? "ready" : "warning"}>{props.youtubePubSubSubscription ? "Ready" : "Not ready"}</dd></div>
            <div><dt><FiAlertCircle aria-hidden="true" />Reconnect / error</dt><dd className={lastError || !youtubeConsentActive ? "error" : "ready"}>{lastError ?? (youtubeConsentActive ? "No recent error" : "Consent required")}</dd></div>
          </dl>
          <nav className="provider-workspace-tabs" aria-label="YouTube details">
            {tabs.map((tab) => <button aria-current={detailTab === tab.id ? "page" : undefined} key={tab.id} onClick={() => setDetailTab(tab.id)} type="button">{tab.label}</button>)}
          </nav>
          {detailTab === "primary" ? (
            <div className="provider-workspace-detail-copy">
              <h3>Live-chat polling</h3>
              <p>Selected channel: {targetLabels.youtube}</p>
              <p>Last message: {props.youtubeLiveChatStatus?.lastMessageAt ? formatDate(props.youtubeLiveChatStatus.lastMessageAt) : "None yet"}</p>
              <p>{props.actionMessages.youtubeLiveChat}</p>
              {runtimeIsActive(props.youtubeLiveChatStatus?.state) ? <button className="secondary-action" onClick={() => props.onYouTubeLiveChatAction("stop")} type="button">Stop polling</button> : null}
            </div>
          ) : detailTab === "channels" ? (
            <div className="provider-workspace-detail-copy">
              <div className="provider-workspace-inline-heading"><h3>Saved channels</h3><button className="secondary-action" disabled={!youtubeConsentActive} onClick={props.onDiscoverYouTubeChannels} type="button">Discover channels</button></div>
              <label htmlFor="provider-youtube-channel">Live-chat channel</label>
              <select id="provider-youtube-channel" onChange={(event) => props.onSelectYouTubeChannel(event.target.value || null)} value={props.youtubeSelectedChannelId ?? ""}>
                <option value="">No channel selected</option>
                {props.youtubeChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.title}</option>)}
              </select>
              <p>{props.actionMessages.youtubeChannel}</p>
            </div>
          ) : detailTab === "push" ? (
            <div className="provider-workspace-detail-copy">
              <div className="provider-workspace-inline-heading"><h3>PubSub</h3><div className="provider-workspace-actions"><button className="secondary-action" disabled={!props.youtubePubSubSubscription} onClick={() => props.onYouTubePubSubAction("subscribe")} type="button">Subscribe</button><button className="secondary-action" disabled={!props.youtubePubSubSubscription} onClick={() => props.onYouTubePubSubAction("unsubscribe")} type="button">Unsubscribe</button></div></div>
              <p>{props.actionMessages.youtubePubSub}</p>
              <div className="provider-workspace-inline-heading"><h3>Recent channel activity</h3><button className="secondary-action" disabled={!youtubeConsentActive || !props.youtubeSelectedChannelId} onClick={props.onPollYouTubeActivities} type="button">Poll recent</button></div>
              <p>{props.youtubeActivitiesPoll ? `${props.youtubeActivitiesPoll.fetched} fetched · ${props.youtubeActivitiesPoll.inserted} stored · ${formatDate(props.youtubeActivitiesPoll.polledAt)}` : props.actionMessages.youtubeActivities}</p>
            </div>
          ) : (
            <div className="provider-workspace-detail-copy">
              <h3>Owner-authorized YouTube setup</h3>
              <p>Consent scope: <code>{props.youtubeRequiredScope}</code></p>
              <p>Redirect URI: <code>{props.youtubeRedirectUri}</code></p>
              <p>{props.actionMessages.youtube}</p>
              {provider?.issues.map((issue) => <p className="error" key={issue}>{issue}</p>)}
            </div>
          )}
          <p className="provider-workspace-boundary"><FiShield aria-hidden="true" />Private intake by default · provider writes remain separately gated</p>
        </>
      );
    }

    const tabs = [
      { id: "primary", label: "Runtime" },
      { id: "errors", label: "Reconnect & errors" },
      { id: "setup", label: "Setup" }
    ];
    return (
      <>
        <div className="provider-workspace-detail-header">
          <div><ProviderMark provider="discord" /><h2>Discord · {targetLabels.discord}</h2></div>
          <div className="provider-workspace-actions">
            <button className="secondary-action" disabled={runtimeIsActive(props.discordChatStatus?.state)} onClick={() => props.onDiscordChatAction("start")} type="button">Start intake</button>
            {runtimeIsActive(props.discordChatStatus?.state) ? <button className="secondary-action" onClick={() => props.onDiscordChatAction("stop")} type="button">Stop</button> : null}
            <button aria-label="Refresh Discord" className="provider-workspace-icon-button" onClick={props.onRefreshDiscord} title="Refresh Discord" type="button"><FiRefreshCw aria-hidden="true" /></button>
          </div>
        </div>
        <dl className="provider-workspace-state-table">
          <div><dt><FiShield aria-hidden="true" />Credentials</dt><dd className={provider?.state === "configured" ? "ready" : "error"}>{providerStateLabel(provider)}</dd></div>
          <div><dt><FiUser aria-hidden="true" />Owner consent</dt><dd>Not required</dd></div>
          <div><dt><FiActivity aria-hidden="true" />Runtime intake</dt><dd className={stateTone(props.discordChatStatus?.state)}>{runtimeLabel(props.discordChatStatus?.state)}</dd></div>
          <div><dt><FiBell aria-hidden="true" />Webhook events</dt><dd className={discordWebhookMissing ? "warning" : "ready"}>{discordWebhookMissing ? "Public key missing" : "Configured"}</dd></div>
          <div><dt><FiAlertCircle aria-hidden="true" />Reconnect / error</dt><dd className={lastError ? "error" : "ready"}>{lastError ?? "No recent error"}</dd></div>
        </dl>
        <nav className="provider-workspace-tabs" aria-label="Discord details">
          {tabs.map((tab) => <button aria-current={detailTab === tab.id ? "page" : undefined} key={tab.id} onClick={() => setDetailTab(tab.id)} type="button">{tab.label}</button>)}
        </nav>
        {detailTab === "primary" ? (
          <div className="provider-workspace-detail-copy">
            <h3>Gateway message intake</h3>
            <p>Target: {targetLabels.discord}</p>
            <p>Last message: {props.discordChatStatus?.lastMessageAt ? formatDate(props.discordChatStatus.lastMessageAt) : "None yet"}</p>
            <p>{props.actionMessages.discord}</p>
          </div>
        ) : detailTab === "errors" ? (
          <div className="provider-workspace-detail-copy">
            <h3>Reconnect state</h3>
            <p>Disconnects in window: {props.discordChatStatus?.disconnectsInWindow ?? 0}</p>
            <p>Next reconnect: {props.discordChatStatus?.nextReconnectAt ? formatDate(props.discordChatStatus.nextReconnectAt) : "Not scheduled"}</p>
            <p>Reconnect suppressed: {props.discordChatStatus?.reconnectSuppressed ? "Yes" : "No"}</p>
            {lastError ? <p className="error">{lastError}</p> : <p>No recent error.</p>}
          </div>
        ) : (
          <div className="provider-workspace-detail-copy">
            <h3>Read-only Discord setup</h3>
            {provider?.capabilities.map((capability) => <p key={capability.key}><strong>{capability.label}:</strong> {capability.detail}</p>)}
          </div>
        )}
        <p className="provider-workspace-boundary"><FiShield aria-hidden="true" />Private Gateway intake · no provider writes</p>
      </>
    );
  };

  return (
    <div className={styles.workspace}>
      <header className="provider-workspace-page-header">
        <div><h1>Provider Integrations</h1><p>Runtime connections for Twitch, YouTube, and Discord.</p></div>
        <div className="provider-workspace-updated"><span>Updated {formatDate(props.snapshot.generatedAt)}</span><button aria-label="Refresh all providers" className="provider-workspace-icon-button" onClick={props.onRefreshAll} title="Refresh all providers" type="button"><FiRefreshCw aria-hidden="true" /></button></div>
      </header>
      <label className="provider-workspace-target-selector">
        <span>Channel / account</span>
        <span className="select-wrap">
          <select onChange={(event) => selectProvider(event.target.value as ProviderId)} value={selectedProvider}>
            {providerOrder.map((provider) => <option key={provider} value={provider}>{providerLabels[provider]} · {targetLabels[provider]}</option>)}
          </select>
          <FiChevronDown aria-hidden="true" />
        </span>
      </label>
      <div className="provider-workspace-grid">
        <section className="provider-workspace-provider-list" aria-labelledby="provider-workspace-list-heading">
          <h2 id="provider-workspace-list-heading">Channels &amp; accounts</h2>
          {providerOrder.map((providerId) => {
            const provider = providers.get(providerId);
            const runtime = runtimeStates[providerId];
            const isSelected = selectedProvider === providerId;
            const secondary = providerId === "twitch"
              ? twitchSubscriptionsLoaded
                ? `${twitchEnabledCount} / ${props.twitchEventSubDefaults.length} subscribed`
                : "Checking subscriptions"
              : providerId === "youtube"
                ? `Runtime ${runtimeLabel(runtime).toLowerCase()}`
                : discordWebhookMissing ? "Webhook key missing" : "Webhook ready";
            const consentDisconnected = providerId === "youtube" && !youtubeConsentActive;
            return (
              <button aria-pressed={isSelected} className="provider-workspace-provider-row" key={providerId} onClick={() => selectProvider(providerId)} type="button">
                <ProviderMark provider={providerId} />
                <span className="provider-workspace-provider-copy">
                  <strong>{providerLabels[providerId]}</strong><small>{targetLabels[providerId]}</small>
                  <span><StatusDot tone={provider?.state === "configured" ? "ready" : "error"} />{providerId === "youtube" && provider?.state === "configured" ? "Client configured" : providerStateLabel(provider)}</span>
                  <span className={consentDisconnected ? "error" : "warning"}><StatusDot tone={consentDisconnected ? "error" : stateTone(runtime)} />{consentDisconnected ? "Consent disconnected" : `Runtime ${runtimeLabel(runtime).toLowerCase()}`}</span>
                </span>
                <small className="provider-workspace-provider-summary">{secondary}</small>
              </button>
            );
          })}
        </section>
        <section className="provider-workspace-detail" aria-live="polite">{renderProviderDetail()}</section>
        <aside className="provider-workspace-activity">
          <section>
            <h2>Runtime activity</h2>
            <div className="provider-workspace-filters" aria-label="Filter runtime messages">
              {(["all", ...providerOrder] as const).map((filter) => <button aria-pressed={activityFilter === filter} key={filter} onClick={() => setActivityFilter(filter)} type="button">{filter === "all" ? "All" : providerLabels[filter]}</button>)}
            </div>
            {filteredMessages.length ? (
              <ol className="provider-workspace-message-list">
                {filteredMessages.map((message) => <li key={`${message.provider}:${message.id}`}><ProviderMark provider={message.provider} /><div><span><strong>{message.authorName}</strong><time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time></span><small>{message.channelName}</small><p>{message.message}</p></div></li>)}
              </ol>
            ) : (
              <div className="provider-workspace-empty"><p>No messages captured in this API runtime.</p><small>Start intake, then send a harmless test message.</small></div>
            )}
            <div className="provider-workspace-runtime-list">
              <div className="header"><span>Target</span><span>Runtime</span><span>Reconnect / error</span></div>
              {providerOrder.map((provider) => {
                const error = getLastError(provider, props);
                const reconnectText = provider === "youtube" && !youtubeConsentActive ? "Consent required" : error ?? "No recent error";
                return <div key={provider}><span><ProviderMark provider={provider} />{providerLabels[provider]} · {targetLabels[provider]}</span><span><StatusDot tone={stateTone(runtimeStates[provider])} />{runtimeLabel(runtimeStates[provider])}</span><span className={error || (provider === "youtube" && !youtubeConsentActive) ? "error" : "ready"}>{reconnectText}</span></div>;
              })}
            </div>
          </section>
          <section className="provider-workspace-setup">
            <h2>Setup needed</h2>
            {!youtubeConsentActive ? <div><ProviderMark provider="youtube" /><span><strong>YouTube</strong><small>Owner consent disconnected</small></span><button className="secondary-action" onClick={props.onConnectYouTube} type="button">Connect</button></div> : null}
            {twitchMissingCount > 0 ? <div><ProviderMark provider="twitch" /><span><strong>Twitch</strong><small>{twitchMissingCount} EventSub subscriptions missing</small></span><button className="provider-workspace-text-action" onClick={props.onEnsureTwitchSubscriptions} type="button">Create missing</button></div> : null}
            {discordWebhookMissing ? <div><ProviderMark provider="discord" /><span><strong>Discord</strong><small>Public key missing; webhooks unavailable</small></span><button className="provider-workspace-text-action" onClick={() => selectProvider("discord")} type="button">View setup</button></div> : null}
            {youtubeConsentActive && twitchMissingCount === 0 && !discordWebhookMissing ? <p className="provider-workspace-all-clear"><FiCheckCircle aria-hidden="true" />No setup issues detected.</p> : null}
          </section>
        </aside>
      </div>
    </div>
  );
};

export default ProviderIntegrationsWorkspace;
