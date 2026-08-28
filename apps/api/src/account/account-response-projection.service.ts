import type { ProfileVisibility } from "@maiks-yt/domain/identity";

import type { AuthSessionSnapshot } from "./auth-session.types.js";
import type { DomainUserRow } from "./domain-identity.service.js";

export type AccountSessionProjection = {
  ok: true;
  signedIn: true;
  currentUser: {
    name: string | null;
    email: string | null;
    imageUrl: string | null;
  };
};

export type AccountDomainUserProjection = {
  displayName: string;
  profileVisibility: ProfileVisibility;
  avatarUrl: string | null;
};

export type AccountDomainProjection = {
  ok: true;
  domainUser: AccountDomainUserProjection | null;
  linkedAccountCount: number;
  needsSync: boolean;
};

const profileVisibilities = new Set<string>(["private", "minimal", "public"]);

const projectProfileVisibility = (value: string): ProfileVisibility => {
  if (!profileVisibilities.has(value)) {
    throw new Error("Invalid profile visibility in account projection.");
  }

  return value as ProfileVisibility;
};

export const projectAccountSession = (
  session: AuthSessionSnapshot
): AccountSessionProjection | null => {
  if (!session) {
    return null;
  }

  return {
    ok: true,
    signedIn: true,
    currentUser: {
      name: session.user.name ?? null,
      email: session.user.email ?? null,
      imageUrl: session.user.image ?? null
    }
  };
};

export const projectDomainUser = (
  user: DomainUserRow | null
): AccountDomainUserProjection | null => user
  ? {
    displayName: user.displayName,
    profileVisibility: projectProfileVisibility(user.profileVisibility),
    avatarUrl: user.avatarUrl
  }
  : null;

export const projectAccountDomain = ({
  linkedAccountCount,
  needsSync,
  user
}: {
  linkedAccountCount: number;
  needsSync: boolean;
  user: DomainUserRow | null;
}): AccountDomainProjection => ({
  ok: true,
  domainUser: projectDomainUser(user),
  linkedAccountCount,
  needsSync
});
