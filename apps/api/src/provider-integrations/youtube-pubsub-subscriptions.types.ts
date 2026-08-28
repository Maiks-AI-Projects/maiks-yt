import type {
  YouTubePubSubBrowserResult,
  YouTubePubSubRequestBrowserResult
} from "./provider-integrations-browser-contract.rules.js";

export type YouTubePubSubSubscriptionActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type YouTubePubSubSelectedChannel = {
  id: string;
  title: string;
};

export type YouTubePubSubSubscriptionControlResult =
  | YouTubePubSubBrowserResult
  | YouTubePubSubRequestBrowserResult
  | {
    ok: false;
    reason: "youtube_pubsub_user_unlinked" | "youtube_pubsub_forbidden";
  };

export interface YouTubePubSubSubscriptionRepository {
  resolveActor(authUserId: string): Promise<YouTubePubSubSubscriptionActor | null>;
  getSelectedYouTubeChannel(domainUserId: string): Promise<YouTubePubSubSelectedChannel | null>;
}
