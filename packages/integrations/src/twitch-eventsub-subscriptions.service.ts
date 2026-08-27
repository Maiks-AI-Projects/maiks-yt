import {
  projectTwitchEventSubDefaultStatuses,
  buildTwitchEventSubCondition,
  isTwitchEventSubSubscriptionScopedToBroadcaster,
  normalizeTwitchEventSubBroadcasterLogin,
  resolveTwitchEventSubSubscriptionConfig,
  summarizeTwitchEventSubSubscription
} from "./twitch-eventsub-subscriptions.rules.js";
import type {
  TwitchEventSubEnsureDefaultsResult,
  TwitchEventSubEnsureSubscriptionResult,
  TwitchEventSubHelixSubscription,
  TwitchEventSubHelixTransport,
  TwitchEventSubSubscriptionListResult,
  TwitchEventSubSubscriptionSummary
} from "./twitch-eventsub-subscriptions.types.js";
import { twitchEventSubDefaultSubscriptions } from "./twitch-eventsub-subscriptions.rules.js";

const twitchTokenUrl = "https://id.twitch.tv/oauth2/token";
const helixBaseUrl = "https://api.twitch.tv/helix";

const parseJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
};

const getDataArray = (value: unknown): readonly unknown[] | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const data = (value as { data?: unknown }).data;

  return Array.isArray(data) ? data : null;
};

const asSubscription = (value: unknown): TwitchEventSubHelixSubscription | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as TwitchEventSubHelixSubscription
    : null;

const getPaginationCursor = (value: unknown): string | null | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const pagination = (value as { pagination?: unknown }).pagination;
  if (!pagination || typeof pagination !== "object" || Array.isArray(pagination)) {
    return undefined;
  }

  const cursor = (pagination as { cursor?: unknown }).cursor;

  return cursor === undefined ? null : typeof cursor === "string" && cursor.trim() ? cursor : undefined;
};

const maxEventSubSubscriptionPages = 20;
const eventSubSubscriptionPageSize = 100;

export const createTwitchEventSubHelixTransport = (): TwitchEventSubHelixTransport => ({
  async createSubscription(input) {
    const response = await fetch(`${helixBaseUrl}/eventsub/subscriptions`, {
      body: JSON.stringify({
        condition: input.condition,
        transport: {
          callback: input.callbackUrl,
          method: "webhook",
          secret: input.secret
        },
        type: input.type,
        version: input.version
      }),
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        "client-id": input.clientId,
        "content-type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      return null;
    }

    const data = getDataArray(await parseJson(response));
    const subscription = data?.[0];

    return asSubscription(subscription);
  },

  async getAppAccessToken(input) {
    const body = new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      grant_type: "client_credentials"
    });
    const response = await fetch(twitchTokenUrl, {
      body,
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      method: "POST"
    });

    if (!response.ok) {
      return null;
    }

    const payload = await parseJson(response);
    const accessToken = payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as { access_token?: unknown }).access_token
      : null;

    return typeof accessToken === "string" && accessToken.trim() ? accessToken : null;
  },

  async getUserByLogin(input) {
    const url = new URL(`${helixBaseUrl}/users`);
    url.searchParams.set("login", input.login);
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        "client-id": input.clientId
      }
    });

    if (!response.ok) {
      return null;
    }

    const user = getDataArray(await parseJson(response))?.[0];
    if (!user || typeof user !== "object" || Array.isArray(user)) {
      return null;
    }

    const id = (user as { id?: unknown }).id;
    const login = (user as { login?: unknown }).login;

    return typeof id === "string" && typeof login === "string" ? { id, login } : null;
  },

  async listSubscriptions(input) {
    try {
      const subscriptions: TwitchEventSubHelixSubscription[] = [];
      const seenCursors = new Set<string>();
      let after: string | null = null;

      for (let page = 0; page < maxEventSubSubscriptionPages; page += 1) {
        const url = new URL(`${helixBaseUrl}/eventsub/subscriptions`);
        url.searchParams.set("first", String(eventSubSubscriptionPageSize));
        if (after) {
          url.searchParams.set("after", after);
        }

        const response = await fetch(url, {
          headers: {
            authorization: `Bearer ${input.accessToken}`,
            "client-id": input.clientId
          }
        });

        if (!response.ok) {
          return null;
        }

        const payload = await parseJson(response);
        const data = getDataArray(payload);
        const nextCursor = getPaginationCursor(payload);

        if (!data || nextCursor === undefined) {
          return null;
        }

        subscriptions.push(
          ...data
            .map((item) => asSubscription(item))
            .filter((item): item is TwitchEventSubHelixSubscription => item !== null)
        );

        if (!nextCursor) {
          return subscriptions;
        }

        if (seenCursors.has(nextCursor)) {
          return null;
        }

        seenCursors.add(nextCursor);
        after = nextCursor;
      }

      return null;
    } catch {
      return null;
    }
  }
});

export class TwitchEventSubSubscriptionService {
  public constructor(
    private readonly options: {
      env?: Record<string, string | undefined>;
      transport?: TwitchEventSubHelixTransport;
    } = {}
  ) {}

  public async listDefaults(input: { broadcasterLogin?: string } = {}): Promise<TwitchEventSubSubscriptionListResult> {
    const context = await this.resolveContext(input);
    if (!context.ok) {
      return {
        ok: false,
        reason: context.reason
      };
    }

    return {
      ok: true,
      broadcasterLogin: context.broadcasterLogin,
      broadcasterLogins: context.broadcasterLogins,
      broadcasterUserId: context.broadcasterUserId,
      callbackUrl: context.callbackUrl,
      defaults: projectTwitchEventSubDefaultStatuses({
        broadcasterUserId: context.broadcasterUserId,
        subscriptions: context.subscriptions
      }),
      readOnly: true,
      subscriptions: context.subscriptions
    };
  }

  public async ensureDefaults(input: { broadcasterLogin?: string } = {}): Promise<TwitchEventSubEnsureDefaultsResult> {
    const context = await this.resolveContext(input);
    if (!context.ok) {
      return {
        ok: false,
        reason: context.reason
      };
    }

    const results: TwitchEventSubEnsureSubscriptionResult[] = [];

    for (const desired of twitchEventSubDefaultSubscriptions) {
      const existing = projectTwitchEventSubDefaultStatuses({
        broadcasterUserId: context.broadcasterUserId,
        subscriptions: context.subscriptions
      }).find((entry) => entry.desired.type === desired.type && entry.desired.version === desired.version)?.existing ?? null;

      if (existing?.status === "enabled") {
        results.push({
          created: null,
          desired,
          existing,
          state: "already_enabled"
        });
        continue;
      }

      if (existing?.status === "webhook_callback_verification_pending") {
        results.push({
          created: null,
          desired,
          existing,
          state: "already_pending"
        });
        continue;
      }

      const createdRaw = await context.transport.createSubscription({
        accessToken: context.accessToken,
        callbackUrl: context.callbackUrl,
        clientId: context.clientId,
        condition: {
          ...buildTwitchEventSubCondition(desired, context.broadcasterUserId)
        },
        secret: context.secret,
        type: desired.type,
        version: desired.version
      });
      const created = createdRaw ? summarizeTwitchEventSubSubscription(createdRaw, context.callbackUrl) : null;

      results.push({
        created,
        desired,
        existing,
        state: created ? "created" : "create_failed"
      });
    }

    return {
      ok: true,
      broadcasterLogin: context.broadcasterLogin,
      broadcasterLogins: context.broadcasterLogins,
      broadcasterUserId: context.broadcasterUserId,
      callbackUrl: context.callbackUrl,
      results
    };
  }

  private async resolveContext(input: { broadcasterLogin?: string }): Promise<
    | {
      ok: true;
      accessToken: string;
      broadcasterLogin: string;
      broadcasterLogins: readonly string[];
      broadcasterUserId: string;
      callbackUrl: string;
      clientId: string;
      secret: string;
      subscriptions: readonly TwitchEventSubSubscriptionSummary[];
      transport: TwitchEventSubHelixTransport;
    }
    | {
      ok: false;
      reason:
        | "twitch_eventsub_config_missing"
        | "twitch_eventsub_broadcaster_not_configured"
        | "twitch_eventsub_broadcaster_not_found"
        | "twitch_eventsub_api_unavailable";
    }
  > {
    const config = resolveTwitchEventSubSubscriptionConfig(this.options.env ?? process.env);
    if (!config) {
      return {
        ok: false,
        reason: "twitch_eventsub_config_missing"
      };
    }

    const requestedLogin = normalizeTwitchEventSubBroadcasterLogin(input.broadcasterLogin ?? config.broadcasterLogin);
    if (!requestedLogin || !config.broadcasterLogins.includes(requestedLogin)) {
      return {
        ok: false,
        reason: "twitch_eventsub_broadcaster_not_configured"
      };
    }

    const transport = this.options.transport ?? createTwitchEventSubHelixTransport();
    const accessToken = await transport.getAppAccessToken({
      clientId: config.clientId,
      clientSecret: config.clientSecret
    });
    if (!accessToken) {
      return {
        ok: false,
        reason: "twitch_eventsub_api_unavailable"
      };
    }

    const broadcaster = await transport.getUserByLogin({
      accessToken,
      clientId: config.clientId,
      login: requestedLogin
    });
    if (!broadcaster) {
      return {
        ok: false,
        reason: "twitch_eventsub_broadcaster_not_found"
      };
    }

    const rawSubscriptions = await transport.listSubscriptions({
      accessToken,
      clientId: config.clientId
    });
    if (!rawSubscriptions) {
      return {
        ok: false,
        reason: "twitch_eventsub_api_unavailable"
      };
    }

    return {
      ok: true,
      accessToken,
      broadcasterLogin: broadcaster.login,
      broadcasterLogins: config.broadcasterLogins,
      broadcasterUserId: broadcaster.id,
      callbackUrl: config.callbackUrl,
      clientId: config.clientId,
      secret: config.secret,
      subscriptions: rawSubscriptions
        .map((subscription) => summarizeTwitchEventSubSubscription(subscription, config.callbackUrl))
        .filter((subscription): subscription is NonNullable<typeof subscription> => subscription !== null)
        .filter((subscription) =>
          isTwitchEventSubSubscriptionScopedToBroadcaster(subscription, broadcaster.id)
        ),
      transport
    };
  }
}
