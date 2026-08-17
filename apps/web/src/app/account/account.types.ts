import type { StreamVisibilityPreferenceScope } from "@maiks-yt/domain/events";

export type OAuthProviderId = "google" | "github" | "discord" | "twitch";

export type AuthSession = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    emailVerified?: boolean | null;
  };
  session: {
    id?: string;
    userId?: string;
    expiresAt?: string | Date | null;
  };
} | null;

export type AuthAccount = {
  id: string;
  providerId: string;
  accountId: string;
  userId: string;
  scopes?: string[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type DomainLinkedAccount = {
  id: string;
  provider: string;
  providerAccountId: string;
  displayName: string;
  purposeLabel: string | null;
  audienceKey: string | null;
  channelKey: string | null;
  allowLogin: boolean;
  capabilities: unknown[];
  verifiedAt?: string | Date | null;
  createdAt?: string | Date | null;
};

export type ProfileVisibility = "private" | "minimal" | "public";

export type DomainUserProfile = {
  id: string;
  displayName: string;
  profileVisibility: ProfileVisibility;
  avatarUrl: string | null;
};

export type ProviderProfileOption = {
  accountId: string;
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
  authUserId: string;
  domainUser: DomainUserProfile | null;
  linkedAccounts: DomainLinkedAccount[];
  needsSync: boolean;
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
  domainUser: {
    id: string;
    displayName: string;
    profileVisibility: ProfileVisibility;
  };
  preferences: readonly StreamVisibilityPreference[];
} | {
  ok: false;
  reason: string;
};

export type AuthConfigurationStatus = {
  ok: true;
  configuredProviders: OAuthProviderId[];
};

export type LinkSocialResponse = {
  url?: string;
  redirect?: boolean;
  status?: boolean;
};
