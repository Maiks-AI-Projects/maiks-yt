import { describe, expect, it } from "vitest";

import {
  addOneYearProfileHandleReuseHold,
  buildHandleBasedProfileImageRoutePath,
  buildProfileRoutePath,
  assignableReservedProfileHandles,
  createOpaqueProfileImageIdentifierFromTrustedSource,
  decideActiveProfileHandleRename,
  decideActiveProfileHandleRetirement,
  decideExpiredRetiredProfileHandleActivation,
  decideReservedProfileHandleActivation,
  decideReservedProfileHandleChange,
  decideReservedProfileHandleRelease,
  isRetiredProfileHandleReusable,
  normalizeProfileHandleInput,
  reservedProfileHandles,
  type ProfileHandleSnapshot
} from "../src/index.js";

const transitionAt = "2026-08-28T12:00:00.000Z";

const activeHandle = (handle: string): ProfileHandleSnapshot => ({
  handle,
  state: "active",
  transitionKind: "owner_assigned"
});

const reservedHandle = (handle: string): ProfileHandleSnapshot => ({
  handle,
  state: "reserved",
  transitionKind: "owner_reserved"
});

const retiredHandle = (handle: string, reusableAfter: string): ProfileHandleSnapshot => ({
  handle,
  state: "retired",
  reusableAfter,
  transitionKind: "renamed"
});

describe("profile handle rules", () => {
  it("normalizes owner input to the approved lowercase ASCII canonical handle", () => {
    expect(normalizeProfileHandleInput("  Maiks  ", { allowedReservedHandles: ["maiks"] })).toEqual({
      ok: true,
      handle: "maiks"
    });
    expect(normalizeProfileHandleInput("@maiks", { allowedReservedHandles: ["maiks"] })).toEqual({
      ok: true,
      handle: "maiks"
    });
    expect(normalizeProfileHandleInput("MaiksPlays")).toEqual({
      ok: true,
      handle: "maiksplays"
    });
  });

  it("rejects reserved words unless the reviewed action allows that exact handle", () => {
    expect(normalizeProfileHandleInput("admin")).toEqual({
      ok: false,
      reason: "reserved_handle"
    });
    expect(normalizeProfileHandleInput("admin", { allowedReservedHandles: ["admin"] })).toEqual({
      ok: false,
      reason: "reserved_handle"
    });
    expect(normalizeProfileHandleInput("profiles")).toEqual({
      ok: false,
      reason: "reserved_handle"
    });
    expect(normalizeProfileHandleInput("maiks")).toEqual({
      ok: false,
      reason: "reserved_handle"
    });
    expect(normalizeProfileHandleInput("maiks", { allowedReservedHandles: ["maiks"] })).toEqual({
      ok: true,
      handle: "maiks"
    });
  });

  it("rejects malformed handles before they become public route segments", () => {
    expect(normalizeProfileHandleInput("ab")).toEqual({ ok: false, reason: "handle_too_short" });
    expect(normalizeProfileHandleInput("a".repeat(33))).toEqual({ ok: false, reason: "handle_too_long" });
    expect(normalizeProfileHandleInput("-maiks")).toEqual({ ok: false, reason: "leading_hyphen" });
    expect(normalizeProfileHandleInput("maiks-")).toEqual({ ok: false, reason: "trailing_hyphen" });
    expect(normalizeProfileHandleInput("ma--iks")).toEqual({ ok: false, reason: "consecutive_hyphen" });

    for (const value of ["mai ks", "maiks/mc", "maiks\\mc", "maiks.mc", "maiks_mc", "maiks?x=1", "maiks#bio", "ma%69ks", "maiks\nmc", "ma\u200Diks", "måiks"]) {
      expect(normalizeProfileHandleInput(value)).toEqual({
        ok: false,
        reason: "invalid_character"
      });
    }
  });

  it("activates reserved handles only through a reviewed data action", () => {
    expect(assignableReservedProfileHandles).toEqual(["maiks"]);

    for (const handle of reservedProfileHandles) {
      if (handle === "maiks") {
        continue;
      }

      expect(decideReservedProfileHandleActivation({
        handle: reservedHandle(handle),
        reviewedDataAction: true,
        targetAccountHasActiveHandle: false,
        transitionAt
      })).toEqual({
        ok: false,
        reason: "reserved_handle_not_assignable"
      });
    }

    expect(decideReservedProfileHandleActivation({
      handle: reservedHandle("admin"),
      reviewedDataAction: true,
      targetAccountHasActiveHandle: false,
      transitionAt
    })).toEqual({
      ok: false,
      reason: "reserved_handle_not_assignable"
    });

    expect(decideReservedProfileHandleActivation({
      handle: reservedHandle("maiks"),
      reviewedDataAction: false,
      targetAccountHasActiveHandle: false,
      transitionAt
    })).toEqual({
      ok: false,
      reason: "reviewed_data_action_required"
    });

    expect(decideReservedProfileHandleActivation({
      handle: reservedHandle("maiks"),
      reviewedDataAction: true,
      targetAccountHasActiveHandle: false,
      transitionAt
    })).toEqual({
      ok: true,
      plan: {
        state: "active",
        handle: "maiks",
        assignedAt: transitionAt,
        transitionKind: "owner_assigned"
      }
    });
  });

  it("allows expired retired handles only after the one-year reuse hold", () => {
    expect(decideExpiredRetiredProfileHandleActivation({
      handle: retiredHandle("old-name", "2027-08-28T12:00:00.000Z"),
      targetAccountHasActiveHandle: false,
      transitionAt
    })).toEqual({
      ok: false,
      reason: "retired_handle_not_reusable"
    });

    expect(decideExpiredRetiredProfileHandleActivation({
      handle: retiredHandle("old-name", transitionAt),
      targetAccountHasActiveHandle: false,
      transitionAt
    })).toEqual({
      ok: true,
      plan: {
        state: "active",
        handle: "old-name",
        assignedAt: transitionAt,
        transitionKind: "expired_reuse_assigned"
      }
    });

    expect(isRetiredProfileHandleReusable(
      retiredHandle("old-name", "2027-08-28T14:00:00.000+02:00"),
      "2027-08-28T08:00:00.000-04:00"
    )).toBe(true);

    expect(isRetiredProfileHandleReusable(
      retiredHandle("old-name", "2027-08-28T14:00:00.001+02:00"),
      "2027-08-28T12:00:00.000Z"
    )).toBe(false);

    expect(isRetiredProfileHandleReusable(
      retiredHandle("old-name", "not-a-timestamp"),
      transitionAt
    )).toBe(false);
    expect(isRetiredProfileHandleReusable(
      retiredHandle("old-name", transitionAt),
      "not-a-timestamp"
    )).toBe(false);
    expect(isRetiredProfileHandleReusable(
      retiredHandle("old-name", "2027-02-30T12:00:00.000Z"),
      "2027-03-02T12:00:00.000Z"
    )).toBe(false);
    expect(isRetiredProfileHandleReusable(
      retiredHandle("old-name", "08/28/2027 12:00:00"),
      transitionAt
    )).toBe(false);
    expect(isRetiredProfileHandleReusable(
      retiredHandle("old-name", "2027-08-28T12:00:00Z"),
      transitionAt
    )).toBe(false);
    expect(isRetiredProfileHandleReusable(
      retiredHandle("old-name", "2027-08-28T12:00:00.000+24:00"),
      transitionAt
    )).toBe(false);

    expect(decideExpiredRetiredProfileHandleActivation({
      handle: retiredHandle("old-name", "not-a-timestamp"),
      targetAccountHasActiveHandle: false,
      transitionAt
    })).toEqual({
      ok: false,
      reason: "retired_handle_not_reusable"
    });

    expect(decideExpiredRetiredProfileHandleActivation({
      handle: retiredHandle("old-name", transitionAt),
      targetAccountHasActiveHandle: false,
      transitionAt: "not-a-timestamp"
    })).toEqual({
      ok: false,
      reason: "retired_handle_not_reusable"
    });
  });

  it("retires active handles for at least one year with the exact transition kind", () => {
    expect(decideActiveProfileHandleRetirement({
      handle: activeHandle("old-name"),
      reason: "deleted_user",
      transitionAt
    })).toEqual({
      ok: true,
      plan: {
        state: "retired",
        handle: "old-name",
        retiredAt: transitionAt,
        reusableAfter: "2027-08-28T12:00:00.000Z",
        transitionKind: "deleted_user"
      }
    });
    expect(addOneYearProfileHandleReuseHold("2024-02-29T08:30:00.000Z")).toBe("2025-02-28T08:30:00.000Z");
  });

  it("renames an active handle as one retirement plus one target activation plan", () => {
    expect(decideActiveProfileHandleRename({
      currentHandle: activeHandle("maiks-old"),
      targetHandle: "maiks-new",
      targetHandleSnapshot: null,
      reviewedDataActionForReservedTarget: false,
      transitionAt
    })).toEqual({
      ok: true,
      plan: {
        retireCurrent: {
          state: "retired",
          handle: "maiks-old",
          retiredAt: transitionAt,
          reusableAfter: "2027-08-28T12:00:00.000Z",
          transitionKind: "renamed"
        },
        activateTarget: {
          state: "active",
          handle: "maiks-new",
          assignedAt: transitionAt,
          transitionKind: "owner_assigned"
        }
      }
    });

    expect(decideActiveProfileHandleRename({
      currentHandle: activeHandle("maiks-old"),
      targetHandle: "taken",
      targetHandleSnapshot: activeHandle("taken"),
      reviewedDataActionForReservedTarget: false,
      transitionAt
    })).toEqual({
      ok: false,
      reason: "target_handle_active"
    });

    expect(decideActiveProfileHandleRename({
      currentHandle: activeHandle("maiks-old"),
      targetHandle: "admin",
      targetHandleSnapshot: reservedHandle("admin"),
      reviewedDataActionForReservedTarget: true,
      transitionAt
    })).toEqual({
      ok: false,
      reason: "reserved_target_not_assignable"
    });

    expect(decideActiveProfileHandleRename({
      currentHandle: activeHandle("maiks-old"),
      targetHandle: "admin",
      targetHandleSnapshot: null,
      reviewedDataActionForReservedTarget: true,
      transitionAt
    })).toEqual({
      ok: false,
      reason: "reserved_target_not_assignable"
    });

    expect(decideActiveProfileHandleRename({
      currentHandle: activeHandle("maiks-old"),
      targetHandle: "maiks",
      targetHandleSnapshot: null,
      reviewedDataActionForReservedTarget: false,
      transitionAt
    })).toEqual({
      ok: false,
      reason: "reserved_target_requires_review"
    });

    expect(decideActiveProfileHandleRename({
      currentHandle: activeHandle("maiks-old"),
      targetHandle: "maiks",
      targetHandleSnapshot: null,
      reviewedDataActionForReservedTarget: true,
      transitionAt
    })).toEqual({
      ok: false,
      reason: "reserved_target_state_missing"
    });
  });

  it("changes and releases reservations without retiring them", () => {
    expect(decideReservedProfileHandleRelease({
      handle: reservedHandle("maiks"),
      reviewedDataAction: false
    })).toEqual({
      ok: false,
      reason: "reviewed_data_action_required"
    });

    expect(decideReservedProfileHandleRelease({
      handle: reservedHandle("maiks"),
      reviewedDataAction: true
    })).toEqual({
      ok: true,
      plan: {
        kind: "release_reserved",
        handle: "maiks"
      }
    });

    expect(decideReservedProfileHandleChange({
      currentHandle: reservedHandle("maiks"),
      reviewedDataAction: false,
      targetHandle: "maiks-tv",
      targetHandleSnapshot: null,
      transitionAt
    })).toEqual({
      ok: false,
      reason: "reviewed_data_action_required"
    });

    expect(decideReservedProfileHandleChange({
      currentHandle: reservedHandle("maiks"),
      reviewedDataAction: true,
      targetHandle: "maiks-tv",
      targetHandleSnapshot: null,
      transitionAt
    })).toEqual({
      ok: true,
      plan: {
        releaseCurrent: {
          kind: "release_reserved",
          handle: "maiks"
        },
        reserveTarget: {
          state: "reserved",
          handle: "maiks-tv",
          reservedAt: transitionAt,
          transitionKind: "owner_reserved"
        }
      }
    });

    expect(decideReservedProfileHandleChange({
      currentHandle: reservedHandle("maiks"),
      reviewedDataAction: true,
      targetHandle: "taken",
      targetHandleSnapshot: activeHandle("taken"),
      transitionAt
    })).toEqual({
      ok: false,
      reason: "target_handle_active"
    });
  });

  it("builds only handle-based public routes and brands only trusted opaque image tokens", () => {
    expect(buildProfileRoutePath("maiks")).toBe("/profiles/maiks");
    expect(buildHandleBasedProfileImageRoutePath("maiks")).toBe("/profiles/maiks/image");
    expect(buildProfileRoutePath("Maiks")).toBeNull();
    expect(buildProfileRoutePath("maiks/mc")).toBeNull();
    expect(buildProfileRoutePath("admin")).toBeNull();

    expect(createOpaqueProfileImageIdentifierFromTrustedSource(
      "profimg_2N7mK9pQ4sR8tV1x"
    )?.value).toBe("profimg_2N7mK9pQ4sR8tV1x");
    expect(createOpaqueProfileImageIdentifierFromTrustedSource(
      "8f4b2d9e-7f42-4c1c-9e4a-12b0c0401a4d"
    )).toBeNull();
    expect(createOpaqueProfileImageIdentifierFromTrustedSource(
      "8f4b2d9e7f424c1c9e4a12b0c0401a4d"
    )).toBeNull();
    expect(createOpaqueProfileImageIdentifierFromTrustedSource(
      "12345678901234567890"
    )).toBeNull();
    expect(createOpaqueProfileImageIdentifierFromTrustedSource(
      "user_1234567890123456"
    )).toBeNull();
    expect(createOpaqueProfileImageIdentifierFromTrustedSource(
      "ACCOUNT-ID_1234567890123456"
    )).toBeNull();
    expect(createOpaqueProfileImageIdentifierFromTrustedSource(
      "users/8f4b2d9e/profile-image"
    )).toBeNull();
  });
});
