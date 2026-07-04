import type {
  TwitchEventSubEnsureDefaultsResult,
  TwitchEventSubSubscriptionListResult
} from "@maiks-yt/integrations";

export type TwitchEventSubSubscriptionActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type TwitchEventSubSubscriptionControlResult =
  | TwitchEventSubSubscriptionListResult
  | TwitchEventSubEnsureDefaultsResult
  | {
    ok: false;
    reason: "twitch_eventsub_user_unlinked" | "twitch_eventsub_forbidden";
  };

export interface TwitchEventSubSubscriptionRepository {
  resolveActor(authUserId: string): Promise<TwitchEventSubSubscriptionActor | null>;
}
