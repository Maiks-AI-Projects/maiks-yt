import type {
  LinkedAccount,
  LinkedAccountClaim,
  LinkedAccountClaimDecision,
  LinkedAccountProvider,
  ProviderCapability
} from "./linked-account.types.js";

const providerDefaultCapabilities = {
  discord: ["login", "discord-role-sync", "profile-avatar"],
  github: ["login", "profile-avatar"],
  google: ["login", "profile-avatar", "channel-routing"],
  twitch: ["login", "support-claiming", "profile-avatar", "channel-routing"],
  steam: ["login", "ign-verification", "game-ownership-sync", "profile-avatar"],
  xbox: ["login", "ign-verification", "game-ownership-sync", "profile-avatar"],
  epic: ["login", "ign-verification", "game-ownership-sync", "profile-avatar"],
  patreon: ["support-claiming"]
} as const satisfies Record<LinkedAccountProvider, readonly ProviderCapability[]>;

export function getDefaultCapabilitiesForProvider(provider: string): readonly ProviderCapability[] {
  return provider in providerDefaultCapabilities
    ? providerDefaultCapabilities[provider as LinkedAccountProvider]
    : [];
}

export function canProviderUseCapability(provider: string, capability: ProviderCapability): boolean {
  return getDefaultCapabilitiesForProvider(provider).includes(capability);
}

export function canDisableLoginForLinkedAccount(accounts: readonly LinkedAccount[], accountId: string): boolean {
  const target = accounts.find((account) => account.id === accountId);

  if (!target?.allowLogin || !target.capabilities.includes("login")) {
    return true;
  }

  return accounts.some((account) => account.id !== accountId && account.allowLogin && account.capabilities.includes("login"));
}

export function decideLinkedAccountClaim(
  existingClaims: readonly LinkedAccountClaim[],
  nextClaim: LinkedAccountClaim
): LinkedAccountClaimDecision {
  const existingClaim = existingClaims.find((claim) =>
    claim.provider === nextClaim.provider && claim.providerAccountId === nextClaim.providerAccountId
  );

  if (!existingClaim) {
    return {
      allowed: true,
      reason: "unclaimed"
    };
  }

  if (existingClaim.userId === nextClaim.userId) {
    return {
      allowed: true,
      reason: "already-owned-by-user"
    };
  }

  return {
    allowed: false,
    reason: "claimed-by-different-user"
  };
}
