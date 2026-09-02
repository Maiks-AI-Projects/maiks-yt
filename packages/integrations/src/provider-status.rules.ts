import type { DiscordChatIntakeStatus } from "./discord-chat-intake.types.js";
import type { TwitchChatReplyReadinessStatus } from "./twitch-chat-reply-readiness.types.js";
import type { TwitchChatIntakeStatus } from "./twitch-chat-intake.types.js";
import type { YouTubeLiveChatIntakeStatus } from "./youtube-live-chat-intake.types.js";

export type ProviderIntegrationId = "twitch" | "youtube" | "discord";

export type ProviderIntegrationReadiness = "ready" | "needs_setup" | "needs_attention" | "disabled";

export type ProviderCapabilityState = "available" | "needs_setup" | "needs_attention" | "disabled";

export type ProviderCapabilityKey =
  | "twitch_api_access"
  | "twitch_chat_intake"
  | "twitch_chat_replies"
  | "twitch_eventsub_intake"
  | "youtube_data_access"
  | "youtube_owner_consent"
  | "youtube_live_chat_intake"
  | "discord_bot_access"
  | "discord_guild_target"
  | "discord_webhook_intake"
  | "discord_chat_intake";

export type ProviderRuntimeConnectionState =
  | "connected"
  | "connecting"
  | "waiting"
  | "retrying"
  | "quota_exhausted"
  | "stopped"
  | "unconfigured";

export type ProviderRuntimeStatus = {
  state: ProviderRuntimeConnectionState;
  accountSummary: string | null;
  connectedAt: string | null;
  lastActivityAt: string | null;
  nextRetryAt: string | null;
};

export type ProviderCapabilityStatus = {
  key: ProviderCapabilityKey;
  label: string;
  state: ProviderCapabilityState;
};

export type ProviderIntegrationStatus = {
  id: ProviderIntegrationId;
  label: string;
  readiness: ProviderIntegrationReadiness;
  capabilities: readonly ProviderCapabilityStatus[];
  runtime: ProviderRuntimeStatus;
  guidance: string | null;
};

export type ProviderIntegrationStatusSnapshot = {
  ok: true;
  generatedAt: string;
  providers: readonly ProviderIntegrationStatus[];
};

export type ProviderIntegrationEnvironment = Record<string, string | undefined>;

export type ProviderIntegrationRuntimeState = {
  discordChatIntake?: DiscordChatIntakeStatus;
  discordChatIntakeState?: "stopped" | "connecting" | "connected" | "unconfigured";
  twitchChatIntake?: TwitchChatIntakeStatus;
  twitchChatIntakeState?: "stopped" | "connecting" | "connected" | "unconfigured";
  youtubeLiveChatIntake?: YouTubeLiveChatIntakeStatus;
  youtubeLiveChatIntakeState?: "stopped" | "connecting" | "waiting" | "connected" | "quota_exhausted" | "unconfigured";
};

export type ProviderIntegrationCapabilityReadiness = {
  twitchChatReplies?: TwitchChatReplyReadinessStatus;
};

type ProviderEnvironmentVariableStatus = {
  configured: boolean;
  valid: boolean;
};

type ProviderConfigStatus = {
  disabled: boolean;
  configured: boolean;
  invalid: boolean;
};

const placeholderValues = new Set([
  "changeme",
  "change-me",
  "placeholder",
  "replace-me",
  "replace_me",
  "todo",
  "xxx"
]);

const providerAccountSummaryMaxLength = 80;

const isTruthyFlag = (value: string | undefined): boolean => {
  const normalized = value?.trim().toLowerCase();

  return normalized === "1"
    || normalized === "true"
    || normalized === "yes"
    || normalized === "disabled";
};

const isPresent = (value: string | undefined): boolean => value !== undefined;

const isUsableValue = (value: string | undefined): boolean => {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 && !placeholderValues.has(trimmed.toLowerCase());
};

const createEnvStatus = (
  env: ProviderIntegrationEnvironment,
  name: string
): ProviderEnvironmentVariableStatus => ({
  configured: isPresent(env[name]) && isUsableValue(env[name]),
  valid: !isPresent(env[name]) || isUsableValue(env[name])
});

const createAnyEnvStatus = (
  env: ProviderIntegrationEnvironment,
  names: readonly string[]
): ProviderEnvironmentVariableStatus => ({
  configured: names.some((name) => isPresent(env[name]) && isUsableValue(env[name])),
  valid: names.every((name) => !isPresent(env[name]) || isUsableValue(env[name]))
});

const hasDisabledFlag = (
  env: ProviderIntegrationEnvironment,
  providerId: ProviderIntegrationId
): boolean =>
  isTruthyFlag(env.PROVIDER_INTEGRATIONS_DISABLED)
  || isTruthyFlag(env[`${providerId.toUpperCase()}_INTEGRATION_DISABLED`]);

const normalizeTimestamp = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const normalizeFutureTimestamp = (
  value: string | null | undefined,
  now: Date
): string | null => {
  const timestamp = normalizeTimestamp(value);

  return timestamp && new Date(timestamp).getTime() > now.getTime() ? timestamp : null;
};

const sanitizeOwnerText = (
  value: string | null | undefined,
  maxLength = providerAccountSummaryMaxLength
): string | null => {
  const compact = value?.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim() ?? "";

  if (compact.length === 0) {
    return null;
  }

  if (
    /\b\d{17,20}\b/.test(compact)
    || /\bUC[a-z0-9_-]{22}\b/i.test(compact)
    || /https?:\/\//i.test(compact)
    || /\b(?:token|secret|password|api[_-]?key|authorization|cookie)\b/i.test(compact)
  ) {
    return null;
  }

  return compact.slice(0, maxLength);
};

const safeTwitchChannelName = (value: string | null | undefined): string | null => {
  const normalized = value?.trim().replace(/^#/, "").toLowerCase() ?? "";

  return /^[a-z0-9_]{1,25}$/.test(normalized) ? normalized : null;
};

const joinSafeNames = (names: readonly string[]): string | null => {
  for (let visibleCount = Math.min(names.length, 3); visibleCount > 0; visibleCount -= 1) {
    const visibleNames = names.slice(0, visibleCount);
    const suffix = names.length > visibleNames.length ? ` + ${names.length - visibleNames.length} more` : "";
    const summary = `${visibleNames.join(" + ")}${suffix}`;

    if (summary.length <= providerAccountSummaryMaxLength) {
      return summary;
    }
  }

  return null;
};

const normalizeRuntimeState = (
  state: ProviderIntegrationRuntimeState["twitchChatIntakeState"]
    | ProviderIntegrationRuntimeState["discordChatIntakeState"]
    | ProviderIntegrationRuntimeState["youtubeLiveChatIntakeState"]
    | undefined,
  nextRetryAt: string | null
): ProviderRuntimeConnectionState => {
  if (state === "connecting") {
    return state;
  }

  if (nextRetryAt) {
    return "retrying";
  }

  if (state === "connected" || state === "waiting" || state === "stopped" || state === "quota_exhausted" || state === "unconfigured") {
    return state;
  }

  return "unconfigured";
};

const runtimeCapabilityState = (runtime: ProviderRuntimeStatus): ProviderCapabilityState => {
  if (runtime.state === "retrying" || runtime.state === "quota_exhausted") {
    return "needs_attention";
  }

  if (runtime.state === "unconfigured") {
    return "needs_setup";
  }

  return "available";
};

const configCapabilityState = (config: ProviderConfigStatus): ProviderCapabilityState => {
  if (config.disabled) {
    return "disabled";
  }

  if (config.invalid) {
    return "needs_attention";
  }

  return config.configured ? "available" : "needs_setup";
};

const buildRuntimeStatus = ({
  state,
  accountSummary,
  connectedAt,
  lastDisconnectAt,
  lastMessageAt,
  nextRetryAt
}: {
  state: ProviderRuntimeConnectionState;
  accountSummary: string | null;
  connectedAt: string | null;
  lastDisconnectAt?: string | null;
  lastMessageAt: string | null;
  nextRetryAt: string | null;
}): ProviderRuntimeStatus => ({
  state,
  accountSummary,
  connectedAt,
  lastActivityAt: lastMessageAt ?? lastDisconnectAt ?? connectedAt,
  nextRetryAt
});

const twitchRuntimeStatus = (
  runtimeState: ProviderIntegrationRuntimeState,
  now: Date
): ProviderRuntimeStatus => {
  const status = runtimeState.twitchChatIntake;
  const nextRetryAt = normalizeFutureTimestamp(status?.nextReconnectAt, now);
  const state = normalizeRuntimeState(status?.state ?? runtimeState.twitchChatIntakeState, nextRetryAt);
  const names = status?.channelNames
    .map((name) => safeTwitchChannelName(name))
    .filter((name): name is string => name !== null) ?? [];

  return buildRuntimeStatus({
    state,
    accountSummary: joinSafeNames(names) ?? safeTwitchChannelName(status?.channelName) ?? null,
    connectedAt: normalizeTimestamp(status?.connectedAt),
    lastDisconnectAt: normalizeTimestamp(status?.lastDisconnectAt),
    lastMessageAt: normalizeTimestamp(status?.lastMessageAt),
    nextRetryAt
  });
};

const youtubeRuntimeStatus = (
  runtimeState: ProviderIntegrationRuntimeState,
  now: Date
): ProviderRuntimeStatus => {
  const status = runtimeState.youtubeLiveChatIntake;
  const nextRetryAt = status?.lastError
    ? normalizeFutureTimestamp(status.nextPollAt, now)
    : null;
  const state = normalizeRuntimeState(status?.state ?? runtimeState.youtubeLiveChatIntakeState, nextRetryAt);

  return buildRuntimeStatus({
    state,
    accountSummary: sanitizeOwnerText(status?.channelName),
    connectedAt: normalizeTimestamp(status?.connectedAt),
    lastMessageAt: normalizeTimestamp(status?.lastMessageAt),
    nextRetryAt
  });
};

const discordRuntimeStatus = (
  runtimeState: ProviderIntegrationRuntimeState,
  now: Date
): ProviderRuntimeStatus => {
  const status = runtimeState.discordChatIntake;
  const nextRetryAt = normalizeFutureTimestamp(status?.nextReconnectAt, now);
  const state = normalizeRuntimeState(status?.state ?? runtimeState.discordChatIntakeState, nextRetryAt);
  const configuredChannelCount = status?.channelIds.length ?? 0;

  return buildRuntimeStatus({
    state,
    accountSummary: configuredChannelCount > 0
      ? `${Math.min(configuredChannelCount, 999)} configured channels`
      : status?.guildId
        ? "Guild-wide intake"
        : null,
    connectedAt: normalizeTimestamp(status?.connectedAt),
    lastDisconnectAt: normalizeTimestamp(status?.lastDisconnectAt),
    lastMessageAt: normalizeTimestamp(status?.lastMessageAt),
    nextRetryAt
  });
};

const readinessFrom = ({
  config,
  runtime
}: {
  config: ProviderConfigStatus;
  runtime: ProviderRuntimeStatus;
}): ProviderIntegrationReadiness => {
  if (config.disabled) {
    return "disabled";
  }

  if (config.invalid || runtime.state === "retrying") {
    return "needs_attention";
  }

  if (!config.configured || runtime.state === "unconfigured") {
    return "needs_setup";
  }

  return "ready";
};

const guidanceFrom = ({
  config,
  runtime,
  setupGuidance
}: {
  config: ProviderConfigStatus;
  runtime: ProviderRuntimeStatus;
  setupGuidance: string;
}): string | null => {
  if (config.disabled) {
    return "Enable this provider only when production intake should resume.";
  }

  if (config.invalid) {
    return "Review the provider setup; one or more configured values are unusable.";
  }

  if (!config.configured || runtime.state === "unconfigured") {
    return setupGuidance;
  }

  if (runtime.state === "retrying") {
    return "Wait for the scheduled retry. Review the provider connection if retries continue.";
  }

  if (runtime.state === "stopped") {
    return "Start intake when this provider should capture live activity.";
  }

  return null;
};

const defaultTwitchChatReplyReadiness = (
  config: ProviderConfigStatus,
  clientId: ProviderEnvironmentVariableStatus,
  botAccessToken: ProviderEnvironmentVariableStatus
): TwitchChatReplyReadinessStatus => {
  if (config.disabled) {
    return {
      issue: null,
      state: "disabled"
    };
  }

  if (!clientId.valid || !botAccessToken.valid) {
    return {
      issue: "validation_unavailable",
      state: "needs_attention"
    };
  }

  if (!clientId.configured || !botAccessToken.configured) {
    return {
      issue: "missing_configuration",
      state: "needs_setup"
    };
  }

  return {
    issue: "validation_unavailable",
    state: "needs_attention"
  };
};

const twitchReadinessFrom = ({
  chatReplies,
  config,
  runtime
}: {
  chatReplies: TwitchChatReplyReadinessStatus;
  config: ProviderConfigStatus;
  runtime: ProviderRuntimeStatus;
}): ProviderIntegrationReadiness => {
  if (config.disabled) {
    return "disabled";
  }

  if (config.invalid || runtime.state === "retrying" || chatReplies.state === "needs_attention") {
    return "needs_attention";
  }

  if (!config.configured || runtime.state === "unconfigured" || chatReplies.state === "needs_setup") {
    return "needs_setup";
  }

  return "ready";
};

const twitchChatReplyGuidance = (
  chatReplies: TwitchChatReplyReadinessStatus
): string | null => {
  if (chatReplies.state === "available" || chatReplies.state === "disabled") {
    return null;
  }

  if (chatReplies.issue === "missing_configuration") {
    return "Add Twitch bot access-token and client setup before command replies are enabled.";
  }

  if (chatReplies.issue === "invalid_access_token") {
    return "Reconnect the Twitch bot access token; validation says it is invalid or expired.";
  }

  if (chatReplies.issue === "missing_scope") {
    return "Reconnect Twitch bot consent with chat:read and chat:edit before command replies are enabled.";
  }

  if (chatReplies.issue === "client_mismatch") {
    return "Reconnect Twitch bot consent for the configured Twitch app before command replies are enabled.";
  }

  return "Twitch bot token validation could not be proven right now; retry before relying on command replies.";
};

const twitchGuidanceFrom = ({
  chatReplies,
  config,
  runtime
}: {
  chatReplies: TwitchChatReplyReadinessStatus;
  config: ProviderConfigStatus;
  runtime: ProviderRuntimeStatus;
}): string | null => {
  if (config.disabled) {
    return "Enable this provider only when production intake should resume.";
  }

  if (config.invalid) {
    return "Review the provider setup; one or more configured values are unusable.";
  }

  if (!config.configured) {
    return "Finish Twitch setup before starting chat or event intake.";
  }

  return twitchChatReplyGuidance(chatReplies)
    ?? guidanceFrom({
      config,
      runtime,
      setupGuidance: "Finish Twitch setup before starting chat or event intake."
    });
};

const buildTwitchStatus = (
  env: ProviderIntegrationEnvironment,
  runtimeState: ProviderIntegrationRuntimeState,
  now: Date,
  capabilityReadiness: ProviderIntegrationCapabilityReadiness
): ProviderIntegrationStatus => {
  const clientId = createEnvStatus(env, "TWITCH_CLIENT_ID");
  const clientSecret = createEnvStatus(env, "TWITCH_CLIENT_SECRET");
  const eventSubSecret = createEnvStatus(env, "TWITCH_EVENTSUB_WEBHOOK_SECRET");
  const botAccessToken = createAnyEnvStatus(env, [
    "TWITCH_CHAT_BOT_ACCESS_TOKEN",
    "TWITCH_BOT_ACCESS_TOKEN",
    "TWITCH_ACCESS_TOKEN"
  ]);
  const config = {
    disabled: hasDisabledFlag(env, "twitch"),
    configured: clientId.configured && clientSecret.configured,
    invalid: !clientId.valid || !clientSecret.valid || !eventSubSecret.valid || !botAccessToken.valid
  };
  const runtime = twitchRuntimeStatus(runtimeState, now);
  const chatReplies = capabilityReadiness.twitchChatReplies
    ?? defaultTwitchChatReplyReadiness(config, clientId, botAccessToken);

  return {
    id: "twitch",
    label: "Twitch",
    readiness: twitchReadinessFrom({ chatReplies, config, runtime }),
    capabilities: [
      {
        key: "twitch_api_access",
        label: "Twitch API access",
        state: configCapabilityState(config)
      },
      {
        key: "twitch_chat_intake",
        label: "Twitch chat intake",
        state: config.disabled ? "disabled" : runtimeCapabilityState(runtime)
      },
      {
        key: "twitch_chat_replies",
        label: "Twitch chat replies",
        state: config.disabled ? "disabled" : chatReplies.state
      },
      {
        key: "twitch_eventsub_intake",
        label: "Twitch event intake",
        state: config.disabled ? "disabled" : eventSubSecret.valid && eventSubSecret.configured ? "available" : "needs_setup"
      }
    ],
    runtime,
    guidance: twitchGuidanceFrom({ chatReplies, config, runtime })
  };
};

const buildYouTubeStatus = (
  env: ProviderIntegrationEnvironment,
  runtimeState: ProviderIntegrationRuntimeState,
  now: Date
): ProviderIntegrationStatus => {
  const apiKey = createEnvStatus(env, "YOUTUBE_API_KEY");
  const youtubeOauthId = createEnvStatus(env, "YOUTUBE_CLIENT_ID");
  const youtubeOauthSecret = createEnvStatus(env, "YOUTUBE_CLIENT_SECRET");
  const googleOauthId = createEnvStatus(env, "GOOGLE_CLIENT_ID");
  const googleOauthSecret = createEnvStatus(env, "GOOGLE_CLIENT_SECRET");
  const youtubeOauthConfigured = youtubeOauthId.configured && youtubeOauthSecret.configured;
  const googleOauthConfigured = googleOauthId.configured && googleOauthSecret.configured;
  const oauthPairInvalid = youtubeOauthId.configured !== youtubeOauthSecret.configured
    || googleOauthId.configured !== googleOauthSecret.configured;
  const config = {
    disabled: hasDisabledFlag(env, "youtube"),
    configured: apiKey.configured || youtubeOauthConfigured || googleOauthConfigured,
    invalid: !apiKey.valid
      || !youtubeOauthId.valid
      || !youtubeOauthSecret.valid
      || !googleOauthId.valid
      || !googleOauthSecret.valid
      || oauthPairInvalid
  };
  const runtime = youtubeRuntimeStatus(runtimeState, now);
  const consentConfigured = youtubeOauthConfigured || googleOauthConfigured;

  return {
    id: "youtube",
    label: "YouTube",
    readiness: readinessFrom({ config, runtime }),
    capabilities: [
      {
        key: "youtube_data_access",
        label: "YouTube data access",
        state: configCapabilityState(config)
      },
      {
        key: "youtube_owner_consent",
        label: "YouTube owner consent",
        state: config.disabled ? "disabled" : consentConfigured ? "available" : "needs_setup"
      },
      {
        key: "youtube_live_chat_intake",
        label: "YouTube live chat intake",
        state: config.disabled ? "disabled" : runtimeCapabilityState(runtime)
      }
    ],
    runtime,
    guidance: guidanceFrom({
      config,
      runtime,
      setupGuidance: consentConfigured
        ? "Connect owner consent and select a channel before starting live-chat streaming."
        : "Finish YouTube owner-consent setup before starting live-chat streaming."
    })
  };
};

const buildDiscordStatus = (
  env: ProviderIntegrationEnvironment,
  runtimeState: ProviderIntegrationRuntimeState,
  now: Date
): ProviderIntegrationStatus => {
  const botToken = createEnvStatus(env, "DISCORD_BOT_TOKEN");
  const applicationId = createEnvStatus(env, "DISCORD_APPLICATION_ID");
  const guildId = createEnvStatus(env, "DISCORD_GUILD_ID");
  const clientId = createEnvStatus(env, "DISCORD_CLIENT_ID");
  const clientSecret = createEnvStatus(env, "DISCORD_CLIENT_SECRET");
  const publicKey = createEnvStatus(env, "DISCORD_PUBLIC_KEY");
  const applicationPublicKey = createEnvStatus(env, "DISCORD_APPLICATION_PUBLIC_KEY");
  const config = {
    disabled: hasDisabledFlag(env, "discord"),
    configured: botToken.configured,
    invalid: !botToken.valid
      || !applicationId.valid
      || !guildId.valid
      || !clientId.valid
      || !clientSecret.valid
      || !publicKey.valid
      || !applicationPublicKey.valid
  };
  const runtime = discordRuntimeStatus(runtimeState, now);

  return {
    id: "discord",
    label: "Discord",
    readiness: readinessFrom({ config, runtime }),
    capabilities: [
      {
        key: "discord_bot_access",
        label: "Discord bot access",
        state: configCapabilityState(config)
      },
      {
        key: "discord_guild_target",
        label: "Discord guild target",
        state: config.disabled ? "disabled" : guildId.configured ? "available" : "needs_setup"
      },
      {
        key: "discord_webhook_intake",
        label: "Discord webhook intake",
        state: config.disabled ? "disabled" : publicKey.configured || applicationPublicKey.configured ? "available" : "needs_setup"
      },
      {
        key: "discord_chat_intake",
        label: "Discord chat intake",
        state: config.disabled ? "disabled" : runtimeCapabilityState(runtime)
      }
    ],
    runtime,
    guidance: guidanceFrom({
      config,
      runtime,
      setupGuidance: "Finish Discord bot and guild setup before starting intake."
    })
  };
};

export const getProviderIntegrationStatusSnapshot = (
  env: ProviderIntegrationEnvironment = process.env,
  now = new Date(),
  runtimeState: ProviderIntegrationRuntimeState = {},
  capabilityReadiness: ProviderIntegrationCapabilityReadiness = {}
): ProviderIntegrationStatusSnapshot => ({
  ok: true,
  generatedAt: now.toISOString(),
  providers: [
    buildTwitchStatus(env, runtimeState, now, capabilityReadiness),
    buildYouTubeStatus(env, runtimeState, now),
    buildDiscordStatus(env, runtimeState, now)
  ]
});
