import type {
  TwitchEventSubDefaultSubscriptionStatus,
  TwitchEventSubDesiredSubscription,
  TwitchEventSubHelixSubscription,
  TwitchEventSubSubscriptionConfig,
  TwitchEventSubSubscriptionStatus,
  TwitchEventSubSubscriptionSummary
} from "./twitch-eventsub-subscriptions.types.js";

export const twitchEventSubDefaultSubscriptions = [
  {
    conditionKind: "broadcaster",
    type: "stream.online",
    version: "1"
  },
  {
    conditionKind: "broadcaster",
    type: "stream.offline",
    version: "1"
  },
  {
    conditionKind: "broadcaster",
    type: "channel.update",
    version: "2"
  },
  {
    conditionKind: "broadcaster_and_moderator",
    type: "channel.follow",
    version: "2"
  },
  {
    conditionKind: "broadcaster",
    type: "channel.subscribe",
    version: "1"
  },
  {
    conditionKind: "broadcaster",
    type: "channel.subscription.gift",
    version: "1"
  },
  {
    conditionKind: "broadcaster",
    type: "channel.subscription.message",
    version: "1"
  },
  {
    conditionKind: "broadcaster",
    type: "channel.cheer",
    version: "1"
  },
  {
    conditionKind: "broadcaster",
    type: "channel.bits.use",
    version: "1"
  },
  {
    conditionKind: "raid_to_broadcaster",
    type: "channel.raid",
    version: "1"
  },
  {
    conditionKind: "broadcaster",
    type: "channel.channel_points_automatic_reward_redemption.add",
    version: "2"
  },
  {
    conditionKind: "broadcaster",
    type: "channel.channel_points_custom_reward_redemption.add",
    version: "1"
  },
  {
    conditionKind: "broadcaster",
    type: "channel.custom_power_up_redemption.add",
    version: "1"
  },
  {
    conditionKind: "broadcaster",
    type: "channel.goal.begin",
    version: "1"
  },
  {
    conditionKind: "broadcaster",
    type: "channel.goal.progress",
    version: "1"
  },
  {
    conditionKind: "broadcaster",
    type: "channel.goal.end",
    version: "1"
  },
  {
    conditionKind: "broadcaster",
    type: "channel.hype_train.begin",
    version: "2"
  },
  {
    conditionKind: "broadcaster",
    type: "channel.hype_train.progress",
    version: "2"
  },
  {
    conditionKind: "broadcaster",
    type: "channel.hype_train.end",
    version: "2"
  },
  {
    conditionKind: "broadcaster",
    type: "channel.shoutout.receive",
    version: "1"
  }
] as const satisfies readonly TwitchEventSubDesiredSubscription[];

const validStatuses = new Set<TwitchEventSubSubscriptionStatus>([
  "enabled",
  "webhook_callback_verification_pending",
  "webhook_callback_verification_failed",
  "notification_failures_exceeded",
  "authorization_revoked",
  "moderator_removed",
  "user_removed",
  "version_removed",
  "beta_maintenance",
  "websocket_disconnected",
  "websocket_failed_ping_pong",
  "websocket_received_inbound_traffic",
  "websocket_connection_unused",
  "websocket_internal_error",
  "websocket_network_timeout",
  "websocket_network_error"
]);

const trimToNull = (value: string | undefined): string | null => {
  const trimmed = value?.trim() ?? "";

  return trimmed ? trimmed : null;
};

const getApiBaseUrl = (env: Record<string, string | undefined>): string => {
  const configured = trimToNull(env.API_PUBLIC_BASE_URL);

  return configured ?? "https://api-dev.maiks.yt";
};

export const resolveTwitchEventSubSubscriptionConfig = (
  env: Record<string, string | undefined>
): TwitchEventSubSubscriptionConfig | null => {
  const clientId = trimToNull(env.TWITCH_CLIENT_ID);
  const clientSecret = trimToNull(env.TWITCH_CLIENT_SECRET);
  const secret = trimToNull(env.TWITCH_EVENTSUB_WEBHOOK_SECRET);
  const broadcasterLogin = trimToNull(env.TWITCH_CHANNEL)
    ?? trimToNull(env.TWITCH_LOGIN)
    ?? trimToNull(env.TWITCH_CHAT_CHANNEL)
    ?? "maiksmc";

  if (!clientId || !clientSecret || !secret || secret.length < 10 || secret.length > 100) {
    return null;
  }

  return {
    broadcasterLogin,
    callbackUrl: new URL("/provider-webhooks/twitch/eventsub", getApiBaseUrl(env)).toString(),
    clientId,
    clientSecret,
    secret
  };
};

const normalizeStatus = (status: unknown): TwitchEventSubSubscriptionStatus => {
  if (typeof status !== "string") {
    return "unknown";
  }

  return validStatuses.has(status as TwitchEventSubSubscriptionStatus)
    ? status as TwitchEventSubSubscriptionStatus
    : "unknown";
};

const normalizeCondition = (condition: unknown): Record<string, string> => {
  if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
    return {};
  }

  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(condition)) {
    if (typeof value === "string") {
      result[key] = value.slice(0, 191);
    }
  }

  return result;
};

export const summarizeTwitchEventSubSubscription = (
  subscription: TwitchEventSubHelixSubscription,
  callbackUrl: string
): TwitchEventSubSubscriptionSummary | null => {
  const id = trimToNull(subscription.id);
  const type = trimToNull(subscription.type);
  const version = trimToNull(subscription.version);

  if (!id || !type || !version) {
    return null;
  }

  return {
    callbackMatches: subscription.transport?.method === "webhook"
      && subscription.transport.callback === callbackUrl,
    condition: normalizeCondition(subscription.condition),
    cost: typeof subscription.cost === "number" ? subscription.cost : 0,
    createdAt: trimToNull(subscription.created_at),
    id,
    status: normalizeStatus(subscription.status),
    type,
    version
  };
};

const findExistingDefault = (
  subscriptions: readonly TwitchEventSubSubscriptionSummary[],
  desired: TwitchEventSubDesiredSubscription,
  broadcasterUserId: string
): TwitchEventSubSubscriptionSummary | null => {
  const desiredCondition = buildTwitchEventSubCondition(desired, broadcasterUserId);

  return subscriptions.find((subscription) =>
    subscription.callbackMatches
    && subscription.type === desired.type
    && subscription.version === desired.version
    && Object.entries(desiredCondition).every(([key, value]) => subscription.condition[key] === value)
  ) ?? null;
};

export const buildTwitchEventSubCondition = (
  desired: TwitchEventSubDesiredSubscription,
  broadcasterUserId: string
): Record<string, string> => {
  if (desired.conditionKind === "broadcaster_and_moderator") {
    return {
      broadcaster_user_id: broadcasterUserId,
      moderator_user_id: broadcasterUserId
    };
  }

  if (desired.conditionKind === "raid_to_broadcaster") {
    return {
      to_broadcaster_user_id: broadcasterUserId
    };
  }

  return {
    broadcaster_user_id: broadcasterUserId
  };
};

export const projectTwitchEventSubDefaultStatuses = (input: {
  broadcasterUserId: string;
  subscriptions: readonly TwitchEventSubSubscriptionSummary[];
}): readonly TwitchEventSubDefaultSubscriptionStatus[] =>
  twitchEventSubDefaultSubscriptions.map((desired) => {
    const existing = findExistingDefault(input.subscriptions, desired, input.broadcasterUserId);

    if (!existing) {
      return {
        desired,
        existing,
        state: "missing"
      };
    }

    if (existing.status === "enabled") {
      return {
        desired,
        existing,
        state: "enabled"
      };
    }

    if (existing.status === "webhook_callback_verification_pending") {
      return {
        desired,
        existing,
        state: "pending"
      };
    }

    return {
      desired,
      existing,
      state: "problem"
    };
  });
