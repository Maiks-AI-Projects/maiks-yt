import {
  projectTwitchEventSubDefaultStatuses,
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
    const response = await fetch(`${helixBaseUrl}/eventsub/subscriptions`, {
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        "client-id": input.clientId
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = getDataArray(await parseJson(response));

    return data
      ? data.map((item) => asSubscription(item)).filter((item): item is TwitchEventSubHelixSubscription => item !== null)
      : null;
  }
});

export class TwitchEventSubSubscriptionService {
  public constructor(
    private readonly options: {
      env?: Record<string, string | undefined>;
      transport?: TwitchEventSubHelixTransport;
    } = {}
  ) {}

  public async listDefaults(): Promise<TwitchEventSubSubscriptionListResult> {
    const context = await this.resolveContext();
    if (!context.ok) {
      return {
        ok: false,
        reason: context.reason
      };
    }

    return {
      ok: true,
      broadcasterLogin: context.broadcasterLogin,
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

  public async ensureDefaults(): Promise<TwitchEventSubEnsureDefaultsResult> {
    const context = await this.resolveContext();
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
          broadcaster_user_id: context.broadcasterUserId
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
      broadcasterUserId: context.broadcasterUserId,
      callbackUrl: context.callbackUrl,
      results
    };
  }

  private async resolveContext(): Promise<
    | {
      ok: true;
      accessToken: string;
      broadcasterLogin: string;
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
      login: config.broadcasterLogin
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
      broadcasterUserId: broadcaster.id,
      callbackUrl: config.callbackUrl,
      clientId: config.clientId,
      secret: config.secret,
      subscriptions: rawSubscriptions
        .map((subscription) => summarizeTwitchEventSubSubscription(subscription, config.callbackUrl))
        .filter((subscription): subscription is NonNullable<typeof subscription> => subscription !== null),
      transport
    };
  }
}
