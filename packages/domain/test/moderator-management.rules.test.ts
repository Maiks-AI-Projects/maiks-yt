import { describe, expect, it } from "vitest";

import {
  canCreateOrdinaryModeratorRole,
  canDeleteOrdinaryModeratorRole,
  canManageModerators,
  canUpdateOrdinaryModeratorRankPath,
  canUpdateOrdinaryModeratorRole,
  hasStrictModeratorRoleAuthorityShape,
  isProtectedModeratorRoleAuthority,
  isModeratorRoleGrantable,
  validateModeratorGrantInput
} from "../src/community/index.js";

const ordinaryRole = {
  key: "chat-moderator",
  permissions: ["chat:view", "chat:warn-user"],
  isOwnerRank: false,
  isSystem: false
};

const grantInput = {
  targetUserId: "helper-user",
  roleId: "helper-role",
  trustLevel: "helper",
  scopeKind: "global",
  scopeId: null,
  availability: "always",
  expiresAt: null,
  reason: null
} as const;

describe("moderator management rank authority", () => {
  it("preserves owner wildcard and delegated moderator management access", () => {
    expect(canManageModerators(["*"])).toBe(true);
    expect(canManageModerators(["moderators:manage"])).toBe(true);
    expect(canManageModerators(["chat:view"])).toBe(false);
  });

  it("allows ordinary rank create, update, delete, and grant policy", () => {
    expect(canCreateOrdinaryModeratorRole(ordinaryRole)).toBe(true);
    expect(canUpdateOrdinaryModeratorRole(ordinaryRole, {
      ...ordinaryRole,
      permissions: ["chat:view", "chat:hide-message"]
    })).toBe(true);
    expect(canDeleteOrdinaryModeratorRole(ordinaryRole)).toBe(true);
    expect(isModeratorRoleGrantable(ordinaryRole)).toBe(true);
    expect(validateModeratorGrantInput(grantInput, ordinaryRole)).toEqual({
      ok: true,
      issues: []
    });
  });

  it("blocks creating owner, system, or wildcard ranks through ordinary role CRUD", () => {
    for (const protectedRole of [
      { ...ordinaryRole, key: " OWNER " },
      { ...ordinaryRole, key: "AdMiN" },
      { ...ordinaryRole, isOwnerRank: true },
      { ...ordinaryRole, isSystem: true },
      { ...ordinaryRole, permissions: ["chat:view", "*"] }
    ]) {
      expect(canCreateOrdinaryModeratorRole(protectedRole)).toBe(false);
      expect(canDeleteOrdinaryModeratorRole(protectedRole)).toBe(false);
    }
  });

  it("blocks downgrading protected ranks and adding wildcard authority", () => {
    expect(canUpdateOrdinaryModeratorRole(
      { ...ordinaryRole, key: " Owner " },
      ordinaryRole
    )).toBe(false);
    expect(canUpdateOrdinaryModeratorRole(
      ordinaryRole,
      { ...ordinaryRole, key: " ADMIN " }
    )).toBe(false);
    expect(canUpdateOrdinaryModeratorRole(
      { ...ordinaryRole, isOwnerRank: true, permissions: ["*"] },
      ordinaryRole
    )).toBe(false);
    expect(canUpdateOrdinaryModeratorRole(
      { ...ordinaryRole, isSystem: true },
      { ...ordinaryRole, isSystem: false }
    )).toBe(false);
    expect(canUpdateOrdinaryModeratorRole(
      ordinaryRole,
      { ...ordinaryRole, permissions: ["chat:view", "*"] }
    )).toBe(false);
  });

  it("blocks rank-path updates when any attached rank has protected authority", () => {
    expect(canUpdateOrdinaryModeratorRankPath([ordinaryRole])).toBe(true);

    for (const protectedRole of [
      { ...ordinaryRole, key: " OWNER " },
      { ...ordinaryRole, isOwnerRank: true },
      { ...ordinaryRole, isSystem: true },
      { ...ordinaryRole, permissions: ["chat:view", " * "] }
    ]) {
      expect(canUpdateOrdinaryModeratorRankPath([ordinaryRole, protectedRole])).toBe(false);
    }
  });

  it("fails closed when attached rank authority has a malformed shape", () => {
    expect(hasStrictModeratorRoleAuthorityShape(ordinaryRole)).toBe(true);

    for (const malformedRole of [
      null,
      {},
      { ...ordinaryRole, key: "" },
      { ...ordinaryRole, key: " Bad key " },
      { ...ordinaryRole, permissions: "chat:view" },
      { ...ordinaryRole, permissions: ["chat:view", " "] },
      { ...ordinaryRole, permissions: ["chat:view", 7] },
      { ...ordinaryRole, permissions: [["chat:view"]] },
      { ...ordinaryRole, isOwnerRank: 0 },
      { ...ordinaryRole, isSystem: "false" },
      { key: ordinaryRole.key, permissions: ordinaryRole.permissions, isOwnerRank: false }
    ]) {
      expect(hasStrictModeratorRoleAuthorityShape(malformedRole)).toBe(false);
      expect(canUpdateOrdinaryModeratorRankPath([ordinaryRole, malformedRole])).toBe(false);
    }

    expect(canUpdateOrdinaryModeratorRankPath("not-an-array")).toBe(false);
  });

  it("treats mapped authority-integrity failures as protected in every existing-role policy", () => {
    const invalidExistingRole = {
      ...ordinaryRole,
      key: "invalid-role-key",
      permissions: [],
      authorityIntegrity: "invalid"
    } as const;

    expect(hasStrictModeratorRoleAuthorityShape(invalidExistingRole)).toBe(false);
    expect(canCreateOrdinaryModeratorRole(invalidExistingRole)).toBe(false);
    expect(canUpdateOrdinaryModeratorRole(invalidExistingRole, ordinaryRole)).toBe(false);
    expect(canDeleteOrdinaryModeratorRole(invalidExistingRole)).toBe(false);
    expect(isModeratorRoleGrantable(invalidExistingRole)).toBe(false);
    expect(validateModeratorGrantInput(grantInput, invalidExistingRole)).toMatchObject({
      ok: false,
      issues: expect.arrayContaining(["moderator_grant_protected_role_forbidden"])
    });

    const inconsistentValidMarker = {
      ...ordinaryRole,
      permissions: ["chat:view", 7],
      authorityIntegrity: "valid"
    } as const;
    expect(canUpdateOrdinaryModeratorRole(inconsistentValidMarker, ordinaryRole)).toBe(false);
    expect(canDeleteOrdinaryModeratorRole(inconsistentValidMarker)).toBe(false);
    expect(isModeratorRoleGrantable(inconsistentValidMarker)).toBe(false);
  });

  it("fails every existing-role policy closed for raw malformed authority", () => {
    for (const malformedRole of [
      { ...ordinaryRole, key: "" },
      { ...ordinaryRole, key: "Bad key" },
      { ...ordinaryRole, permissions: { permission: "chat:view" } },
      { ...ordinaryRole, permissions: ["chat:view", 7] },
      { ...ordinaryRole, isOwnerRank: 0 },
      { ...ordinaryRole, isSystem: "false" }
    ]) {
      const role = malformedRole as never;
      expect(canCreateOrdinaryModeratorRole(role)).toBe(false);
      expect(canUpdateOrdinaryModeratorRole(role, ordinaryRole)).toBe(false);
      expect(canDeleteOrdinaryModeratorRole(role)).toBe(false);
      expect(isProtectedModeratorRoleAuthority(role)).toBe(true);
      expect(isModeratorRoleGrantable(role)).toBe(false);
      expect(validateModeratorGrantInput(grantInput, role)).toMatchObject({
        ok: false,
        issues: expect.arrayContaining(["moderator_grant_protected_role_forbidden"])
      });
    }
  });

  it("protects and rejects grantability when either authority flag is missing", () => {
    for (const role of [
      {
        key: ordinaryRole.key,
        permissions: ordinaryRole.permissions,
        isSystem: false
      },
      {
        key: ordinaryRole.key,
        permissions: ordinaryRole.permissions,
        isOwnerRank: false
      }
    ]) {
      expect(hasStrictModeratorRoleAuthorityShape(role)).toBe(false);
      expect(isProtectedModeratorRoleAuthority(role as never)).toBe(true);
      expect(isModeratorRoleGrantable(role as never)).toBe(false);
    }
  });

  it("does not treat inconsistent wildcard or flagged roles as ordinary grantable roles", () => {
    expect(isModeratorRoleGrantable({ ...ordinaryRole, permissions: ["*"] })).toBe(false);
    expect(isModeratorRoleGrantable({ ...ordinaryRole, key: " Admin " })).toBe(false);
    expect(isModeratorRoleGrantable({ ...ordinaryRole, isOwnerRank: true })).toBe(false);
    expect(isModeratorRoleGrantable({ ...ordinaryRole, isSystem: true })).toBe(false);

    expect(validateModeratorGrantInput(grantInput, { ...ordinaryRole, permissions: ["*"] })).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        "moderator_grant_protected_role_forbidden",
        "moderator_grant_dangerous_permission_forbidden"
      ])
    });
  });
});
