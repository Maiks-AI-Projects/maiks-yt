import type {
  YouTubePubSubSubscriptionRequestResult,
  YouTubePubSubSubscriptionStatusResult
} from "@maiks-yt/integrations";

export type YouTubePubSubSubscriptionActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type YouTubePubSubSelectedChannel = {
  id: string;
  title: string;
};

export type YouTubePubSubSubscriptionControlResult =
  | YouTubePubSubSubscriptionStatusResult
  | YouTubePubSubSubscriptionRequestResult
  | {
    ok: false;
    reason: "youtube_pubsub_user_unlinked" | "youtube_pubsub_forbidden";
  };

export interface YouTubePubSubSubscriptionRepository {
  resolveActor(authUserId: string): Promise<YouTubePubSubSubscriptionActor | null>;
  getSelectedYouTubeChannel(domainUserId: string): Promise<YouTubePubSubSelectedChannel | null>;
}
