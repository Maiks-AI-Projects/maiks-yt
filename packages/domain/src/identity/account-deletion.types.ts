import type { ProfileVisibility } from "./user.types.js";

export type DeletableUserProfile = {
  id: string;
  displayName: string;
  profileVisibility: ProfileVisibility;
  avatarUrl?: string | null;
  deletedAt?: Date | null;
};

export type AnonymizedUserProfile = {
  id: string;
  displayName: "Anonymous user";
  profileVisibility: "private";
  avatarUrl: null;
  deletedAt: Date;
};

export type AccountDeletionPlan = {
  user: AnonymizedUserProfile;
  unlinkOAuthAccounts: true;
  deleteLinkedAccounts: true;
  anonymizeLedgerReferences: true;
  keepMinimalDeletionAudit: true;
};
