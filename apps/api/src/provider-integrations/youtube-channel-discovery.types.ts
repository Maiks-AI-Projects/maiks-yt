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
};

export type YouTubeChannelDiscoveryServiceResult =
  | YouTubeChannelDiscoveryResult
  | {
    ok: false;
    reason:
      | "provider_integrations_user_unlinked"
      | "provider_integrations_forbidden"
      | "youtube_oauth_client_missing"
      | "youtube_oauth_redirect_missing"
      | "youtube_channel_credential_missing"
      | "youtube_channel_scope_missing";
  };
