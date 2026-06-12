export type ProviderCapability =
  | "login"
  | "support-claiming"
  | "discord-role-sync"
  | "ign-verification"
  | "profile-avatar"
  | "game-ownership-sync"
  | "channel-routing";

export type LinkedAccountProvider =
  | "discord"
  | "github"
  | "google"
  | "twitch"
  | "steam"
  | "xbox"
  | "epic"
  | "patreon";

export type LinkedAccount = {
  id: string;
  provider: string;
  providerAccountId: string;
  displayName: string;
  purposeLabel?: string;
  audienceKey?: string;
  channelKey?: string;
  capabilities: readonly ProviderCapability[];
  allowLogin: boolean;
};

export type LinkedAccountClaim = {
  provider: string;
  providerAccountId: string;
  userId: string;
};

export type LinkedAccountClaimDecision =
  | {
    allowed: true;
    reason: "unclaimed" | "already-owned-by-user";
  }
  | {
    allowed: false;
    reason: "claimed-by-different-user";
  };
