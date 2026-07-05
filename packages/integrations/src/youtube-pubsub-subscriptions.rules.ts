import type {
  YouTubePubSubSubscriptionConfig,
  YouTubePubSubSubscriptionTarget
} from "./youtube-pubsub-subscriptions.types.js";

const defaultHubUrl = "https://pubsubhubbub.appspot.com/subscribe";

const trimToNull = (value: string | undefined): string | null => {
  const trimmed = value?.trim() ?? "";

  return trimmed ? trimmed : null;
};

const getApiBaseUrl = (env: Record<string, string | undefined>): string => {
  const configured = trimToNull(env.API_PUBLIC_BASE_URL);

  return configured ?? "https://api-dev.maiks.yt";
};

export const buildYouTubePubSubTopicUrl = (channelId: string): string =>
  `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;

export const resolveYouTubePubSubSubscriptionConfig = (
  env: Record<string, string | undefined>
): YouTubePubSubSubscriptionConfig | null => {
  const apiBaseUrl = getApiBaseUrl(env);
  const hubUrl = trimToNull(env.YOUTUBE_PUBSUB_HUB_URL) ?? defaultHubUrl;

  try {
    return {
      callbackUrl: new URL("/provider-webhooks/youtube/pubsub", apiBaseUrl).toString(),
      hubUrl: new URL(hubUrl).toString(),
      topicUrl: ""
    };
  } catch {
    return null;
  }
};

export const resolveYouTubePubSubSubscriptionTarget = (input: {
  channelId: string | null;
  env: Record<string, string | undefined>;
}): YouTubePubSubSubscriptionTarget | null => {
  const channelId = input.channelId?.trim() ?? "";

  if (!channelId || channelId.length > 191 || /\s/.test(channelId)) {
    return null;
  }

  const config = resolveYouTubePubSubSubscriptionConfig(input.env);

  if (!config) {
    return null;
  }

  return {
    callbackUrl: config.callbackUrl,
    channelId,
    hubUrl: config.hubUrl,
    topicUrl: buildYouTubePubSubTopicUrl(channelId)
  };
};
