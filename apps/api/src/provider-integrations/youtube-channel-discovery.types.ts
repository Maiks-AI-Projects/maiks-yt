import type {
  YouTubeChannelDiscoveryCredential,
  YouTubeChannelDiscoveryResult
} from "@maiks-yt/integrations";

export type YouTubeChannelDiscoveryActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type YouTubeChannelDiscoveryStoredCredential = YouTubeChannelDiscoveryCredential & {
  scopes: readonly string[];
  status: "active" | "revoked" | "error";
  lastError: string | null;
};

export type YouTubeChannelDiscoveryRepository = {
  resolveActor(authUserId: string): Promise<YouTubeChannelDiscoveryActor | null>;
  getActiveYouTubeCredential(domainUserId: string): Promise<YouTubeChannelDiscoveryStoredCredential | null>;
  listYouTubeChannels(domainUserId: string): Promise<YouTubePersistedChannel[]>;
  upsertYouTubeChannels(input: {
    domainUserId: string;
    channels: readonly YouTubePersistedChannelInput[];
    now: Date;
  }): Promise<void>;
  selectYouTubeLiveChatChannel(input: {
    domainUserId: string;
    providerChannelId: string | null;
    now: Date;
  }): Promise<"selected" | "cleared" | "not_found">;
};

export type YouTubePersistedChannelInput = {
  id: string;
  title: string;
  customUrl: string | null;
  thumbnailUrl: string | null;
};

export type YouTubePersistedChannel = {
  id: string;
  title: string;
  customUrl: string | null;
  thumbnailUrl: string | null;
  selectedForLiveChat: boolean;
  discoveredAt: string;
  lastSeenAt: string;
  selectedAt: string | null;
  updatedAt: string | null;
};

export type YouTubeChannelDiscoveryServiceResult =
  | YouTubeChannelDiscoveryResult
  | {
    ok: true;
    channels: readonly YouTubePersistedChannel[];
    selectedChannelId: string | null;
  }
  | {
    ok: false;
    reason:
      | "provider_integrations_user_unlinked"
      | "provider_integrations_forbidden"
      | "youtube_oauth_client_missing"
      | "youtube_oauth_redirect_missing"
      | "youtube_channel_credential_missing"
      | "youtube_channel_scope_missing"
      | "youtube_channel_not_found";
  };
