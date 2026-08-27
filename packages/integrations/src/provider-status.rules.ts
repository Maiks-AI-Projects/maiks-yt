import type { REST } from "@discordjs/rest";
import type { ApiClient } from "@twurple/api";
import type { AppTokenAuthProvider } from "@twurple/auth";
import type { ChatClient } from "@twurple/chat";
import type { Client as DiscordClient } from "discord.js";
import type { youtube_v3 } from "googleapis";

import type { DiscordChatIntakeStatus } from "./discord-chat-intake.types.js";
import type { TwitchChatIntakeStatus } from "./twitch-chat-intake.types.js";
import type { YouTubeLiveChatIntakeStatus } from "./youtube-live-chat-intake.types.js";

export type ProviderIntegrationId = "twitch" | "youtube" | "discord";

export type ProviderIntegrationState = "configured" | "missing" | "invalid" | "disabled" | "error";

export type ProviderCapabilityState = "available" | "configured" | "missing" | "not_enabled" | "gated";

export type ProviderEnvironmentVariableKind = "identifier" | "secret";

export type ProviderEnvironmentVariableStatus = {
  name: string;
  kind: ProviderEnvironmentVariableKind;
  required: boolean;
  configured: boolean;
  valid: boolean;
};

export type ProviderCapabilityStatus = {
  key: string;
  label: string;
  state: ProviderCapabilityState;
  detail: string;
  runtime?: ProviderRuntimeTelemetry;
};

export type ProviderIntegrationStatus = {
  id: ProviderIntegrationId;
  label: string;
  state: ProviderIntegrationState;
  sdk: string;
  readOnly: true;
  env: readonly ProviderEnvironmentVariableStatus[];
  issues: readonly string[];
  capabilities: readonly ProviderCapabilityStatus[];
};

export type ProviderIntegrationStatusSnapshot = {
  ok: true;
  generatedAt: string;
  readOnly: true;
  providers: readonly ProviderIntegrationStatus[];
  boundaries: readonly string[];
};

export type ProviderIntegrationEnvironment = Record<string, string | undefined>;

export type ProviderIntegrationRuntimeState = {
  discordChatIntake?: DiscordChatIntakeStatus;
  discordChatIntakeState?: "stopped" | "connecting" | "connected" | "unconfigured";
  twitchChatIntake?: TwitchChatIntakeStatus;
  twitchChatIntakeState?: "stopped" | "connecting" | "connected" | "unconfigured";
  youtubeLiveChatIntake?: YouTubeLiveChatIntakeStatus;
  youtubeLiveChatIntakeState?: "stopped" | "connecting" | "waiting" | "connected" | "unconfigured";
};

export type ProviderRuntimeConnectionState =
  | "stopped"
  | "connecting"
  | "waiting"
  | "connected"
  | "unconfigured";

export type ProviderRuntimeTelemetry = {
  connectionState: ProviderRuntimeConnectionState;
  accountSummary: string | null;
  connectedAt: string | null;
  lastDisconnectAt: string | null;
  lastMessageAt: string | null;
  reconnectCount: number | null;
  nextRetryAt: string | null;
  reconnectSuppressed: boolean | null;
  lastError: string | null;
  autoStartEnabled: boolean;
};

export type TwitchProviderSdkFoundation = {
  authProvider: AppTokenAuthProvider;
  apiClient: ApiClient;
  chatClient?: ChatClient;
};

export type YouTubeProviderSdkFoundation = {
  youtube: youtube_v3.Youtube;
};

export type DiscordProviderSdkFoundation = {
  gatewayClient?: DiscordClient;
  rest: REST;
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

const statusBoundaries = [
  "Read-only provider integration configuration snapshot.",
  "YouTube owner OAuth can store a read-only live-chat credential; no webhook receiver, provider write, moderation action, or provider mutation is enabled.",
  "Secret values are never returned; only environment variable names, configured booleans, and sanitized validation issues are exposed.",
  "Runtime telemetry is allowlisted to connection state, safe account/channel summaries, timestamps, reconnect counters, retry policy, sanitized error text, and auto-start policy.",
  "Missing provider environment variables produce safe missing status instead of crashing startup."
] as const;

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
  name: string,
  kind: ProviderEnvironmentVariableKind,
  required: boolean
): ProviderEnvironmentVariableStatus => ({
  name,
  kind,
  required,
  configured: isPresent(env[name]) && isUsableValue(env[name]),
  valid: required ? isUsableValue(env[name]) : !isPresent(env[name]) || isUsableValue(env[name])
});

const issueForEnv = (
  env: ProviderIntegrationEnvironment,
  variable: ProviderEnvironmentVariableStatus
): string | null => {
  if (!variable.required && !isPresent(env[variable.name])) {
    return null;
  }

  if (!isPresent(env[variable.name])) {
    return `${variable.name} is missing.`;
  }

  if (!isUsableValue(env[variable.name])) {
    return `${variable.name} is empty or looks like a placeholder.`;
  }

  return null;
};

const hasDisabledFlag = (
  env: ProviderIntegrationEnvironment,
  providerId: ProviderIntegrationId
): boolean =>
  isTruthyFlag(env.PROVIDER_INTEGRATIONS_DISABLED)
  || isTruthyFlag(env[`${providerId.toUpperCase()}_INTEGRATION_DISABLED`]);

const isAutoStartEnabled = (env: ProviderIntegrationEnvironment, name: string): boolean =>
  env[name]?.trim().toLowerCase() !== "false";

const normalizeTimestamp = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const boundedCount = (value: number | null | undefined): number | null => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null;
  }

  return Math.min(value, 999);
};

const sanitizeSummaryText = (value: string | null | undefined): string | null => {
  const compact = value?.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim() ?? "";

  return compact.length > 0 ? compact.slice(0, 80) : null;
};

const safeTwitchChannelName = (value: string | null | undefined): string | null => {
  const normalized = value?.trim().replace(/^#/, "").toLowerCase() ?? "";

  return /^[a-z0-9_]{1,25}$/.test(normalized) ? normalized : null;
};

const joinSafeNames = (names: readonly string[]): string | null => {
  const visibleNames = names.slice(0, 3);
  const suffix = names.length > visibleNames.length ? ` + ${names.length - visibleNames.length} more` : "";

  return visibleNames.length > 0 ? `${visibleNames.join(" + ")}${suffix}` : null;
};

const createSensitiveValuePatterns = (
  env: ProviderIntegrationEnvironment,
  variables: readonly ProviderEnvironmentVariableStatus[]
): readonly RegExp[] => {
  const values = [
    ...variables.map((variable) => env[variable.name]?.trim() ?? ""),
    ...Object.entries(env)
      .filter(([name]) => /(?:TOKEN|SECRET|PASSWORD|API_KEY|AUTHORIZATION|COOKIE)/i.test(name))
      .map(([, value]) => value?.trim() ?? "")
  ];

  return values
    .filter((value, index, values) => value.length >= 3 && values.indexOf(value) === index)
    .map((value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"));
};

const sanitizeRuntimeError = (
  value: string | null | undefined,
  sensitiveValuePatterns: readonly RegExp[]
): string | null => {
  const compact = value?.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim() ?? "";

  if (compact.length === 0) {
    return null;
  }

  let sanitized = compact;
  for (const pattern of sensitiveValuePatterns) {
    sanitized = sanitized.replace(pattern, "[redacted]");
  }

  sanitized = sanitized
    .replace(/\b(authorization|cookie|set-cookie)\s*:\s*[^,\s)]+/gi, "$1: [redacted]")
    .replace(/\b(bearer|basic)\s+[a-z0-9._~+/=-]+/gi, "$1 [redacted]")
    .replace(/\b(access[_-]?token|refresh[_-]?token|api[_-]?key|client[_-]?secret|secret|token|password)\s*[:=]\s*["']?[^"',\s)]+/gi, "$1=[redacted]")
    .replace(/\b(guild[_-]?id|channel[_-]?id|user[_-]?id|message[_-]?id|client[_-]?id|provider[_-]?id|broadcaster[_-]?id|account[_-]?id|live[_-]?chat[_-]?id|video[_-]?id|subscription[_-]?id)\s*[:=]\s*["']?[^"',\s)]+/gi, "$1=[redacted-id]")
    .replace(/\b(raw[_-]?payload|payload|body|headers?)\s*[:=]\s*["']?[^"',\s)]+/gi, "$1=[redacted]")
    .replace(/\b\d{17,20}\b/g, "[redacted-id]")
    .replace(/\bUC[a-z0-9_-]{22}\b/gi, "[redacted-id]")
    .replace(/https?:\/\/[^\s?#]+[^\s]*/gi, (match) => {
      try {
        const url = new URL(match);
        return `${url.origin}${url.pathname === "/" ? "/" : "/[redacted-path]"}${url.search || url.hash ? "[redacted]" : ""}`;
      } catch {
        return "[redacted-url]";
      }
    });

  return sanitized.slice(0, 180);
};

const runtimeCapabilityState = (
  state: ProviderRuntimeConnectionState | undefined
): ProviderCapabilityState => {
  if (state === "connected") {
    return "configured";
  }

  if (state === "connecting" || state === "waiting" || state === "stopped") {
    return "available";
  }

  if (state === "unconfigured") {
    return "missing";
  }

  return "not_enabled";
};

const twitchRuntimeTelemetry = (
  env: ProviderIntegrationEnvironment,
  variables: readonly ProviderEnvironmentVariableStatus[],
  runtimeState: ProviderIntegrationRuntimeState
): ProviderRuntimeTelemetry | undefined => {
  const status = runtimeState.twitchChatIntake;
  const state = status?.state ?? runtimeState.twitchChatIntakeState;

  if (!state) {
    return undefined;
  }

  const names = status?.channelNames
    .map((name) => safeTwitchChannelName(name))
    .filter((name): name is string => name !== null) ?? [];

  return {
    connectionState: state,
    accountSummary: joinSafeNames(names) ?? safeTwitchChannelName(status?.channelName) ?? null,
    connectedAt: normalizeTimestamp(status?.connectedAt),
    lastDisconnectAt: normalizeTimestamp(status?.lastDisconnectAt),
    lastMessageAt: normalizeTimestamp(status?.lastMessageAt),
    reconnectCount: boundedCount(status?.disconnectsInWindow),
    nextRetryAt: normalizeTimestamp(status?.nextReconnectAt),
    reconnectSuppressed: typeof status?.reconnectSuppressed === "boolean" ? status.reconnectSuppressed : null,
    lastError: sanitizeRuntimeError(status?.lastError, createSensitiveValuePatterns(env, variables)),
    autoStartEnabled: isAutoStartEnabled(env, "TWITCH_CHAT_AUTO_START")
  };
};

const youtubeRuntimeTelemetry = (
  env: ProviderIntegrationEnvironment,
  variables: readonly ProviderEnvironmentVariableStatus[],
  runtimeState: ProviderIntegrationRuntimeState
): ProviderRuntimeTelemetry | undefined => {
  const status = runtimeState.youtubeLiveChatIntake;
  const state = status?.state ?? runtimeState.youtubeLiveChatIntakeState;

  if (!state) {
    return undefined;
  }

  return {
    connectionState: state,
    accountSummary: sanitizeSummaryText(status?.channelName),
    connectedAt: normalizeTimestamp(status?.connectedAt),
    lastDisconnectAt: null,
    lastMessageAt: normalizeTimestamp(status?.lastMessageAt),
    reconnectCount: null,
    nextRetryAt: normalizeTimestamp(status?.nextPollAt),
    reconnectSuppressed: null,
    lastError: sanitizeRuntimeError(status?.lastError, createSensitiveValuePatterns(env, variables)),
    autoStartEnabled: isAutoStartEnabled(env, "YOUTUBE_LIVE_CHAT_AUTO_START")
  };
};

const discordRuntimeTelemetry = (
  env: ProviderIntegrationEnvironment,
  variables: readonly ProviderEnvironmentVariableStatus[],
  runtimeState: ProviderIntegrationRuntimeState
): ProviderRuntimeTelemetry | undefined => {
  const status = runtimeState.discordChatIntake;
  const state = status?.state ?? runtimeState.discordChatIntakeState;

  if (!state) {
    return undefined;
  }

  const configuredChannelCount = status?.channelIds.length ?? 0;

  return {
    connectionState: state,
    accountSummary: configuredChannelCount > 0
      ? `${Math.min(configuredChannelCount, 999)} configured channels`
      : status?.guildId
        ? "Guild-wide intake"
        : null,
    connectedAt: normalizeTimestamp(status?.connectedAt),
    lastDisconnectAt: normalizeTimestamp(status?.lastDisconnectAt),
    lastMessageAt: normalizeTimestamp(status?.lastMessageAt),
    reconnectCount: boundedCount(status?.disconnectsInWindow),
    nextRetryAt: normalizeTimestamp(status?.nextReconnectAt),
    reconnectSuppressed: typeof status?.reconnectSuppressed === "boolean" ? status.reconnectSuppressed : null,
    lastError: sanitizeRuntimeError(status?.lastError, createSensitiveValuePatterns(env, variables)),
    autoStartEnabled: isAutoStartEnabled(env, "DISCORD_CHAT_AUTO_START")
  };
};

const stateFrom = ({
  disabled,
  configured,
  issues
}: {
  disabled: boolean;
  configured: boolean;
  issues: readonly string[];
}): ProviderIntegrationState => {
  if (disabled) {
    return "disabled";
  }

  if (issues.some((issue) => !issue.endsWith(" is missing."))) {
    return "invalid";
  }

  return configured ? "configured" : "missing";
};

const buildTwitchStatus = (
  env: ProviderIntegrationEnvironment,
  runtimeState: ProviderIntegrationRuntimeState
): ProviderIntegrationStatus => {
  const variables = [
    createEnvStatus(env, "TWITCH_CLIENT_ID", "identifier", true),
    createEnvStatus(env, "TWITCH_CLIENT_SECRET", "secret", true),
    createEnvStatus(env, "TWITCH_EVENTSUB_WEBHOOK_SECRET", "secret", false)
  ] as const;
  const requiredVariables = variables.filter((variable) => variable.required);
  const issues = variables
    .map((variable) => issueForEnv(env, variable))
    .filter((issue): issue is string => issue !== null);
  const disabled = hasDisabledFlag(env, "twitch");
  const runtime = twitchRuntimeTelemetry(env, variables, runtimeState);

  return {
    id: "twitch",
    label: "Twitch",
    state: stateFrom({
      disabled,
      configured: requiredVariables.every((variable) => variable.configured),
      issues
    }),
    sdk: "@twurple/auth + @twurple/api + @twurple/chat",
    readOnly: true,
    env: variables,
    issues: disabled ? [] : issues,
    capabilities: [
      {
        key: "twitch-api-client",
        label: "Helix API client",
        state: requiredVariables.every((variable) => variable.configured) ? "configured" : "missing",
        detail: "App-token API client foundation is available for read-only Twitch API checks."
      },
      {
        key: "twitch-chat-library",
        label: "Twitch chat library",
        state: "available",
        detail: "@twurple/chat is installed for read-only chat intake."
      },
      {
        key: "twitch-chat-runtime",
        label: "Twitch chat runtime",
        state: runtimeCapabilityState(runtime?.connectionState),
        detail: runtime?.connectionState === "connected"
          ? "Read-only Twitch chat intake is connected on this API runtime."
          : runtime?.connectionState === "connecting"
            ? "Read-only Twitch chat intake is currently connecting."
            : runtime?.connectionState === "unconfigured"
              ? "Twitch chat intake has no usable channel configuration."
              : runtime?.connectionState === "stopped"
                ? "Read-only Twitch chat intake is available and stopped."
                : "Read-only Twitch chat intake runtime telemetry is unavailable.",
        ...(runtime ? { runtime } : {})
      },
      {
        key: "twitch-eventsub",
        label: "Twitch EventSub",
        state: variables.find((variable) => variable.name === "TWITCH_EVENTSUB_WEBHOOK_SECRET")?.configured
          ? "configured"
          : "missing",
        detail: "Webhook receiver can verify and log EventSub notifications; subscription creation remains separate."
      }
    ]
  };
};

const buildYouTubeStatus = (
  env: ProviderIntegrationEnvironment,
  runtimeState: ProviderIntegrationRuntimeState
): ProviderIntegrationStatus => {
  const variables = [
    createEnvStatus(env, "YOUTUBE_API_KEY", "secret", false),
    createEnvStatus(env, "YOUTUBE_CLIENT_ID", "identifier", false),
    createEnvStatus(env, "YOUTUBE_CLIENT_SECRET", "secret", false),
    createEnvStatus(env, "GOOGLE_CLIENT_ID", "identifier", false),
    createEnvStatus(env, "GOOGLE_CLIENT_SECRET", "secret", false)
  ] as const;
  const apiKeyConfigured = variables[0].configured;
  const youtubeOauthIdConfigured = variables[1].configured;
  const youtubeOauthSecretConfigured = variables[2].configured;
  const googleOauthIdConfigured = variables[3].configured;
  const googleOauthSecretConfigured = variables[4].configured;
  const issues = variables
    .map((variable) => issueForEnv(env, variable))
    .filter((issue): issue is string => issue !== null);

  if (youtubeOauthIdConfigured !== youtubeOauthSecretConfigured) {
    issues.push("YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be configured together.");
  }

  if (googleOauthIdConfigured !== googleOauthSecretConfigured) {
    issues.push("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together.");
  }

  const disabled = hasDisabledFlag(env, "youtube");
  const runtime = youtubeRuntimeTelemetry(env, variables, runtimeState);

  return {
    id: "youtube",
    label: "YouTube",
    state: stateFrom({
      disabled,
      configured: apiKeyConfigured
        || (youtubeOauthIdConfigured && youtubeOauthSecretConfigured)
        || (googleOauthIdConfigured && googleOauthSecretConfigured),
      issues
    }),
    sdk: "googleapis",
    readOnly: true,
    env: variables,
    issues: disabled ? [] : issues,
    capabilities: [
      {
        key: "youtube-data-api-client",
        label: "YouTube Data API client",
        state: "available",
        detail: "googleapis is installed for YouTube Data API calls."
      },
      {
        key: "youtube-oauth-client",
        label: "YouTube OAuth client",
        state: (youtubeOauthIdConfigured && youtubeOauthSecretConfigured)
          || (googleOauthIdConfigured && googleOauthSecretConfigured)
          ? "configured"
          : "missing",
        detail: "OAuth client credentials are required for owner-authorized channel and live-chat access."
      },
      {
        key: "youtube-oauth-consent",
        label: "YouTube owner consent",
        state: (youtubeOauthIdConfigured && youtubeOauthSecretConfigured)
          || (googleOauthIdConfigured && googleOauthSecretConfigured)
          ? "available"
          : "missing",
        detail: "Owner-gated OAuth consent can store a read-only YouTube live-chat credential."
      },
      {
        key: "youtube-live-chat-runtime",
        label: "YouTube live chat runtime",
        state: runtimeCapabilityState(runtime?.connectionState),
        detail: runtime?.connectionState === "connected"
          ? "Read-only YouTube live-chat polling is connected on this API runtime."
          : runtime?.connectionState === "waiting"
            ? "Read-only YouTube live-chat polling is waiting for an active live chat."
            : runtime?.connectionState === "connecting"
              ? "Read-only YouTube live-chat polling is checking for an active live chat."
              : runtime?.connectionState === "unconfigured"
                ? "YouTube live-chat polling needs an active owner credential and selected channel."
                : runtime?.connectionState === "stopped"
                  ? "Read-only YouTube live-chat polling is available and stopped."
                  : "Read-only YouTube live-chat polling runtime telemetry is unavailable.",
        ...(runtime ? { runtime } : {})
      }
    ]
  };
};

const buildDiscordStatus = (
  env: ProviderIntegrationEnvironment,
  runtimeState: ProviderIntegrationRuntimeState
): ProviderIntegrationStatus => {
  const variables = [
    createEnvStatus(env, "DISCORD_BOT_TOKEN", "secret", true),
    createEnvStatus(env, "DISCORD_APPLICATION_ID", "identifier", false),
    createEnvStatus(env, "DISCORD_GUILD_ID", "identifier", false),
    createEnvStatus(env, "DISCORD_CLIENT_ID", "identifier", false),
    createEnvStatus(env, "DISCORD_CLIENT_SECRET", "secret", false),
    createEnvStatus(env, "DISCORD_PUBLIC_KEY", "identifier", false),
    createEnvStatus(env, "DISCORD_APPLICATION_PUBLIC_KEY", "identifier", false)
  ] as const;
  const issues = variables
    .map((variable) => issueForEnv(env, variable))
    .filter((issue): issue is string => issue !== null);
  const disabled = hasDisabledFlag(env, "discord");
  const runtime = discordRuntimeTelemetry(env, variables, runtimeState);

  return {
    id: "discord",
    label: "Discord",
    state: stateFrom({
      disabled,
      configured: variables[0].configured,
      issues
    }),
    sdk: "@discordjs/rest",
    readOnly: true,
    env: variables,
    issues: disabled ? [] : issues,
    capabilities: [
      {
        key: "discord-rest-client",
        label: "Discord REST client",
        state: "available",
        detail: "@discordjs/rest is installed for read-only bot and guild checks."
      },
      {
        key: "discord-bot-token",
        label: "Discord bot token",
        state: variables[0].configured ? "configured" : "missing",
        detail: "Bot token presence is required before Discord bot or guild reads."
      },
      {
        key: "discord-guild-target",
        label: "Discord guild target",
        state: variables[2].configured ? "configured" : "missing",
        detail: "Guild ID presence is checked here; actual guild access is verified by a separate read-only smoke."
      },
      {
        key: "discord-gateway-library",
        label: "Discord Gateway library",
        state: "available",
        detail: "discord.js is installed for read-only Gateway/message intake."
      },
      {
        key: "discord-webhook-events",
        label: "Discord webhook events",
        state: variables[5].configured || variables[6].configured ? "configured" : "missing",
        detail: "Verified webhook event receiver can log Discord app webhooks when the application public key is configured."
      },
      {
        key: "discord-chat-runtime",
        label: "Discord chat runtime",
        state: runtimeCapabilityState(runtime?.connectionState),
        detail: runtime?.connectionState === "connected"
          ? "Read-only Discord Gateway chat intake is connected on this API runtime."
          : runtime?.connectionState === "connecting"
            ? "Read-only Discord Gateway chat intake is currently connecting."
            : runtime?.connectionState === "unconfigured"
              ? "Discord chat intake is missing a bot token or guild target."
              : runtime?.connectionState === "stopped"
                ? "Read-only Discord Gateway chat intake is available and stopped."
                : "Read-only Discord Gateway chat intake runtime telemetry is unavailable.",
        ...(runtime ? { runtime } : {})
      }
    ]
  };
};

export const getProviderIntegrationStatusSnapshot = (
  env: ProviderIntegrationEnvironment = process.env,
  now = new Date(),
  runtimeState: ProviderIntegrationRuntimeState = {}
): ProviderIntegrationStatusSnapshot => ({
  ok: true,
  generatedAt: now.toISOString(),
  readOnly: true,
  providers: [
    buildTwitchStatus(env, runtimeState),
    buildYouTubeStatus(env, runtimeState),
    buildDiscordStatus(env, runtimeState)
  ],
  boundaries: statusBoundaries
});
