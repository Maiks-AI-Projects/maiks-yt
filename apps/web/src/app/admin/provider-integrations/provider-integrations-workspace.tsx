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
import {
  getProviderWorkspaceRuntimeViews,
  getSelectedYouTubeChannelToken,
  getYouTubeChannelOptionViews,
  resolveYouTubeChannelId
} from "./provider-integrations-workspace.rules";
import type {
  ProviderIntegrationStatus,
  ProviderIntegrationsStatusResponse,
  ProviderRuntimeConnectionState,
  TwitchEventSubDefaultSubscriptionStatus,
  YouTubeActivitiesPollResponse,
  YouTubeCredentialSummary,
  YouTubePubSubSubscriptionResponse,
  YouTubeSavedChannel
} from "./provider-integrations-status.types";

type ProviderId = "twitch" | "youtube" | "discord";
type ProviderSnapshot = Extract<ProviderIntegrationsStatusResponse, { ok: true }>;
type YouTubePubSubStatus = Extract<YouTubePubSubSubscriptionResponse, { ok: true }>;
type YouTubeActivitiesStatus = Extract<YouTubeActivitiesPollResponse, { ok: true }>;

type ProviderIntegrationsWorkspaceProps = {
  snapshot: ProviderSnapshot;
  youtubeCredential: YouTubeCredentialSummary | null;
  youtubeChannels: readonly YouTubeSavedChannel[];
  youtubeSelectedChannelRef: string | null;
  youtubePubSubSubscription: YouTubePubSubStatus | null;
  youtubeActivitiesPoll: YouTubeActivitiesStatus | null;
  twitchEventSubDefaults: readonly TwitchEventSubDefaultSubscriptionStatus[];
  twitchEventSubBroadcasterLogin: string | null;
  twitchEventSubBroadcasterLogins: readonly string[];
  twitchEventSubSubscriptionCount: number;
  twitchEventSubSubscriptionsLoaded: boolean;
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
  onSelectYouTubeChannel: (channelRef: string | null) => void;
  onSelectTwitchEventSubBroadcaster: (broadcasterLogin: string) => void;
  onYouTubePubSubAction: (mode: "subscribe" | "unsubscribe") => void;
  onPollYouTubeActivities: () => void;
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

const runtimeIsActive = (state: string | null | undefined): boolean =>
  state === "connected" || state === "connecting" || state === "retrying" || state === "waiting";

const runtimeLabel = (state: ProviderRuntimeConnectionState | null | undefined): string => {
  if (!state) return "Unknown";
  if (state === "connected") return "Connected";
  if (state === "connecting") return "Connecting";
  if (state === "retrying") return "Retrying";
  if (state === "waiting") return "Waiting for live chat";
  if (state === "unconfigured") return "Not configured";
  return "Stopped";
};

const providerStateLabel = (provider: ProviderIntegrationStatus | undefined): string => {
  if (!provider) return "Checking";
  if (provider.readiness === "ready") return "Ready";
  if (provider.readiness === "needs_setup") return "Needs setup";
  if (provider.readiness === "needs_attention") return "Needs attention";
  return "Disabled";
};

const stateTone = (state: string | null | undefined): "ready" | "warning" | "error" | "neutral" => {
  if (state === "connected" || state === "ready" || state === "active" || state === "available") return "ready";
  if (state === "error" || state === "needs_attention" || state === "revoked" || state === "unconfigured") return "error";
  if (state === "connecting" || state === "stopped" || state === "retrying" || state === "waiting" || state === "needs_setup") return "warning";
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
  const entries = defaults.filter((entry) => prefixes.some((prefix) => entry.type.startsWith(prefix)));
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

const formatOptionalDate = (value: string | null): string => value ? formatDate(value) : "None";

const ProviderIntegrationsWorkspace = (props: ProviderIntegrationsWorkspaceProps): React.ReactNode => {
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("twitch");
  const [detailTab, setDetailTab] = useState<string>("primary");
  const providers = useMemo(
    () => new Map(props.snapshot.providers.map((provider) => [provider.id, provider])),
    [props.snapshot.providers]
  );
  const runtimeViews = useMemo(
    () => getProviderWorkspaceRuntimeViews(props.snapshot.providers),
    [props.snapshot.providers]
  );
  const youtubeChannelOptions = useMemo(
    () => getYouTubeChannelOptionViews(props.youtubeChannels),
    [props.youtubeChannels]
  );
  const selectedYouTubeChannelToken = getSelectedYouTubeChannelToken(
    props.youtubeChannels,
    props.youtubeSelectedChannelRef
  );
  const targetLabels: Record<ProviderId, string> = {
    twitch: runtimeViews.get("twitch")?.accountSummary ?? "Runtime target unavailable",
    youtube: runtimeViews.get("youtube")?.accountSummary ?? "Runtime target unavailable",
    discord: runtimeViews.get("discord")?.accountSummary ?? "Runtime target unavailable"
  };
  const runtimeStates: Record<ProviderId, ProviderRuntimeConnectionState | null> = {
    twitch: runtimeViews.get("twitch")?.connectionState ?? null,
    youtube: runtimeViews.get("youtube")?.connectionState ?? null,
    discord: runtimeViews.get("discord")?.connectionState ?? null
  };
  const twitchSubscriptionsLoaded = props.twitchEventSubSubscriptionsLoaded;
  const twitchEnabledCount = props.twitchEventSubDefaults.filter((entry) => entry.state === "enabled").length;
  const twitchMissingCount = props.twitchEventSubDefaults.filter((entry) => entry.state === "missing").length;
  const twitchProblemCount = props.twitchEventSubDefaults.filter((entry) => entry.state === "problem").length;
  const youtubeConsentActive = props.youtubeCredential?.state === "connected";
  const discordWebhookMissing = providers.get("discord")?.capabilities.some(
    (capability) => capability.key === "discord_webhook_intake" && capability.state === "needs_setup"
  ) ?? false;

  const selectProvider = (provider: ProviderId): void => {
    setSelectedProvider(provider);
    setDetailTab("primary");
  };

  const renderProviderDetail = (): React.ReactNode => {
    const provider = providers.get(selectedProvider);
    const runtime = runtimeViews.get(selectedProvider);
    const guidance = runtime?.guidance ?? provider?.guidance ?? null;

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
        { id: "errors", label: "Next action" },
        { id: "setup", label: "Setup" }
      ];

      return (
        <>
          <div className="provider-workspace-detail-header">
            <div><ProviderMark provider="twitch" /><h2>Twitch · {targetLabels.twitch}</h2></div>
            <div className="provider-workspace-actions">
              {props.twitchEventSubBroadcasterLogins.length > 1 ? (
                <label className="provider-workspace-broadcaster-selector">
                  <span>Twitch channel</span>
                  <select
                    onChange={(event) => props.onSelectTwitchEventSubBroadcaster(event.currentTarget.value)}
                    value={props.twitchEventSubBroadcasterLogin ?? props.twitchEventSubBroadcasterLogins[0]}
                  >
                    {props.twitchEventSubBroadcasterLogins.map((login) => (
                      <option key={login} value={login}>{login}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                className="secondary-action"
                disabled={runtimeIsActive(runtime?.connectionState)}
                onClick={() => props.onTwitchChatAction("start")}
                type="button"
              >Start intake</button>
              {runtimeIsActive(runtime?.connectionState) ? <button className="secondary-action" onClick={() => props.onTwitchChatAction("stop")} type="button">Stop</button> : null}
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
            <div><dt><FiShield aria-hidden="true" />Provider readiness</dt><dd className={stateTone(provider?.readiness)}>{providerStateLabel(provider)}</dd></div>
            <div><dt><FiUser aria-hidden="true" />Owner consent</dt><dd>Not required</dd></div>
            <div><dt><FiActivity aria-hidden="true" />Runtime intake</dt><dd className={stateTone(runtime?.connectionState)}>{runtimeLabel(runtime?.connectionState)}</dd></div>
            <div><dt><FiBell aria-hidden="true" />Event subscriptions</dt><dd className={twitchMissingCount || twitchProblemCount ? "warning" : twitchSubscriptionsLoaded ? "ready" : "neutral"}>{twitchSubscriptionsLoaded ? `${twitchEnabledCount} active · ${twitchMissingCount} missing${twitchProblemCount ? ` · ${twitchProblemCount} problem` : ""}` : "Checking subscriptions"}</dd></div>
            <div><dt><FiAlertCircle aria-hidden="true" />Next action</dt><dd className={guidance ? "warning" : "ready"}>{guidance ?? "No action needed"}</dd></div>
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
              <h3>{guidance ? "Twitch action" : "No Twitch action"}</h3>
              <p>{guidance ?? "Runtime status does not need owner action."}</p>
            </div>
          ) : (
            <div className="provider-workspace-detail-copy">
              <h3>Read-only Twitch setup</h3>
              <p>Channel: {targetLabels.twitch}</p>
              <p>Provider subscriptions reported: {props.twitchEventSubSubscriptionCount}</p>
              <p>EventSub callback: {props.twitchEventSubSubscriptionsLoaded ? "Configured" : "Not available"}</p>
              {provider?.guidance ? <p className="error">{provider.guidance}</p> : null}
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
                disabled={!youtubeConsentActive || !props.youtubeSelectedChannelRef || runtimeIsActive(runtime?.connectionState)}
                onClick={() => props.onYouTubeLiveChatAction("start")}
                type="button"
              >Start polling</button>
              <button aria-label="Refresh YouTube" className="provider-workspace-icon-button" onClick={props.onRefreshYouTube} title="Refresh YouTube" type="button"><FiRefreshCw aria-hidden="true" /></button>
            </div>
          </div>
          <dl className="provider-workspace-state-table">
            <div><dt><FiShield aria-hidden="true" />Provider readiness</dt><dd className={stateTone(provider?.readiness)}>{providerStateLabel(provider)}</dd></div>
            <div><dt><FiUser aria-hidden="true" />Owner consent</dt><dd className={youtubeConsentActive ? "ready" : "error"}>{youtubeConsentActive ? "Connected" : "Disconnected"}</dd></div>
            <div><dt><FiActivity aria-hidden="true" />Runtime intake</dt><dd className={stateTone(runtime?.connectionState)}>{runtimeLabel(runtime?.connectionState)}</dd></div>
            <div><dt><FiBell aria-hidden="true" />PubSub target</dt><dd className={props.youtubePubSubSubscription ? "ready" : "warning"}>{props.youtubePubSubSubscription ? "Ready" : "Not ready"}</dd></div>
            <div><dt><FiAlertCircle aria-hidden="true" />Next action</dt><dd className={guidance || !youtubeConsentActive ? "warning" : "ready"}>{guidance ?? (youtubeConsentActive ? "No action needed" : "Consent required")}</dd></div>
          </dl>
          <nav className="provider-workspace-tabs" aria-label="YouTube details">
            {tabs.map((tab) => <button aria-current={detailTab === tab.id ? "page" : undefined} key={tab.id} onClick={() => setDetailTab(tab.id)} type="button">{tab.label}</button>)}
          </nav>
          {detailTab === "primary" ? (
            <div className="provider-workspace-detail-copy">
              <h3>Live-chat polling</h3>
              <p>Selected channel: {targetLabels.youtube}</p>
              <p>Last activity: {formatOptionalDate(runtime?.lastActivityAt ?? null)}</p>
              <p>Next retry: {formatOptionalDate(runtime?.nextRetryAt ?? null)}</p>
              {runtimeIsActive(runtime?.connectionState) ? <button className="secondary-action" onClick={() => props.onYouTubeLiveChatAction("stop")} type="button">Stop polling</button> : null}
            </div>
          ) : detailTab === "channels" ? (
            <div className="provider-workspace-detail-copy">
              <div className="provider-workspace-inline-heading"><h3>Saved channels</h3><button className="secondary-action" disabled={!youtubeConsentActive} onClick={props.onDiscoverYouTubeChannels} type="button">Discover channels</button></div>
              <label htmlFor="provider-youtube-channel">Live-chat channel</label>
              <select
                id="provider-youtube-channel"
                onChange={(event) => {
                  const channelRef = resolveYouTubeChannelId(props.youtubeChannels, event.target.value);
                  if (channelRef !== undefined) props.onSelectYouTubeChannel(channelRef);
                }}
                value={selectedYouTubeChannelToken}
              >
                <option value="">No channel selected</option>
                {youtubeChannelOptions.map((channel) => <option key={channel.token} value={channel.token}>{channel.title}</option>)}
              </select>
            </div>
          ) : detailTab === "push" ? (
            <div className="provider-workspace-detail-copy">
              <div className="provider-workspace-inline-heading"><h3>PubSub</h3><div className="provider-workspace-actions"><button className="secondary-action" disabled={!props.youtubePubSubSubscription} onClick={() => props.onYouTubePubSubAction("subscribe")} type="button">Subscribe</button><button className="secondary-action" disabled={!props.youtubePubSubSubscription} onClick={() => props.onYouTubePubSubAction("unsubscribe")} type="button">Unsubscribe</button></div></div>
              <p>{props.youtubePubSubSubscription ? "Subscription target ready." : "Subscription target unavailable."}</p>
              <div className="provider-workspace-inline-heading"><h3>Recent channel activity</h3><button className="secondary-action" disabled={!youtubeConsentActive || !props.youtubeSelectedChannelRef} onClick={props.onPollYouTubeActivities} type="button">Poll recent</button></div>
              <p>{props.youtubeActivitiesPoll ? `${props.youtubeActivitiesPoll.fetched} fetched · ${props.youtubeActivitiesPoll.inserted} stored · ${formatDate(props.youtubeActivitiesPoll.polledAt)}` : "No activity poll has run in this session."}</p>
            </div>
          ) : (
            <div className="provider-workspace-detail-copy">
              <h3>Owner-authorized YouTube setup</h3>
              <p>{youtubeConsentActive ? "Owner consent is connected." : "Connect YouTube owner consent before channel discovery and live-chat polling."}</p>
              {provider?.guidance ? <p className="error">{provider.guidance}</p> : null}
            </div>
          )}
          <p className="provider-workspace-boundary"><FiShield aria-hidden="true" />Private intake by default · provider writes remain separately gated</p>
        </>
      );
    }

    const tabs = [
      { id: "primary", label: "Runtime" },
      { id: "errors", label: "Retry" },
      { id: "setup", label: "Setup" }
    ];
    return (
      <>
        <div className="provider-workspace-detail-header">
          <div><ProviderMark provider="discord" /><h2>Discord · {targetLabels.discord}</h2></div>
          <div className="provider-workspace-actions">
            <button className="secondary-action" disabled={runtimeIsActive(runtime?.connectionState)} onClick={() => props.onDiscordChatAction("start")} type="button">Start intake</button>
            {runtimeIsActive(runtime?.connectionState) ? <button className="secondary-action" onClick={() => props.onDiscordChatAction("stop")} type="button">Stop</button> : null}
            <button aria-label="Refresh Discord" className="provider-workspace-icon-button" onClick={props.onRefreshDiscord} title="Refresh Discord" type="button"><FiRefreshCw aria-hidden="true" /></button>
          </div>
        </div>
        <dl className="provider-workspace-state-table">
          <div><dt><FiShield aria-hidden="true" />Provider readiness</dt><dd className={stateTone(provider?.readiness)}>{providerStateLabel(provider)}</dd></div>
          <div><dt><FiUser aria-hidden="true" />Owner consent</dt><dd>Not required</dd></div>
          <div><dt><FiActivity aria-hidden="true" />Runtime intake</dt><dd className={stateTone(runtime?.connectionState)}>{runtimeLabel(runtime?.connectionState)}</dd></div>
          <div><dt><FiBell aria-hidden="true" />Webhook events</dt><dd className={discordWebhookMissing ? "warning" : "ready"}>{discordWebhookMissing ? "Public key missing" : "Configured"}</dd></div>
          <div><dt><FiAlertCircle aria-hidden="true" />Next action</dt><dd className={guidance ? "warning" : "ready"}>{guidance ?? "No action needed"}</dd></div>
        </dl>
        <nav className="provider-workspace-tabs" aria-label="Discord details">
          {tabs.map((tab) => <button aria-current={detailTab === tab.id ? "page" : undefined} key={tab.id} onClick={() => setDetailTab(tab.id)} type="button">{tab.label}</button>)}
        </nav>
        {detailTab === "primary" ? (
          <div className="provider-workspace-detail-copy">
            <h3>Gateway message intake</h3>
            <p>Target: {targetLabels.discord}</p>
            <p>Last activity: {formatOptionalDate(runtime?.lastActivityAt ?? null)}</p>
            <p>Next retry: {formatOptionalDate(runtime?.nextRetryAt ?? null)}</p>
          </div>
        ) : detailTab === "errors" ? (
          <div className="provider-workspace-detail-copy">
            <h3>Retry state</h3>
            <p>Next reconnect: {formatOptionalDate(runtime?.nextRetryAt ?? null)}</p>
            {guidance ? <p className="error">{guidance}</p> : <p>No retry action needed.</p>}
          </div>
        ) : (
          <div className="provider-workspace-detail-copy">
            <h3>Read-only Discord setup</h3>
            {provider?.capabilities.map((capability) => <p key={capability.key}><strong>{capability.label}:</strong> {capability.state.replace("_", " ")}</p>)}
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
                  <span><StatusDot tone={stateTone(provider?.readiness)} />{providerStateLabel(provider)}</span>
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
            <h2>Runtime status</h2>
            <div className="provider-workspace-runtime-status-list">
              {providerOrder.map((providerId) => {
                const runtime = runtimeViews.get(providerId);
                return (
                  <article key={providerId}>
                    <header>
                      <span><ProviderMark provider={providerId} /><strong>{providerLabels[providerId]}</strong><small>{targetLabels[providerId]}</small></span>
                      <span className={stateTone(runtime?.connectionState)}><StatusDot tone={stateTone(runtime?.connectionState)} />{runtimeLabel(runtime?.connectionState)}</span>
                    </header>
                    <dl>
                      <div><dt>Connected</dt><dd>{formatOptionalDate(runtime?.connectedAt ?? null)}</dd></div>
                      <div><dt>Last activity</dt><dd>{formatOptionalDate(runtime?.lastActivityAt ?? null)}</dd></div>
                      <div><dt>Next retry</dt><dd>{formatOptionalDate(runtime?.nextRetryAt ?? null)}</dd></div>
                    </dl>
                    <p className={runtime?.guidance ? "warning" : "ready"}>{runtime?.guidance ?? "No owner action needed."}</p>
                  </article>
                );
              })}
            </div>
          </section>
          <section className="provider-workspace-setup">
            <h2>Setup needed</h2>
            {!youtubeConsentActive ? <div><ProviderMark provider="youtube" /><span><strong>YouTube</strong><small>Owner consent disconnected</small></span><button className="secondary-action" onClick={props.onConnectYouTube} type="button">Connect</button></div> : null}
            {twitchMissingCount > 0 ? <div><ProviderMark provider="twitch" /><span><strong>Twitch</strong><small>{twitchMissingCount} EventSub subscriptions missing</small></span><button className="provider-workspace-text-action" onClick={props.onEnsureTwitchSubscriptions} type="button">Create missing</button></div> : null}
            {discordWebhookMissing ? <div><ProviderMark provider="discord" /><span><strong>Discord</strong><small>Public key missing; webhooks unavailable</small></span><button className="provider-workspace-text-action" onClick={() => selectProvider("discord")} type="button">View setup</button></div> : null}
            {youtubeConsentActive && twitchSubscriptionsLoaded && twitchMissingCount === 0 && !discordWebhookMissing ? <p className="provider-workspace-all-clear"><FiCheckCircle aria-hidden="true" />No setup issues detected.</p> : null}
          </section>
        </aside>
      </div>
    </div>
  );
};

export default ProviderIntegrationsWorkspace;
