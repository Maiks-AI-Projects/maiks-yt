export type ProviderCapability =
  | "login"
  | "support-claiming"
  | "discord-role-sync"
  | "ign-verification"
  | "profile-avatar";

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
