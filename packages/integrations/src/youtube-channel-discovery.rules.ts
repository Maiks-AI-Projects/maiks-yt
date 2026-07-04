import { google } from "googleapis";

import type {
  YouTubeChannelDiscoveryCredential,
  YouTubeChannelDiscoveryResult,
  YouTubeChannelsList,
  YouTubeChannelsListResponse,
  YouTubeDiscoveredChannel
} from "./youtube-channel-discovery.types.js";
import type { YouTubeOwnerOAuthConfig } from "./youtube-owner-oauth.types.js";

const trimToNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
};

const toIsoOrNull = (value: string | null | undefined): string | null => {
  const trimmed = trimToNull(value);

  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const projectYouTubeDiscoveredChannels = (
  response: YouTubeChannelsListResponse
): YouTubeDiscoveredChannel[] =>
  (response.items ?? []).flatMap((item): YouTubeDiscoveredChannel[] => {
    const id = trimToNull(item.id);
    const title = trimToNull(item.snippet?.title);

    if (!id || !title) {
      return [];
    }

    return [{
      id,
      title,
      customUrl: trimToNull(item.snippet?.customUrl),
      thumbnailUrl: trimToNull(
        item.snippet?.thumbnails?.default?.url
          ?? item.snippet?.thumbnails?.medium?.url
          ?? item.snippet?.thumbnails?.high?.url
      ),
      publishedAt: toIsoOrNull(item.snippet?.publishedAt)
    }];
  });

export const listYouTubeChannelsWithCredential: YouTubeChannelsList = async ({
  config,
  credential
}) => {
  const client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );

  client.setCredentials({
    ...(credential.accessToken ? { access_token: credential.accessToken } : {}),
    refresh_token: credential.refreshToken,
    ...(credential.accessTokenExpiresAt ? { expiry_date: credential.accessTokenExpiresAt.getTime() } : {})
  });

  const youtube = google.youtube({
    version: "v3",
    auth: client
  });

  const response = await youtube.channels.list({
    mine: true,
    part: ["snippet"]
  });

  return response.data;
};

export const discoverYouTubeChannels = async (input: {
  config: Extract<YouTubeOwnerOAuthConfig, { ok: true }>;
  credential: YouTubeChannelDiscoveryCredential;
  listChannels?: YouTubeChannelsList;
  now?: Date;
}): Promise<YouTubeChannelDiscoveryResult> => {
  try {
    const response = await (input.listChannels ?? listYouTubeChannelsWithCredential)({
      config: input.config,
      credential: input.credential
    });

    return {
      ok: true,
      channels: projectYouTubeDiscoveredChannels(response),
      discoveredAt: (input.now ?? new Date()).toISOString()
    };
  } catch {
    return {
      ok: false,
      reason: "youtube_channel_discovery_failed"
    };
  }
};
