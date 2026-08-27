import { describe, expect, it } from "vitest";
import type { PublicUpdateDetail, PublicUpdateSource } from "@maiks-yt/domain/updates";

import {
  canEditUpdate,
  canPublishUpdate,
  createPreviewAcknowledgement,
  defaultUpdateForm,
  filterEditorInventoryUpdates,
  filterUpdates,
  getFailureMessage,
  getLocalUpdateFormIssue,
  isUpdateFormDirty,
  previewMatchesSavedRevision,
  toPublishPayload,
  toUpdateForm,
  type PreviewAcknowledgement
} from "./public-update-admin.rules";

const createUpdate = (
  id: string,
  overrides: Partial<PublicUpdateSource> = {}
): PublicUpdateSource => ({
  id,
  slug: id,
  title: `Update ${id}`,
  summary: `Summary ${id}`,
  body: `Body ${id}`,
  kind: "post",
  status: "draft",
  visibility: "hidden",
  publishedAt: null,
  isPinned: false,
  isExample: false,
  updatedAt: "2026-08-27T12:00:00.000Z",
  ...overrides
});

const createPreview = (update: PublicUpdateSource): PreviewAcknowledgement => ({
  updateId: update.id,
  revision: "a".repeat(64),
  preview: {
    id: update.id,
    slug: update.slug,
    title: update.title,
    summary: update.summary,
    body: update.body,
    kind: update.kind,
    isPinned: update.isPinned,
    isExample: update.isExample,
    publishedAt: update.publishedAt ?? update.updatedAt,
    updatedAt: update.updatedAt
  } satisfies PublicUpdateDetail
});

describe("public update admin rules", () => {
  it("filters updates by lifecycle and search text", () => {
    const draft = createUpdate("draft-note", {
      title: "Draft note",
      summary: "Private editor work"
    });
    const published = createUpdate("stream-recap", {
      kind: "stream-recap",
      status: "published",
      visibility: "public",
      publishedAt: "2026-08-27T13:00:00.000Z",
      title: "Stream recap"
    });

    expect(filterUpdates([draft, published], "draft", "").map((update) => update.id))
      .toEqual(["draft-note"]);
    expect(filterUpdates([draft, published], "published", "recap").map((update) => update.id))
      .toEqual(["stream-recap"]);
    expect(filterUpdates([draft, published], "all", "editor").map((update) => update.id))
      .toEqual(["draft-note"]);
  });

  it("omits example records from the ordinary editor inventory", () => {
    const realDraft = createUpdate("real-draft");
    const realPublished = createUpdate("real-published", {
      status: "published",
      visibility: "public",
      publishedAt: "2026-08-27T13:00:00.000Z"
    });
    const example = createUpdate("example", { isExample: true });

    expect(filterEditorInventoryUpdates([example, realDraft, realPublished]).map((update) => update.id))
      .toEqual(["real-published", "real-draft"]);
  });

  it("tracks dirty form state without saving a new draft early", () => {
    const update = createUpdate("saved");

    expect(isUpdateFormDirty(update, toUpdateForm(update))).toBe(false);
    expect(isUpdateFormDirty(update, { ...toUpdateForm(update), title: "Changed" })).toBe(true);
    expect(isUpdateFormDirty(null, defaultUpdateForm)).toBe(false);
    expect(isUpdateFormDirty(null, { ...defaultUpdateForm, title: "Unsaved" })).toBe(true);
  });

  it("keeps publish locked to the current saved preview revision", () => {
    const update = createUpdate("saved");
    const acknowledgement = createPreview(update);

    expect(previewMatchesSavedRevision(update, acknowledgement)).toBe(true);
    expect(canPublishUpdate({
      selectedUpdate: update,
      form: toUpdateForm(update),
      formIsDirty: false,
      previewAcknowledgement: acknowledgement
    })).toBe(true);

    expect(canPublishUpdate({
      selectedUpdate: { ...update, title: "Changed in the same second" },
      form: toUpdateForm(update),
      formIsDirty: false,
      previewAcknowledgement: acknowledgement
    })).toBe(false);

    expect(canPublishUpdate({
      selectedUpdate: update,
      form: { ...toUpdateForm(update), title: "Changed" },
      formIsDirty: true,
      previewAcknowledgement: acknowledgement
    })).toBe(false);
  });

  it("stores and sends the opaque revision returned with the preview", () => {
    const savedRow = createUpdate("saved");
    const previewResponse = {
      revision: "b".repeat(64),
      update: createPreview(savedRow).preview
    };
    const previewAcknowledgement = createPreviewAcknowledgement(savedRow.id, previewResponse);

    expect(previewAcknowledgement.revision).toBe("b".repeat(64));
    expect(toPublishPayload(previewAcknowledgement)).toEqual({
      expectedRevision: "b".repeat(64)
    });
    expect(previewMatchesSavedRevision(savedRow, previewAcknowledgement)).toBe(true);
  });

  it("uses explicit stale-preview copy for publish conflicts", () => {
    const response = new Response(null, { status: 409 });

    expect(getFailureMessage(response, "public_update_preview_stale"))
      .toBe("This saved preview is stale. Reload the update list, then preview the current draft again.");
  });

  it("blocks editing and publishing protected or live records", () => {
    const published = createUpdate("live", {
      status: "published",
      visibility: "public",
      publishedAt: "2026-08-27T13:00:00.000Z"
    });
    const example = createUpdate("example", { isExample: true });

    expect(canEditUpdate(published)).toBe(false);
    expect(canEditUpdate(example)).toBe(false);
    expect(canPublishUpdate({
      selectedUpdate: example,
      form: toUpdateForm(example),
      formIsDirty: false,
      previewAcknowledgement: createPreview(example)
    })).toBe(false);
  });

  it("validates the production API input shape before saving", () => {
    expect(getLocalUpdateFormIssue(defaultUpdateForm)).toBe("Use a slug with lowercase letters, numbers, and hyphens.");
    expect(getLocalUpdateFormIssue({
      slug: "valid-update",
      title: "Valid update",
      summary: "Short summary",
      body: "Body",
      kind: "announcement",
      isPinned: false
    })).toBeNull();
  });
});
