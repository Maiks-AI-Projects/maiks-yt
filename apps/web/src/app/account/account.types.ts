import type { StreamVisibilityPreferenceScope } from "@maiks-yt/domain/events";

export type OAuthProviderId = "google" | "github" | "discord" | "twitch";

export type AuthAccount = {
  providerId: string;
};

export type ProfileVisibility = "private" | "minimal" | "public";

export type DomainUserProfile = {
  displayName: string;
  profileVisibility: ProfileVisibility;
  avatarUrl: string | null;
};

export type ProviderProfileOption = {
  profileOptionRef: string;
  providerId: string;
  displayName: string;
  email: string | null;
  imageUrl: string | null;
};

export type ProviderProfileOptionsResponse = {
  ok: true;
  options: ProviderProfileOption[];
} | {
  ok: false;
  reason: string;
};

export type DomainAccountSnapshot = {
  ok: true;
  domainUser: DomainUserProfile | null;
  linkedAccountCount: number;
  needsSync: boolean;
} | {
  ok: false;
  reason: string;
};

export type AuthAccountsResponse = {
  ok: true;
  accounts: AuthAccount[];
} | {
  ok: false;
  reason: string;
};

export type StreamVisibilityPreference = {
  scope: StreamVisibilityPreferenceScope;
  label: string;
  description: string;
  optedOut: boolean;
};

export type StreamVisibilityPreferencesSnapshot = {
  ok: true;
  preferences: readonly StreamVisibilityPreference[];
} | {
  ok: false;
  reason: string;
};

export type AccountConnectionProvidersResponse = {
  ok: true;
  configuredProviderIds: OAuthProviderId[];
};

export type LinkSocialResponse = {
  url?: string;
  redirect?: boolean;
  status?: boolean;
};
