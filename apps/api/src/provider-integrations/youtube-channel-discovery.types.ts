import type {
  YouTubeChannelDiscoveryCredential,
  YouTubeChannelDiscoveryResult
} from "@maiks-yt/integrations";
import type { YouTubeChannelBrowserResult } from "./provider-integrations-browser-contract.rules.js";

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
  | YouTubeChannelBrowserResult
  | Extract<YouTubeChannelDiscoveryResult, { ok: false }>;
