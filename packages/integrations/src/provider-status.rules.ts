import type { REST } from "@discordjs/rest";
import type { ApiClient } from "@twurple/api";
import type { AppTokenAuthProvider } from "@twurple/auth";
import type { youtube_v3 } from "googleapis";

export type ProviderIntegrationId = "twitch" | "youtube" | "discord";

export type ProviderIntegrationState = "configured" | "missing" | "invalid" | "disabled" | "error";

export type ProviderEnvironmentVariableKind = "identifier" | "secret";

export type ProviderEnvironmentVariableStatus = {
  name: string;
  kind: ProviderEnvironmentVariableKind;
  required: boolean;
  configured: boolean;
  valid: boolean;
};

export type ProviderIntegrationStatus = {
  id: ProviderIntegrationId;
  label: string;
  state: ProviderIntegrationState;
  sdk: string;
  readOnly: true;
  env: readonly ProviderEnvironmentVariableStatus[];
  issues: readonly string[];
  capabilities: readonly string[];
};

export type ProviderIntegrationStatusSnapshot = {
  ok: true;
  generatedAt: string;
  readOnly: true;
  providers: readonly ProviderIntegrationStatus[];
  boundaries: readonly string[];
};

export type ProviderIntegrationEnvironment = Record<string, string | undefined>;

export type TwitchProviderSdkFoundation = {
  authProvider: AppTokenAuthProvider;
  apiClient: ApiClient;
};

export type YouTubeProviderSdkFoundation = {
  youtube: youtube_v3.Youtube;
};

export type DiscordProviderSdkFoundation = {
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
  "No OAuth flow, token storage, webhook receiver, live chat ingestion, moderation action, or provider mutation is enabled.",
  "Secret values are never returned; only environment variable names, configured booleans, and sanitized validation issues are exposed.",
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

const buildTwitchStatus = (env: ProviderIntegrationEnvironment): ProviderIntegrationStatus => {
  const variables = [
    createEnvStatus(env, "TWITCH_CLIENT_ID", "identifier", true),
    createEnvStatus(env, "TWITCH_CLIENT_SECRET", "secret", true)
  ] as const;
  const issues = variables
    .map((variable) => issueForEnv(env, variable))
    .filter((issue): issue is string => issue !== null);
  const disabled = hasDisabledFlag(env, "twitch");

  return {
    id: "twitch",
    label: "Twitch",
    state: stateFrom({
      disabled,
      configured: variables.every((variable) => variable.configured),
      issues
    }),
    sdk: "@twurple/auth + @twurple/api",
    readOnly: true,
    env: variables,
    issues: disabled ? [] : issues,
    capabilities: [
      "Client credentials status foundation",
      "Read-only API client typing",
      "Future EventSub/chat intake remains gated"
    ]
  };
};

const buildYouTubeStatus = (env: ProviderIntegrationEnvironment): ProviderIntegrationStatus => {
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
      "YouTube Data API status foundation",
      "API key, YouTube OAuth client, or legacy Google OAuth client configuration detection",
      "No OAuth consent flow or token storage yet"
    ]
  };
};

const buildDiscordStatus = (env: ProviderIntegrationEnvironment): ProviderIntegrationStatus => {
  const variables = [
    createEnvStatus(env, "DISCORD_BOT_TOKEN", "secret", true),
    createEnvStatus(env, "DISCORD_APPLICATION_ID", "identifier", false),
    createEnvStatus(env, "DISCORD_GUILD_ID", "identifier", false),
    createEnvStatus(env, "DISCORD_CLIENT_ID", "identifier", false),
    createEnvStatus(env, "DISCORD_CLIENT_SECRET", "secret", false)
  ] as const;
  const issues = variables
    .map((variable) => issueForEnv(env, variable))
    .filter((issue): issue is string => issue !== null);
  const disabled = hasDisabledFlag(env, "discord");

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
      "Discord REST status foundation",
      "Optional application/guild identifiers for later read checks",
      "No Gateway connection, bot commands, or moderation actions yet"
    ]
  };
};

export const getProviderIntegrationStatusSnapshot = (
  env: ProviderIntegrationEnvironment = process.env,
  now = new Date()
): ProviderIntegrationStatusSnapshot => ({
  ok: true,
  generatedAt: now.toISOString(),
  readOnly: true,
  providers: [
    buildTwitchStatus(env),
    buildYouTubeStatus(env),
    buildDiscordStatus(env)
  ],
  boundaries: statusBoundaries
});
