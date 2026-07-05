export type YouTubePubSubSubscriptionMode = "subscribe" | "unsubscribe";

export type YouTubePubSubSubscriptionConfig = {
  callbackUrl: string;
  hubUrl: string;
  topicUrl: string;
};

export type YouTubePubSubSubscriptionTarget = YouTubePubSubSubscriptionConfig & {
  channelId: string;
};

export type YouTubePubSubSubscriptionStatusResult =
  | {
    ok: true;
    callbackUrl: string;
    channelId: string;
    hubUrl: string;
    readOnly: true;
    state: "ready";
    topicUrl: string;
  }
  | {
    ok: false;
    reason: "youtube_pubsub_channel_missing" | "youtube_pubsub_config_missing";
  };

export type YouTubePubSubSubscriptionRequestResult =
  | {
    ok: true;
    callbackUrl: string;
    channelId: string;
    hubUrl: string;
    mode: YouTubePubSubSubscriptionMode;
    readOnly: true;
    state: "requested";
    topicUrl: string;
  }
  | {
    ok: false;
    reason:
      | "youtube_pubsub_channel_missing"
      | "youtube_pubsub_config_missing"
      | "youtube_pubsub_hub_unavailable";
  };

export type YouTubePubSubHubTransport = {
  requestSubscription(input: {
    callbackUrl: string;
    hubUrl: string;
    mode: YouTubePubSubSubscriptionMode;
    topicUrl: string;
  }): Promise<boolean>;
};
