import type { CreatorLinkSource } from "@maiks-yt/domain";
import { describe, expect, it } from "vitest";

import {
  buildLocalDraftCreatorLinkPreview,
  buildSavedPublicCreatorLinkPreview,
  destinationLooksValid,
  emptyCreatorLinkForm,
  formatCreatorLinkLabel,
  getCreatorLinkDeleteEligibility,
  getCreatorLinkFailureMessage,
  getCreatorLinkDeleteUnavailableMessage,
  getEffectiveAvailability,
  getPublishDirtyGuardMessage,
  isCreatorLinkFormDirty,
  isExactDeleteConfirmation,
  moveCreatorLink,
  protectedFundingAvailabilityNote,
  requiresUnsavedEditGuard,
  sortCreatorLinks,
  toCreatorLinkForm,
  toCreatorLinkPayload
} from "./creator-link-admin.rules";

const createLink = (
  key: string,
  overrides: Partial<CreatorLinkSource> = {}
): CreatorLinkSource => ({
  key,
  title: `Link ${key}`,
  description: `Description for ${key}`,
  purpose: "social",
  icon: "social",
  availability: "available",
  href: `/${key}`,
  availabilityNote: null,
  isPrimary: false,
  sortOrder: 10,
  isPublished: false,
  ...overrides
});

describe("creator link admin rules", () => {
  it("projects inventory ordering through the single list control", () => {
    const first = createLink("first", { sortOrder: 20, title: "First" });
    const second = createLink("second", { sortOrder: 10, title: "Second" });
    const third = createLink("third", { sortOrder: 30, title: "Third" });

    expect(sortCreatorLinks([first, second, third]).map((link) => link.key)).toEqual(["second", "first", "third"]);
    expect(moveCreatorLink([second, first, third], 0, 2).map((link) => [link.key, link.sortOrder])).toEqual([
      ["first", 1],
      ["third", 2],
      ["second", 3]
    ]);
    expect(moveCreatorLink([second], 0, 2)).toEqual([second]);
  });

  it("tracks dirty state for selection, new-link, publish, and unpublish guards", () => {
    const selected = createLink("draft");
    const savedForm = toCreatorLinkForm(selected);
    const changedForm = { ...savedForm, title: "Changed" };

    expect(isCreatorLinkFormDirty(selected, savedForm)).toBe(false);
    expect(isCreatorLinkFormDirty(selected, changedForm)).toBe(true);
    expect(isCreatorLinkFormDirty(null, emptyCreatorLinkForm)).toBe(false);
    expect(isCreatorLinkFormDirty(null, { ...emptyCreatorLinkForm, title: "Unsaved" })).toBe(true);
    expect(requiresUnsavedEditGuard(true)).toBe(true);
    expect(getPublishDirtyGuardMessage(true)).toBe("Publish these unsaved edits?");
    expect(getPublishDirtyGuardMessage(false)).toBe("Save and unpublish these unsaved edits?");
  });

  it("builds local unsaved draft preview rows with the public row contract", () => {
    const selected = createLink("draft", { sortOrder: 9 });
    const preview = buildLocalDraftCreatorLinkPreview({
      ...toCreatorLinkForm(selected),
      title: "Unsaved title",
      description: "Unsaved public copy",
      href: "/unsaved",
      isPublished: false
    }, selected);

    expect(preview).toEqual({
      key: "draft",
      title: "Unsaved title",
      description: "Unsaved public copy",
      purpose: "social",
      icon: "social",
      availability: "available",
      href: "/unsaved",
      isPrimary: false,
      sortOrder: 9
    });

    expect(buildLocalDraftCreatorLinkPreview({
      ...emptyCreatorLinkForm,
      title: "Incomplete",
      description: "Missing destination",
      availability: "available",
      href: ""
    }, null)).toBeNull();
    expect(buildLocalDraftCreatorLinkPreview(emptyCreatorLinkForm, null)).toBeNull();
  });

  it("keeps the saved public preview derived only from persisted published rows", () => {
    const saved = buildSavedPublicCreatorLinkPreview([
      createLink("draft", { isPublished: false }),
      createLink("published", { isPublished: true })
    ]);

    expect(saved.map((link) => link.key)).toEqual(["published"]);
  });

  it("coerces Funding/support to protected unavailable state", () => {
    const payload = toCreatorLinkPayload({
      ...emptyCreatorLinkForm,
      key: "support",
      title: "Funding",
      description: "Funding support",
      purpose: "support",
      icon: "support",
      availability: "available",
      href: "https://example.com/pay",
      availabilityNote: ""
    });

    expect(getEffectiveAvailability({
      ...emptyCreatorLinkForm,
      purpose: "support",
      availability: "available"
    })).toBe("unavailable");
    expect(payload).toMatchObject({
      availability: "unavailable",
      href: null,
      availabilityNote: protectedFundingAvailabilityNote
    });
  });

  it("checks delete eligibility and exact title confirmation", () => {
    const draft = createLink("draft", { title: "Draft Link" });
    const published = createLink("published", { isPublished: true });
    const funding = createLink("support", {
      purpose: "support",
      title: "Funding"
    });

    expect(getCreatorLinkDeleteEligibility(null)).toEqual({ ok: false, reason: "new_link" });
    expect(getCreatorLinkDeleteEligibility(draft)).toEqual({ ok: true });
    expect(getCreatorLinkDeleteEligibility(published)).toEqual({ ok: false, reason: "published" });
    expect(getCreatorLinkDeleteEligibility(funding)).toEqual({ ok: false, reason: "protected" });
    expect(getCreatorLinkDeleteUnavailableMessage({ ok: false, reason: "published" })).toBe("Unpublish this link before deleting it.");
    expect(getCreatorLinkDeleteUnavailableMessage({ ok: false, reason: "protected" })).toBe("Funding is protected and cannot be deleted.");
    expect(isExactDeleteConfirmation(draft, "Draft Link")).toBe(true);
    expect(isExactDeleteConfirmation(draft, "draft link")).toBe(false);
  });

  it("maps API errors to finite owner-facing copy", () => {
    const unavailable = getCreatorLinkFailureMessage({ status: 503 }, "raw sql exception 500");

    expect(getCreatorLinkFailureMessage({ status: 401 }, "not_authenticated")).toBe("Sign in before managing Creator Hub links.");
    expect(getCreatorLinkFailureMessage({ status: 403 }, "creator_link_admin_user_unlinked")).toBe("Your account does not have Creator Hub link admin permission.");
    expect(getCreatorLinkFailureMessage({ status: 409 }, "creator_link_delete_protected")).toBe("Funding is protected and cannot be deleted.");
    expect(getCreatorLinkFailureMessage({ status: 400 }, "creator_link_delete_confirmation_mismatch")).toBe("Type the exact saved title before deleting this draft.");
    expect(unavailable).toBe("Creator Hub link admin is temporarily unavailable. Try again shortly.");
    expect(unavailable).not.toContain("503");
    expect(unavailable).not.toContain("sql");
  });

  it("keeps compact labels stable for source-level rendering tests", () => {
    expect(formatCreatorLinkLabel("not-public")).toBe("Not Public");
    expect(destinationLooksValid({
      ...emptyCreatorLinkForm,
      availability: "available",
      href: "https://maiks.yt"
    })).toBe(true);
  });
});
