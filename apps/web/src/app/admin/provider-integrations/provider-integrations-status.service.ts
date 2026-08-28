import type {
  LoadState,
  ProviderCapabilityState,
  ChatControlGuidance,
  ChatControlState,
  DiscordChatIntakeResponse,
  ProviderIntegrationStatusFailureReason,
  ProviderIntegrationReadiness,
  ProviderIntegrationsStatusResponse,
  ProviderRuntimeConnectionState,
  ProviderRuntimeStatus,
  TwitchChatIntakeResponse,
  TwitchEventSubEnsureDefaultsResponse,
  TwitchEventSubSubscriptionListResponse,
  YouTubeActivitiesPollResponse,
  YouTubeChannelSelectionResponse,
  YouTubeConsentResponse,
  YouTubeCredentialResponse,
  YouTubeCredentialSummary,
  YouTubePubSubSubscriptionRequestResponse,
  YouTubePubSubSubscriptionResponse,
  YouTubeSavedChannel,
  YouTubeLiveChatIntakeResponse
} from "./provider-integrations-status.types";

export const readinessLabels: Record<ProviderIntegrationReadiness, string> = {
  ready: "Ready",
  needs_setup: "Needs setup",
  needs_attention: "Needs attention",
  disabled: "Disabled"
};

export const capabilityStateLabels: Record<ProviderCapabilityState, string> = {
  available: "Available",
  needs_setup: "Needs setup",
  needs_attention: "Needs attention",
  disabled: "Disabled"
};

const providerIds = ["twitch", "youtube", "discord"] as const;
const providerLabels = {
  twitch: "Twitch",
  youtube: "YouTube",
  discord: "Discord"
} as const;
const readinessStates = ["ready", "needs_setup", "needs_attention", "disabled"] as const;
const capabilityStates = ["available", "needs_setup", "needs_attention", "disabled"] as const;
const runtimeStates = ["connected", "connecting", "waiting", "retrying", "stopped", "unconfigured"] as const;
const chatControlStates = ["stopped", "connecting", "waiting", "connected", "unconfigured"] as const;
const chatControlGuidance = ["configuration_needed", "ready_to_start", "running", "waiting_for_live_chat"] as const;
const failureReasons = [
  "not_authenticated",
  "provider_integrations_unavailable",
  "provider_integrations_user_unlinked",
  "provider_integrations_forbidden"
] as const satisfies readonly ProviderIntegrationStatusFailureReason[];
const youtubeConsentFailureReasons = [
  "provider_integrations_user_unlinked",
  "provider_integrations_forbidden",
  "youtube_oauth_client_missing",
  "youtube_oauth_redirect_missing",
  "youtube_oauth_state_secret_missing",
  "youtube_oauth_state_invalid",
  "youtube_oauth_exchange_failed",
  "youtube_oauth_refresh_token_missing",
  "not_authenticated",
  "youtube_oauth_unavailable"
] as const;
const youtubeChannelFailureReasons = [
  "provider_integrations_user_unlinked",
  "provider_integrations_forbidden",
  "youtube_oauth_client_missing",
  "youtube_oauth_redirect_missing",
  "youtube_channel_credential_missing",
  "youtube_channel_scope_missing",
  "youtube_channel_not_found",
  "youtube_channel_ref_unavailable",
  "youtube_channel_discovery_failed",
  "youtube_channel_discovery_unavailable",
  "youtube_channel_invalid_input",
  "not_authenticated"
] as const;
const twitchEventSubFailureReasons = [
  "twitch_eventsub_user_unlinked",
  "twitch_eventsub_forbidden",
  "twitch_eventsub_config_missing",
  "twitch_eventsub_broadcaster_not_configured",
  "twitch_eventsub_broadcaster_not_found",
  "twitch_eventsub_api_unavailable",
  "twitch_eventsub_unavailable",
  "invalid_twitch_eventsub_broadcaster",
  "not_authenticated"
] as const;
const youtubePubSubFailureReasons = [
  "youtube_pubsub_user_unlinked",
  "youtube_pubsub_forbidden",
  "youtube_pubsub_channel_missing",
  "youtube_pubsub_config_missing",
  "youtube_pubsub_hub_unavailable",
  "youtube_pubsub_unavailable",
  "not_authenticated"
] as const;
const youtubeActivitiesFailureReasons = [
  "youtube_activities_user_unlinked",
  "youtube_activities_forbidden",
  "youtube_activities_context_missing",
  "youtube_activities_poll_failed",
  "youtube_activities_write_failed",
  "youtube_activities_unavailable",
  "not_authenticated"
] as const;
const twitchChatControlFailureReasons = [
  "twitch_chat_user_unlinked",
  "twitch_chat_forbidden",
  "twitch_chat_unavailable",
  "not_authenticated"
] as const;
const discordChatControlFailureReasons = [
  "discord_chat_user_unlinked",
  "discord_chat_forbidden",
  "discord_chat_unavailable",
  "not_authenticated"
] as const;
const youtubeLiveChatControlFailureReasons = [
  "youtube_live_chat_user_unlinked",
  "youtube_live_chat_forbidden",
  "youtube_live_chat_unavailable",
  "not_authenticated"
] as const;
const youtubeCredentialStates = ["connected", "disconnected", "needs_attention"] as const;
const youtubeCredentialActions = ["connect", "reconnect", "none"] as const;
const youtubeConsentConnectPath = "/admin/provider-integrations/youtube/connect" as const;
const twitchEventSubStates = ["enabled", "pending", "missing", "problem"] as const;
const twitchEventSubEnsureStates = ["already_enabled", "already_pending", "created", "create_failed"] as const;
const youtubePubSubModes = ["subscribe", "unsubscribe"] as const;
const providerCapabilities = {
  twitch: [
    { key: "twitch_api_access", label: "Twitch API access" },
    { key: "twitch_chat_intake", label: "Twitch chat intake" },
    { key: "twitch_chat_replies", label: "Twitch chat replies" },
    { key: "twitch_eventsub_intake", label: "Twitch event intake" }
  ],
  youtube: [
    { key: "youtube_data_access", label: "YouTube data access" },
    { key: "youtube_owner_consent", label: "YouTube owner consent" },
    { key: "youtube_live_chat_intake", label: "YouTube live chat intake" }
  ],
  discord: [
    { key: "discord_bot_access", label: "Discord bot access" },
    { key: "discord_guild_target", label: "Discord guild target" },
    { key: "discord_webhook_intake", label: "Discord webhook intake" },
    { key: "discord_chat_intake", label: "Discord chat intake" }
  ]
} as const satisfies Record<
  typeof providerIds[number],
  readonly { key: ProviderStatusProvider["capabilities"][number]["key"]; label: string }[]
>;

const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();

  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key, index) => key === expectedKeys[index]);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isEnumValue = <Value extends string>(
  value: unknown,
  values: readonly Value[]
): value is Value =>
  typeof value === "string" && values.includes(value as Value);

const isBoundedText = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= maxLength;

const isNullableBoundedText = (value: unknown, maxLength: number): value is string | null =>
  value === null || isBoundedText(value, maxLength);

const isIsoTimestampOrNull = (value: unknown): value is string | null => {
  if (value === null) {
    return true;
  }

  if (typeof value !== "string" || value.length > 40) {
    return false;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
};

const isNonNegativeInteger = (value: unknown, maxValue: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= maxValue;

const parseFailure = <Reason extends string>(
  value: Record<string, unknown>,
  reasons: readonly Reason[]
): { ok: false; reason: Reason } | null =>
  exactKeys(value, ["ok", "reason"]) && isEnumValue<Reason>(value.reason, reasons)
    ? { ok: false, reason: value.reason }
    : null;

const getExpectedChatControlGuidance = (state: ChatControlState): ChatControlGuidance => {
  if (state === "unconfigured") return "configuration_needed";
  if (state === "connected" || state === "connecting") return "running";
  if (state === "waiting") return "waiting_for_live_chat";
  return "ready_to_start";
};

const getExpectedYouTubeCredentialAction = (
  credential: YouTubeCredentialSummary | null
): Extract<YouTubeCredentialResponse, { ok: true }>["action"] => {
  if (credential === null) return "connect";
  if (credential.state === "connected") return "none";
  return "reconnect";
};

const parseChatControlResponse = <Response extends TwitchChatIntakeResponse | DiscordChatIntakeResponse | YouTubeLiveChatIntakeResponse>(
  value: unknown,
  reasons: readonly string[]
): Response | null => {
  if (!isRecord(value) || !("ok" in value)) {
    return null;
  }

  if (value.ok === false) {
    return parseFailure(value, reasons) as Response | null;
  }

  if (!exactKeys(value, ["ok", "readOnly", "status"]) || value.ok !== true || value.readOnly !== true || !isRecord(value.status)) {
    return null;
  }

  const status = value.status;
  if (
    !exactKeys(status, ["state", "connectedAt", "lastActivityAt", "guidance"])
    || !isEnumValue<ChatControlState>(status.state, chatControlStates)
    || !isIsoTimestampOrNull(status.connectedAt)
    || !isIsoTimestampOrNull(status.lastActivityAt)
    || !isEnumValue<ChatControlGuidance>(status.guidance, chatControlGuidance)
    || status.guidance !== getExpectedChatControlGuidance(status.state)
  ) {
    return null;
  }

  return {
    ok: true,
    readOnly: true,
    status: {
      connectedAt: status.connectedAt,
      guidance: status.guidance,
      lastActivityAt: status.lastActivityAt,
      state: status.state
    }
  } as Response;
};

type ProviderStatusSuccess = Extract<ProviderIntegrationsStatusResponse, { ok: true }>;
type ProviderStatusProvider = ProviderStatusSuccess["providers"][number];

const parseRuntime = (
  value: unknown,
  generatedAt: string
): ProviderRuntimeStatus | null => {
  if (!isRecord(value) || !exactKeys(value, [
    "state",
    "accountSummary",
    "connectedAt",
    "lastActivityAt",
    "nextRetryAt"
  ])) {
    return null;
  }

  if (
    !isEnumValue<ProviderRuntimeConnectionState>(value.state, runtimeStates)
    || !isNullableBoundedText(value.accountSummary, 80)
    || !isIsoTimestampOrNull(value.connectedAt)
    || !isIsoTimestampOrNull(value.lastActivityAt)
    || !isIsoTimestampOrNull(value.nextRetryAt)
  ) {
    return null;
  }

  if (
    value.state === "retrying"
      ? value.nextRetryAt === null || new Date(value.nextRetryAt).getTime() <= new Date(generatedAt).getTime()
      : value.nextRetryAt !== null
  ) {
    return null;
  }

  return {
    state: value.state,
    accountSummary: value.accountSummary,
    connectedAt: value.connectedAt,
    lastActivityAt: value.lastActivityAt,
    nextRetryAt: value.nextRetryAt
  };
};

const parseCapabilities = (
  value: unknown,
  providerId: ProviderStatusProvider["id"]
): ProviderStatusProvider["capabilities"] | null => {
  const expectedCapabilities = providerCapabilities[providerId];

  if (!Array.isArray(value) || value.length !== expectedCapabilities.length) {
    return null;
  }

  const capabilities: ProviderStatusProvider["capabilities"][number][] = [];

  for (const [index, entry] of value.entries()) {
    const expected = expectedCapabilities[index];

    if (!isRecord(entry) || !exactKeys(entry, ["key", "label", "state"])) {
      return null;
    }

    if (
      !expected
      || entry.key !== expected.key
      || entry.label !== expected.label
      || !isEnumValue<ProviderCapabilityState>(entry.state, capabilityStates)
    ) {
      return null;
    }

    capabilities.push({
      key: expected.key,
      label: expected.label,
      state: entry.state
    });
  }

  return capabilities;
};

const parseProvider = (
  value: unknown,
  generatedAt: string
): ProviderStatusProvider | null => {
  if (!isRecord(value) || !exactKeys(value, [
    "id",
    "label",
    "readiness",
    "capabilities",
    "runtime",
    "guidance"
  ])) {
    return null;
  }

  if (!isEnumValue(value.id, providerIds)) {
    return null;
  }

  const label = providerLabels[value.id];

  if (
    value.label !== label
    || !isEnumValue<ProviderIntegrationReadiness>(value.readiness, readinessStates)
    || !isNullableBoundedText(value.guidance, 180)
  ) {
    return null;
  }

  const capabilities = parseCapabilities(value.capabilities, value.id);
  const runtime = parseRuntime(value.runtime, generatedAt);

  if (!capabilities || !runtime) {
    return null;
  }

  return {
    id: value.id,
    label,
    readiness: value.readiness,
    capabilities,
    runtime,
    guidance: value.guidance
  };
};

export const parseProviderIntegrationsStatusResponse = (
  value: unknown
): ProviderIntegrationsStatusResponse | null => {
  if (!isRecord(value) || !("ok" in value)) {
    return null;
  }

  if (value.ok === false) {
    return exactKeys(value, ["ok", "reason"])
      && isEnumValue<ProviderIntegrationStatusFailureReason>(value.reason, failureReasons)
      ? {
        ok: false,
        reason: value.reason
      }
      : null;
  }

  if (value.ok !== true || !exactKeys(value, ["ok", "generatedAt", "providers"])) {
    return null;
  }

  const generatedAt = value.generatedAt;

  if (!isIsoTimestampOrNull(generatedAt) || generatedAt === null || !Array.isArray(value.providers)) {
    return null;
  }

  const providers = value.providers.map((provider) => parseProvider(provider, generatedAt));

  if (providers.some((provider) => provider === null)) {
    return null;
  }

  const ids = providers.map((provider) => provider?.id);
  if (ids.length !== providerIds.length || !providerIds.every((providerId, index) => ids[index] === providerId)) {
    return null;
  }

  return {
    ok: true,
    generatedAt,
    providers: providers as ProviderStatusSuccess["providers"]
  };
};

export const parseTwitchChatIntakeResponse = (value: unknown): TwitchChatIntakeResponse | null =>
  parseChatControlResponse<TwitchChatIntakeResponse>(value, twitchChatControlFailureReasons);

export const parseDiscordChatIntakeResponse = (value: unknown): DiscordChatIntakeResponse | null =>
  parseChatControlResponse<DiscordChatIntakeResponse>(value, discordChatControlFailureReasons);

export const parseYouTubeLiveChatIntakeResponse = (value: unknown): YouTubeLiveChatIntakeResponse | null =>
  parseChatControlResponse<YouTubeLiveChatIntakeResponse>(value, youtubeLiveChatControlFailureReasons);

const parseYouTubeCredentialPayload = (
  value: unknown,
  connectPathMode: "absent" | "required"
): YouTubeCredentialResponse | YouTubeConsentResponse | null => {
  if (!isRecord(value) || !("ok" in value)) {
    return null;
  }

  if (value.ok === false) {
    return parseFailure(value, youtubeConsentFailureReasons);
  }

  const expectedKeys = connectPathMode === "required"
    ? ["ok", "credential", "action", "connectPath"]
    : ["ok", "credential", "action"];

  if (!exactKeys(value, expectedKeys)) {
    return null;
  }

  if (value.ok !== true || !isEnumValue(value.action, youtubeCredentialActions)) {
    return null;
  }

  const credential = value.credential;
  const credentialState = isRecord(credential) && isEnumValue(credential.state, youtubeCredentialStates)
    ? credential.state
    : null;
  if (
    credential !== null
    && (
      !isRecord(credential)
      || !exactKeys(credential, ["state"])
      || credentialState === null
    )
  ) {
    return null;
  }

  const projectedCredential = credentialState === null ? null : { state: credentialState };

  if (value.action !== getExpectedYouTubeCredentialAction(projectedCredential)) {
    return null;
  }

  if (connectPathMode === "required" && value.connectPath !== youtubeConsentConnectPath) {
    return null;
  }

  return {
    action: value.action,
    credential: projectedCredential,
    ok: true,
    ...(connectPathMode === "required" ? { connectPath: youtubeConsentConnectPath } : {})
  };
};

export const parseYouTubeCredentialResponse = (value: unknown): YouTubeCredentialResponse | null =>
  parseYouTubeCredentialPayload(value, "absent") as YouTubeCredentialResponse | null;

export const parseYouTubeConsentResponse = (value: unknown): YouTubeConsentResponse | null =>
  parseYouTubeCredentialPayload(value, "required") as YouTubeConsentResponse | null;

const parseYouTubeSavedChannel = (value: unknown): YouTubeSavedChannel | null => {
  if (
    !isRecord(value)
    || !exactKeys(value, ["channelRef", "title", "selectedForLiveChat"])
    || !isBoundedText(value.channelRef, 128)
    || !value.channelRef.startsWith("youtube-channel:v1:")
    || !isBoundedText(value.title, 100)
    || typeof value.selectedForLiveChat !== "boolean"
  ) {
    return null;
  }

  return {
    channelRef: value.channelRef,
    selectedForLiveChat: value.selectedForLiveChat,
    title: value.title
  };
};

export const parseYouTubeChannelSelectionResponse = (value: unknown): YouTubeChannelSelectionResponse | null => {
  if (!isRecord(value) || !("ok" in value)) {
    return null;
  }

  if (value.ok === false) {
    return parseFailure(value, youtubeChannelFailureReasons);
  }

  if (
    value.ok !== true
    || !exactKeys(value, ["ok", "channels", "selectedChannelRef"])
    || !Array.isArray(value.channels)
    || value.channels.length > 50
    || !(value.selectedChannelRef === null || isBoundedText(value.selectedChannelRef, 128))
  ) {
    return null;
  }

  const channels = value.channels.map(parseYouTubeSavedChannel);
  if (channels.some((channel) => channel === null)) {
    return null;
  }

  const selectedChannelRef = value.selectedChannelRef;
  if (selectedChannelRef !== null && !channels.some((channel) => channel?.channelRef === selectedChannelRef)) {
    return null;
  }

  return {
    channels: channels as YouTubeSavedChannel[],
    ok: true,
    selectedChannelRef
  };
};

type TwitchEventSubDefault = Extract<TwitchEventSubSubscriptionListResponse, { ok: true }>["defaults"][number];

const parseTwitchEventSubDefault = (value: unknown): TwitchEventSubDefault | null => {
  if (
    !isRecord(value)
    || !exactKeys(value, ["type", "state"])
    || !isBoundedText(value.type, 90)
    || !isEnumValue(value.state, twitchEventSubStates)
  ) {
    return null;
  }

  return {
    state: value.state,
    type: value.type
  };
};

export const parseTwitchEventSubSubscriptionListResponse = (
  value: unknown
): TwitchEventSubSubscriptionListResponse | null => {
  if (!isRecord(value) || !("ok" in value)) {
    return null;
  }

  if (value.ok === false) {
    return parseFailure(value, twitchEventSubFailureReasons);
  }

  if (
    value.ok !== true
    || !exactKeys(value, [
      "ok",
      "broadcasterLogin",
      "broadcasterLogins",
      "defaults",
      "readOnly",
      "subscriptionCount",
      "subscriptionState"
    ])
    || !isBoundedText(value.broadcasterLogin, 25)
    || !Array.isArray(value.broadcasterLogins)
    || value.broadcasterLogins.length > 10
    || value.broadcasterLogins.some((login) => !isBoundedText(login, 25))
    || !Array.isArray(value.defaults)
    || value.defaults.length > 40
    || value.readOnly !== true
    || !isNonNegativeInteger(value.subscriptionCount, 10_000)
    || value.subscriptionState !== "loaded"
  ) {
    return null;
  }

  const defaults = value.defaults.map(parseTwitchEventSubDefault);
  if (defaults.some((entry) => entry === null)) {
    return null;
  }

  return {
    broadcasterLogin: value.broadcasterLogin,
    broadcasterLogins: value.broadcasterLogins,
    defaults: defaults as Extract<TwitchEventSubSubscriptionListResponse, { ok: true }>["defaults"],
    ok: true,
    readOnly: true,
    subscriptionCount: value.subscriptionCount,
    subscriptionState: "loaded"
  };
};

export const parseTwitchEventSubEnsureDefaultsResponse = (
  value: unknown
): TwitchEventSubEnsureDefaultsResponse | null => {
  if (!isRecord(value) || !("ok" in value)) {
    return null;
  }

  if (value.ok === false) {
    return parseFailure(value, twitchEventSubFailureReasons);
  }

  if (
    value.ok !== true
    || !exactKeys(value, ["ok", "broadcasterLogin", "broadcasterLogins", "results", "subscriptionState"])
    || !isBoundedText(value.broadcasterLogin, 25)
    || !Array.isArray(value.broadcasterLogins)
    || value.broadcasterLogins.length > 10
    || value.broadcasterLogins.some((login) => !isBoundedText(login, 25))
    || !Array.isArray(value.results)
    || value.results.length > 40
    || value.subscriptionState !== "loaded"
  ) {
    return null;
  }

  const results = value.results.map((entry) => {
    if (
      !isRecord(entry)
      || !exactKeys(entry, ["type", "state"])
      || !isBoundedText(entry.type, 90)
      || !isEnumValue(entry.state, twitchEventSubEnsureStates)
    ) {
      return null;
    }

    return {
      state: entry.state,
      type: entry.type
    };
  });

  if (results.some((entry) => entry === null)) {
    return null;
  }

  return {
    broadcasterLogin: value.broadcasterLogin,
    broadcasterLogins: value.broadcasterLogins,
    ok: true,
    results: results as Extract<TwitchEventSubEnsureDefaultsResponse, { ok: true }>["results"],
    subscriptionState: "loaded"
  };
};

export const parseYouTubePubSubSubscriptionResponse = (
  value: unknown
): YouTubePubSubSubscriptionResponse | null => {
  if (!isRecord(value) || !("ok" in value)) {
    return null;
  }

  if (value.ok === false) {
    return parseFailure(value, youtubePubSubFailureReasons);
  }

  return exactKeys(value, ["ok", "readOnly", "state"])
    && value.ok === true
    && value.readOnly === true
    && value.state === "ready"
    ? { ok: true, readOnly: true, state: "ready" }
    : null;
};

export const parseYouTubePubSubSubscriptionRequestResponse = (
  value: unknown
): YouTubePubSubSubscriptionRequestResponse | null => {
  if (!isRecord(value) || !("ok" in value)) {
    return null;
  }

  if (value.ok === false) {
    return parseFailure(value, youtubePubSubFailureReasons);
  }

  return exactKeys(value, ["ok", "mode", "readOnly", "state"])
    && value.ok === true
    && isEnumValue(value.mode, youtubePubSubModes)
    && value.readOnly === true
    && value.state === "requested"
    ? { mode: value.mode, ok: true, readOnly: true, state: "requested" }
    : null;
};

export const parseYouTubeActivitiesPollResponse = (
  value: unknown
): YouTubeActivitiesPollResponse | null => {
  if (!isRecord(value) || !("ok" in value)) {
    return null;
  }

  if (value.ok === false) {
    return parseFailure(value, youtubeActivitiesFailureReasons);
  }

  if (
    value.ok !== true
    || !exactKeys(value, ["ok", "fetched", "inserted", "polledAt", "readOnly"])
    || !isNonNegativeInteger(value.fetched, 500)
    || !isNonNegativeInteger(value.inserted, 500)
    || value.inserted > value.fetched
    || !isIsoTimestampOrNull(value.polledAt)
    || value.polledAt === null
    || value.readOnly !== true
  ) {
    return null;
  }

  return {
    fetched: value.fetched,
    inserted: value.inserted,
    ok: true,
    polledAt: value.polledAt,
    readOnly: true
  };
};

export const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

export const getFailureMessage = (
  response: Response,
  reason?: ProviderIntegrationStatusFailureReason
): string => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "Sign in before opening provider integration status.";
  }

  if (
    response.status === 403
    || reason === "provider_integrations_forbidden"
    || reason === "provider_integrations_user_unlinked"
  ) {
    return "Your account does not have owner access to provider integration status.";
  }

  return `Provider integration status request failed with ${response.status}.`;
};

export const getLoadStateForFailure = (
  response: Response,
  reason?: ProviderIntegrationStatusFailureReason
): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

  if (
    response.status === 403
    || reason === "provider_integrations_forbidden"
    || reason === "provider_integrations_user_unlinked"
  ) {
    return "forbidden";
  }

  return "failed";
};

export const parseJson = async <ResponseBody,>(response: Response): Promise<ResponseBody | null> => {
  try {
    return await response.json() as ResponseBody;
  } catch {
    return null;
  }
};
