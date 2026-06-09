import type { LinkedAccount } from "./linked-account.types.js";

export type ProfileVisibility = "private" | "minimal" | "public";

export type UserAccount = {
  id: string;
  displayName: string;
  profileVisibility: ProfileVisibility;
  linkedAccounts: readonly LinkedAccount[];
};
