import {
  twitchChatReplyRequiredScopes,
  type TwitchChatReplyReadinessStatus
} from "./twitch-chat-reply-readiness.types.js";

type FetchLike = (url: string, init: {
  headers: Record<string, string>;
  method: "GET";
  signal?: AbortSignal;
}) => Promise<{
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
}>;

const twitchValidateTokenUrl = "https://id.twitch.tv/oauth2/validate";
const defaultTimeoutMs = 2_500;

const normalizeEnv = (value: string | undefined): string => value?.trim() ?? "";

const isTruthyFlag = (value: string | undefined): boolean => {
  const normalized = value?.trim().toLowerCase();

  return normalized === "1"
    || normalized === "true"
    || normalized === "yes"
    || normalized === "disabled";
};

const hasTwitchDisabledFlag = (env: Record<string, string | undefined>): boolean =>
  isTruthyFlag(env.PROVIDER_INTEGRATIONS_DISABLED) || isTruthyFlag(env.TWITCH_INTEGRATION_DISABLED);

const resolveAccessToken = (env: Record<string, string | undefined>): string =>
  normalizeEnv(
    env.TWITCH_CHAT_BOT_ACCESS_TOKEN
    ?? env.TWITCH_BOT_ACCESS_TOKEN
    ?? env.TWITCH_ACCESS_TOKEN
  );

const parseValidationPayload = (
  payload: unknown
): { clientId: string; scopes: readonly string[] } | null => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const clientId = (payload as { client_id?: unknown }).client_id;
  const scopes = (payload as { scopes?: unknown }).scopes;

  if (
    typeof clientId !== "string"
    || !Array.isArray(scopes)
    || !scopes.every((scope): scope is string => typeof scope === "string")
  ) {
    return null;
  }

  return {
    clientId,
    scopes
  };
};

export const validateTwitchChatReplyReadiness = async (options: {
  env?: Record<string, string | undefined>;
  fetchFn?: FetchLike;
  timeoutMs?: number;
} = {}): Promise<TwitchChatReplyReadinessStatus> => {
  const env = options.env ?? process.env;
  const clientId = normalizeEnv(env.TWITCH_CLIENT_ID);
  const accessToken = resolveAccessToken(env);

  if (hasTwitchDisabledFlag(env)) {
    return {
      issue: null,
      state: "disabled"
    };
  }

  if (!clientId || !accessToken) {
    return {
      issue: "missing_configuration",
      state: "needs_setup"
    };
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(1, Math.min(options.timeoutMs ?? defaultTimeoutMs, 10_000));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await (options.fetchFn ?? fetch)(twitchValidateTokenUrl, {
      headers: {
        Authorization: `OAuth ${accessToken}`
      },
      method: "GET",
      signal: controller.signal
    });

    if (response.status === 401) {
      return {
        issue: "invalid_access_token",
        state: "needs_attention"
      };
    }

    if (!response.ok) {
      return {
        issue: "validation_unavailable",
        state: "needs_attention"
      };
    }

    const parsed = parseValidationPayload(await response.json());

    if (!parsed) {
      return {
        issue: "validation_unavailable",
        state: "needs_attention"
      };
    }

    if (parsed.clientId !== clientId) {
      return {
        issue: "client_mismatch",
        state: "needs_attention"
      };
    }

    const grantedScopes = new Set(parsed.scopes);
    const hasRequiredScopes = twitchChatReplyRequiredScopes.every((scope) => grantedScopes.has(scope));

    return hasRequiredScopes
      ? {
        issue: null,
        state: "available"
      }
      : {
        issue: "missing_scope",
        state: "needs_attention"
      };
  } catch {
    return {
      issue: "validation_unavailable",
      state: "needs_attention"
    };
  } finally {
    clearTimeout(timeout);
  }
};
