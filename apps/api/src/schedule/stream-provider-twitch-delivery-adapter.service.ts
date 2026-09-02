import type { DatabasePool } from "@maiks-yt/database";
import {
  TwitchStreamScheduleDeliveryService,
  type TwitchStreamScheduleDeliveryContext
} from "@maiks-yt/integrations";

import {
  createProviderRuntimeCredentialCipherFromEnvironment,
  revealProviderRuntimeCredentialTokens
} from "../provider-integrations/provider-runtime-credential-token-crypto.service.js";
import type { AuthDataCipher } from "../auth/auth-sensitive-field-crypto.service.js";
import type {
  StreamProviderDeliveryAdapter,
  StreamProviderDeliveryAdapterRequest,
  StreamProviderDeliveryAdapterResult
} from "./stream-provider-delivery-processor.service.js";

type QueryExecutor = Pick<DatabasePool, "execute">;

export type TwitchDeliveryContextRepository = {
  resolveTwitchDeliveryContext(providerChannelId: string): Promise<TwitchStreamScheduleDeliveryContext | null>;
};

const parseScopes = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((scope): scope is string => typeof scope === "string");
  }
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((scope): scope is string => typeof scope === "string")
      : [];
  } catch {
    return [];
  }
};

const trimToNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const createTwitchDeliveryContextRepository = (
  pool: QueryExecutor,
  options: {
    cipher?: AuthDataCipher | null;
    env?: Record<string, string | undefined>;
  } = {}
): TwitchDeliveryContextRepository => ({
  async resolveTwitchDeliveryContext(providerChannelId) {
    const [rows] = await pool.execute(
      `
        SELECT
          credentials.access_token AS accessToken,
          credentials.provider_account_id AS providerAccountId,
          credentials.scopes
        FROM provider_channel_identities channels
        INNER JOIN provider_runtime_credentials credentials
          ON credentials.owner_user_id = channels.owner_user_id
          AND credentials.provider = 'twitch'
          AND credentials.purpose = 'twitch_eventsub'
          AND credentials.status = 'active'
          AND credentials.revoked_at IS NULL
          AND (
            credentials.provider_account_id IS NULL
            OR credentials.provider_account_id = channels.provider_channel_id
          )
        WHERE channels.provider = 'twitch'
          AND channels.provider_channel_id = ?
        ORDER BY credentials.provider_account_id IS NULL, credentials.updated_at DESC
        LIMIT 1
      `,
      [providerChannelId]
    );
    const row = Array.isArray(rows)
      ? rows[0] as {
        accessToken: string | null;
        providerAccountId: string | null;
        scopes: unknown;
      } | undefined
      : undefined;
    const clientId = trimToNull((options.env ?? process.env).TWITCH_CLIENT_ID);

    if (!row || !clientId) {
      return null;
    }

    const tokens = revealProviderRuntimeCredentialTokens(
      {
        accessToken: row.accessToken,
        refreshToken: null
      },
      options.cipher === undefined
        ? createProviderRuntimeCredentialCipherFromEnvironment()
        : options.cipher
    );
    const accessToken = trimToNull(tokens.accessToken);

    return accessToken
      ? {
        accessToken,
        broadcasterId: row.providerAccountId ?? providerChannelId,
        clientId,
        scopes: parseScopes(row.scopes)
      }
      : null;
  }
});

const toTwitchOperation = (
  operation: StreamProviderDeliveryAdapterRequest["operation"]
): "schedule-segment" | "channel-metadata" | null => {
  if (operation === "twitch.schedule-segment") return "schedule-segment";
  if (operation === "twitch.channel-metadata") return "channel-metadata";
  return null;
};

export class StreamProviderTwitchDeliveryAdapter implements StreamProviderDeliveryAdapter {
  public constructor(private readonly input: {
    contextRepository: TwitchDeliveryContextRepository;
    deliveryService?: Pick<TwitchStreamScheduleDeliveryService, "deliver">;
  }) {}

  public async dispatch(request: StreamProviderDeliveryAdapterRequest): Promise<StreamProviderDeliveryAdapterResult> {
    const operation = toTwitchOperation(request.operation);

    if (request.provider !== "twitch" || !operation) {
      return {
        ok: false,
        outcome: "unsupported",
        reason: "twitch-delivery-operation-unsupported",
        message: "This Twitch delivery adapter only handles Twitch schedule and metadata operations."
      };
    }

    const context = await this.input.contextRepository.resolveTwitchDeliveryContext(request.channel.providerChannelId);
    const result = await (this.input.deliveryService ?? new TwitchStreamScheduleDeliveryService()).deliver({
      context,
      currentProviderState: request.currentProviderState,
      operation,
      providerChannelId: request.channel.providerChannelId,
      schedule: request.schedule
    });

    return result.ok
      ? {
        ok: true,
        outcome: "ready",
        providerActionId: result.providerActionId,
        receipt: result.receipt
      }
      : result;
  }
}

export const createUnavailableYouTubeDeliveryAdapter = (): StreamProviderDeliveryAdapter => ({
  async dispatch() {
    return {
      ok: false,
      outcome: "degraded",
      reason: "provider-adapter-unavailable",
      message: "No YouTube provider delivery adapter is configured for schedule delivery yet.",
      retryAfterSeconds: 86_400
    };
  }
});
