import { describe, expect, it } from "vitest";

import {
  getFailureMessage,
  rankPathIsProtectedForEditing,
  roleIsProtectedForEditing,
  type ModeratorAdminRole
} from "./moderator-admin-client.service";

const now = "2026-08-28T12:00:00.000Z";

const createRole = (overrides: Partial<ModeratorAdminRole> = {}): ModeratorAdminRole => ({
  id: "helper-role",
  key: "community-helper",
  name: "Community helper",
  permissions: ["chat:view"],
  rankPathId: "mod-path",
  rankPathKey: "mod",
  rankPathName: "Moderator",
  rankLevel: 1,
  displayLabel: null,
  nextRoleId: null,
  discordRoleId: null,
  isOwnerRank: false,
  isSystem: false,
  authorityIntegrity: "valid",
  grantable: true,
  createdAt: now,
  updatedAt: now,
  ...overrides
});

describe("moderator admin client contract", () => {
  it("shows finite protected-rank copy before generic 403 permission copy", () => {
    const forbidden = new Response(null, { status: 403 });

    expect(getFailureMessage(forbidden, "moderator_admin_role_protected")).toBe(
      "This protected rank cannot be created, changed, or removed here."
    );
    expect(getFailureMessage(forbidden, "moderator_admin_rank_path_protected")).toBe(
      "This promotion path contains a protected rank and cannot be changed here."
    );
    expect(getFailureMessage(forbidden, "moderator_admin_forbidden")).toBe(
      "Your account does not have moderator management permission."
    );
  });

  it("treats owner, system, wildcard, reserved-key, and malformed roles as protected", () => {
    expect(roleIsProtectedForEditing(createRole())).toBe(false);

    for (const role of [
      createRole({ isOwnerRank: true }),
      createRole({ isSystem: true }),
      createRole({ permissions: ["chat:view", "*"] }),
      createRole({ key: "admin" }),
      createRole({ key: "owner" }),
      createRole({
        key: "invalid-role-key",
        permissions: [],
        authorityIntegrity: "invalid",
        grantable: true
      }),
      { ...createRole(), permissions: ["chat:view", 7] } as unknown as ModeratorAdminRole
    ]) {
      expect(roleIsProtectedForEditing(role)).toBe(true);
    }
  });

  it("protects only paths that contain protected or malformed roles", () => {
    const ordinaryRole = createRole();
    expect(rankPathIsProtectedForEditing([ordinaryRole], "mod-path")).toBe(false);
    expect(rankPathIsProtectedForEditing([
      ordinaryRole,
      createRole({ id: "system-role", key: "system-helper", isSystem: true })
    ], "mod-path")).toBe(true);
    expect(rankPathIsProtectedForEditing([
      ordinaryRole,
      createRole({
        id: "invalid-role",
        key: "invalid-role-key",
        permissions: [],
        authorityIntegrity: "invalid",
        grantable: true
      })
    ], "mod-path")).toBe(true);
    expect(rankPathIsProtectedForEditing([ordinaryRole], "other-path")).toBe(false);
  });
});
