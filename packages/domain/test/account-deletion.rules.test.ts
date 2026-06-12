import { describe, expect, it } from "vitest";

import { canRequestAccountDeletion, createAccountDeletionPlan } from "../src/identity/account-deletion.rules.js";
import type { DeletableUserProfile } from "../src/identity/account-deletion.types.js";

describe("account deletion rules", () => {
  const activeUser: DeletableUserProfile = {
    id: "user-1",
    displayName: "Visible Name",
    profileVisibility: "public",
    avatarUrl: "https://example.test/avatar.png",
    deletedAt: null
  };

  it("anonymizes public profile fields and makes the profile private", () => {
    const deletedAt = new Date("2026-06-12T12:00:00.000Z");
    const plan = createAccountDeletionPlan(activeUser, deletedAt);

    expect(plan.user).toEqual({
      id: activeUser.id,
      displayName: "Anonymous user",
      profileVisibility: "private",
      avatarUrl: null,
      deletedAt
    });
  });

  it("requires unlinking accounts and anonymizing ledger references", () => {
    const plan = createAccountDeletionPlan(activeUser, new Date("2026-06-12T12:00:00.000Z"));

    expect(plan.unlinkOAuthAccounts).toBe(true);
    expect(plan.deleteLinkedAccounts).toBe(true);
    expect(plan.anonymizeLedgerReferences).toBe(true);
    expect(plan.keepMinimalDeletionAudit).toBe(true);
  });

  it("allows active users to request deletion", () => {
    expect(canRequestAccountDeletion(activeUser)).toBe(true);
  });

  it("blocks duplicate deletion requests for already deleted users", () => {
    expect(canRequestAccountDeletion({
      ...activeUser,
      deletedAt: new Date("2026-06-12T12:00:00.000Z")
    })).toBe(false);
  });
});
