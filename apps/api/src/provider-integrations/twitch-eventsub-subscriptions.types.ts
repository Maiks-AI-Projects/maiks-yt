import type {
  TwitchEventSubEnsureBrowserResult,
  TwitchEventSubListBrowserResult
} from "./provider-integrations-browser-contract.rules.js";

export type TwitchEventSubSubscriptionActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type TwitchEventSubSubscriptionControlResult =
  | TwitchEventSubListBrowserResult
  | TwitchEventSubEnsureBrowserResult
  | {
    ok: false;
    reason: "twitch_eventsub_user_unlinked" | "twitch_eventsub_forbidden";
  };

export interface TwitchEventSubSubscriptionRepository {
  resolveActor(authUserId: string): Promise<TwitchEventSubSubscriptionActor | null>;
}
