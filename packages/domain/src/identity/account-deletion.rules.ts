import type { AccountDeletionPlan, DeletableUserProfile } from "./account-deletion.types.js";

export const anonymousDeletedUserDisplayName = "Anonymous user" as const;

export function createAccountDeletionPlan(
  user: DeletableUserProfile,
  deletedAt: Date
): AccountDeletionPlan {
  return {
    user: {
      id: user.id,
      displayName: anonymousDeletedUserDisplayName,
      profileVisibility: "private",
      avatarUrl: null,
      deletedAt
    },
    unlinkOAuthAccounts: true,
    deleteLinkedAccounts: true,
    anonymizeLedgerReferences: true,
    keepMinimalDeletionAudit: true
  };
}

export function canRequestAccountDeletion(user: DeletableUserProfile): boolean {
  return !user.deletedAt;
}
