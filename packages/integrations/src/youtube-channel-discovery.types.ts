import type { youtube_v3 } from "googleapis";

import type { YouTubeOwnerOAuthConfig } from "./youtube-owner-oauth.types.js";

export type YouTubeChannelDiscoveryCredential = {
  accessToken: string | null;
  refreshToken: string;
  accessTokenExpiresAt: Date | null;
  scopes?: readonly string[];
};

export type YouTubeDiscoveredChannel = {
  id: string;
  title: string;
  customUrl: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
};

export type YouTubeChannelDiscoveryResult =
  | {
    ok: true;
    channels: readonly YouTubeDiscoveredChannel[];
    discoveredAt: string;
  }
  | {
    ok: false;
    reason: "youtube_channel_discovery_failed";
  };

export type YouTubeChannelsListResponse = Pick<youtube_v3.Schema$ChannelListResponse, "items">;

export type YouTubeChannelsList = (input: {
  config: Extract<YouTubeOwnerOAuthConfig, { ok: true }>;
  credential: YouTubeChannelDiscoveryCredential;
}) => Promise<YouTubeChannelsListResponse>;
