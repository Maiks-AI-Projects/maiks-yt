export type LinkedIdentityMock = {
  provider: "Discord" | "Twitch" | "YouTube";
  accountLabel: string;
  audience: string;
  capabilities: readonly string[];
  loginState: string;
  purpose: string;
  publicState: string;
  verification: string;
};

export type RecognitionMock = {
  source: string;
  title: string;
  description: string;
  displayRule: string;
};

export type GamingIdentityMock = {
  platform: string;
  identity: string;
  capabilities: string;
  verification: string;
  visibility: string;
};

export type ProfileBadgeMock = {
  label: string;
  reason: string;
};

export type ProfileEntitlementMock = {
  feature: string;
  mockState: string;
  boundary: string;
};

export type OwnerControlMock = {
  control: string;
  state: string;
  explanation: string;
};

export const linkedIdentityMocks: readonly LinkedIdentityMock[] = [
  {
    provider: "Twitch",
    accountLabel: "maiksmc",
    audience: "Streaming and gaming",
    capabilities: ["Login", "Avatar", "Support claiming", "Channel routing"],
    loginState: "Allowed in mock",
    purpose: "Streaming and chat identity",
    publicState: "Example: public",
    verification: "Mock verified"
  },
  {
    provider: "YouTube",
    accountLabel: "@maiksmc",
    audience: "Minecraft channel",
    capabilities: ["Login", "Avatar", "Channel routing"],
    loginState: "Allowed in mock",
    purpose: "Channels, streams, and community activity",
    publicState: "Example: public",
    verification: "Mock verified"
  },
  {
    provider: "Discord",
    accountLabel: "Maiks.yt community identity",
    audience: "Community-wide",
    capabilities: ["Login", "Avatar", "Role sync"],
    loginState: "Disabled in mock",
    purpose: "Community identity, roles, and future perks",
    publicState: "Example: identity visible, roles hidden",
    verification: "Mock verified"
  }
] as const;

export const recognitionMocks: readonly RecognitionMock[] = [
  {
    source: "Twitch",
    title: "Gifted subscriptions and Bits",
    description: "A privacy-safe summary could recognize Twitch support without publishing raw transaction records.",
    displayRule: "Example event, amount hidden"
  },
  {
    source: "YouTube",
    title: "Memberships and gifted memberships",
    description: "Channel memberships could appear after the linked identity and the recognition preference are verified.",
    displayRule: "Example event, opt-in"
  },
  {
    source: "Website",
    title: "Donations and project contributions",
    description: "The profile would show a reviewed contribution category, never the private accounting ledger.",
    displayRule: "Example event, exact value hidden"
  },
  {
    source: "Patreon",
    title: "External supporter status",
    description: "Familiar external support platforms could provide recognition without becoming a required account provider.",
    displayRule: "Example event, sync required"
  },
  {
    source: "Community",
    title: "Raids and useful participation",
    description: "Non-financial actions and reviewed community contributions can receive recognition too.",
    displayRule: "Example event, context reviewed"
  }
] as const;

export const gamingIdentityMocks: readonly GamingIdentityMock[] = [
  {
    platform: "Steam",
    identity: "Example linked Steam identity",
    capabilities: "Game ownership, avatar, and possible login",
    verification: "Mock linked; provider flow not active for users",
    visibility: "Platform visible, game list private"
  },
  {
    platform: "Minecraft",
    identity: "MaiksMC",
    capabilities: "Verified in-game name and overlay display",
    verification: "Example verified through fallback review",
    visibility: "Selected stream identity"
  },
  {
    platform: "Xbox / Epic / others",
    identity: "No example account selected",
    capabilities: "Provider-specific login, IGN, game sync, or avatar",
    verification: "Capability preview only",
    visibility: "Hidden"
  }
] as const;

export const profileBadgeMocks: readonly ProfileBadgeMock[] = [
  { label: "Creator", reason: "Example identity badge" },
  { label: "Project contributor", reason: "Example reviewed contribution badge" },
  { label: "Community supporter", reason: "Example opt-in recognition badge" }
] as const;

export const entitlementMocks: readonly ProfileEntitlementMock[] = [
  {
    feature: "Discord status and roles",
    mockState: "Community identity linked; public roles hidden",
    boundary: "Role sync requires explicit mapping"
  },
  {
    feature: "Supporter rank",
    mockState: "Example rank preview only",
    boundary: "Recognition never grants moderation authority"
  },
  {
    feature: "Platform-derived credits",
    mockState: "Private in this mock",
    boundary: "Needs reviewed entitlement rules"
  },
  {
    feature: "Claimable contributions",
    mockState: "Example claim available",
    boundary: "Identity ownership must match first"
  },
  {
    feature: "Profile perks",
    mockState: "Example badge and profile accent",
    boundary: "Expires or changes with its source"
  },
  {
    feature: "Moderation tools",
    mockState: "No public authority shown",
    boundary: "Granted roles, never financial support, control access"
  }
] as const;

export const ownerControlMocks: readonly OwnerControlMock[] = [
  {
    control: "Public profile",
    state: "Published in this mock",
    explanation: "Real profiles start private and require a deliberate publish choice."
  },
  {
    control: "Selected display identity",
    state: "MaiksMC for Minecraft",
    explanation: "A verified provider or in-game identity can be selected per audience or channel."
  },
  {
    control: "Linked-account visibility",
    state: "Configured per account",
    explanation: "Linking an account never makes it public automatically."
  },
  {
    control: "Allow login",
    state: "Enabled on two mock accounts",
    explanation: "The final usable login method cannot be disabled or unlinked."
  },
  {
    control: "Purpose and audience routing",
    state: "Minecraft and community examples",
    explanation: "Multiple accounts from one provider can serve different channels or interests."
  },
  {
    control: "Recognition visibility",
    state: "Amounts hidden; categories visible",
    explanation: "Each category and individual event can be hidden later."
  },
  {
    control: "Provider sync and unlink",
    state: "Mock controls only",
    explanation: "Sync time, revoked access, unlink audit, and compromised-account recovery belong here."
  },
  {
    control: "Name and avatar safety",
    state: "Example review clear",
    explanation: "Offensive or impersonating public identity content needs moderation and appeal controls."
  }
] as const;
