import {
  isValidPublicUpdateSlug,
  publicUpdateBodyMaxLength,
  publicUpdateKinds,
  publicUpdateSummaryMaxLength,
  publicUpdateTitleMaxLength
} from "@maiks-yt/domain/updates";
import type {
  PublicUpdateAdminPreview,
  PublicUpdateKind,
  PublicUpdateSource
} from "@maiks-yt/domain/updates";

export type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";
export type UpdateFilter = "all" | "draft" | "published";

export type UpdateFormState = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  kind: PublicUpdateKind;
  isPinned: boolean;
};

export type PreviewAcknowledgement = {
  updateId: string;
  revision: string;
  preview: PublicUpdateAdminPreview;
};

export const createPreviewAcknowledgement = (
  updateId: string,
  response: { revision: string; update: PublicUpdateAdminPreview }
): PreviewAcknowledgement => ({
  updateId,
  revision: response.revision,
  preview: response.update
});

export const toPublishPayload = (
  acknowledgement: PreviewAcknowledgement
): { expectedRevision: string } => ({
  expectedRevision: acknowledgement.revision
});

export const updateKindOptions = publicUpdateKinds;

export const defaultUpdateForm: UpdateFormState = {
  slug: "",
  title: "",
  summary: "",
  body: "",
  kind: "post",
  isPinned: false
};

export const toUpdateForm = (update: PublicUpdateSource): UpdateFormState => ({
  slug: update.slug,
  title: update.title,
  summary: update.summary,
  body: update.body,
  kind: update.kind,
  isPinned: update.isPinned
});

export const toUpdatePayload = (form: UpdateFormState): Record<string, unknown> => ({
  slug: form.slug.trim(),
  title: form.title.trim(),
  summary: form.summary.trim(),
  body: form.body.trim(),
  kind: form.kind,
  isPinned: form.isPinned
});

export const formatUpdateKind = (kind: PublicUpdateKind): string => {
  if (kind === "stream-recap") {
    return "Stream recap";
  }

  return kind.charAt(0).toUpperCase() + kind.slice(1);
};

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
});

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric"
});

export const formatDateTime = (value: string | null): string =>
  value ? dateTimeFormatter.format(new Date(value)) : "Not published";

export const formatShortDate = (value: string | null): string =>
  value ? shortDateFormatter.format(new Date(value)) : "Draft";

export const getSavedLabel = (value: string | null): string =>
  value ? `Saved ${formatDateTime(value)}` : "Not saved yet";

export const getPublicUpdateHref = (update: Pick<PublicUpdateSource, "slug">): string =>
  `/updates/${update.slug}`;

export const getLocalUpdateFormIssue = (form: UpdateFormState): string | null => {
  const slug = form.slug.trim().toLowerCase();
  const title = form.title.trim();
  const summary = form.summary.trim();
  const body = form.body.trim();

  if (!isValidPublicUpdateSlug(slug)) {
    return "Use a slug with lowercase letters, numbers, and hyphens.";
  }

  if (title.length === 0) {
    return "Add a title before saving.";
  }

  if (title.length > publicUpdateTitleMaxLength) {
    return `Title must be ${publicUpdateTitleMaxLength} characters or fewer.`;
  }

  if (summary.length === 0) {
    return "Add a public summary before saving.";
  }

  if (summary.length > publicUpdateSummaryMaxLength) {
    return `Summary must be ${publicUpdateSummaryMaxLength} characters or fewer.`;
  }

  if (body.length === 0) {
    return "Add Markdown body content before saving.";
  }

  if (body.length > publicUpdateBodyMaxLength) {
    return `Body must be ${publicUpdateBodyMaxLength.toLocaleString()} characters or fewer.`;
  }

  if (!publicUpdateKinds.includes(form.kind)) {
    return "Choose a valid update type.";
  }

  return null;
};

export const isUpdateFormDirty = (
  selectedUpdate: PublicUpdateSource | null,
  form: UpdateFormState
): boolean => {
  const saved = selectedUpdate ? toUpdateForm(selectedUpdate) : defaultUpdateForm;

  return saved.slug !== form.slug
    || saved.title !== form.title
    || saved.summary !== form.summary
    || saved.body !== form.body
    || saved.kind !== form.kind
    || saved.isPinned !== form.isPinned;
};

export const previewMatchesSavedRevision = (
  selectedUpdate: PublicUpdateSource | null,
  previewAcknowledgement: PreviewAcknowledgement | null
): boolean =>
  Boolean(
    selectedUpdate
    && previewAcknowledgement
    && previewAcknowledgement.updateId === selectedUpdate.id
    && previewAcknowledgement.preview.id === selectedUpdate.id
    && previewAcknowledgement.preview.slug === selectedUpdate.slug
    && previewAcknowledgement.preview.title === selectedUpdate.title
    && previewAcknowledgement.preview.summary === selectedUpdate.summary
    && previewAcknowledgement.preview.body === selectedUpdate.body
    && previewAcknowledgement.preview.kind === selectedUpdate.kind
    && previewAcknowledgement.preview.isPinned === selectedUpdate.isPinned
    && previewAcknowledgement.preview.isExample === selectedUpdate.isExample
    && previewAcknowledgement.preview.updatedAt === selectedUpdate.updatedAt
  );

export const isPublishedUpdate = (update: PublicUpdateSource | null): boolean =>
  Boolean(update?.status === "published" && update.visibility === "public" && update.publishedAt);

export const canEditUpdate = (update: PublicUpdateSource | null): boolean =>
  !update || (update.status === "draft" && update.visibility === "hidden" && !update.isExample);

export const canPreviewSavedUpdate = (
  selectedUpdate: PublicUpdateSource | null,
  formIsDirty: boolean
): boolean =>
  Boolean(selectedUpdate && !formIsDirty && !selectedUpdate.isExample);

export const canPublishUpdate = ({
  selectedUpdate,
  form,
  formIsDirty,
  previewAcknowledgement
}: {
  selectedUpdate: PublicUpdateSource | null;
  form: UpdateFormState;
  formIsDirty: boolean;
  previewAcknowledgement: PreviewAcknowledgement | null;
}): boolean =>
  Boolean(
    selectedUpdate
    && selectedUpdate.status === "draft"
    && selectedUpdate.visibility === "hidden"
    && selectedUpdate.publishedAt === null
    && !selectedUpdate.isExample
    && !formIsDirty
    && !getLocalUpdateFormIssue(form)
    && previewMatchesSavedRevision(selectedUpdate, previewAcknowledgement)
  );

export const getUpdateStatusLabel = (update: PublicUpdateSource): string => {
  if (update.isExample) {
    return "Example";
  }

  return isPublishedUpdate(update) ? "Published" : "Draft";
};

export const getUpdateSortTime = (update: PublicUpdateSource): string =>
  update.publishedAt ?? update.updatedAt;

export const sortUpdates = (updates: readonly PublicUpdateSource[]): readonly PublicUpdateSource[] =>
  updates
    .slice()
    .sort((left, right) =>
      Number(right.isPinned) - Number(left.isPinned)
      || getUpdateSortTime(right).localeCompare(getUpdateSortTime(left))
      || left.title.localeCompare(right.title)
    );

export const filterUpdates = (
  updates: readonly PublicUpdateSource[],
  filter: UpdateFilter,
  searchQuery: string
): readonly PublicUpdateSource[] => {
  const query = searchQuery.trim().toLocaleLowerCase();

  return sortUpdates(updates).filter((update) => {
    const matchesFilter = filter === "all" || update.status === filter;
    const matchesQuery = query.length === 0
      || update.title.toLocaleLowerCase().includes(query)
      || update.slug.toLocaleLowerCase().includes(query)
      || update.summary.toLocaleLowerCase().includes(query)
      || formatUpdateKind(update.kind).toLocaleLowerCase().includes(query);

    return matchesFilter && matchesQuery;
  });
};

export const filterEditorInventoryUpdates = (
  updates: readonly PublicUpdateSource[]
): readonly PublicUpdateSource[] =>
  filterUpdates(updates.filter((update) => !update.isExample), "all", "");

export const countWords = (value: string): number => {
  const trimmed = value.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
};

export const getFailureMessage = (response: Response, reason?: string): string => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "Sign in before managing updates.";
  }

  if (
    response.status === 403
    || reason === "public_update_admin_forbidden"
    || reason === "public_update_admin_user_unlinked"
  ) {
    return "Your account does not have update publishing permission.";
  }

  if (reason === "public_update_slug_conflict") {
    return "That update slug is already used.";
  }

  if (reason === "public_update_example_immutable") {
    return "Example records cannot be edited or published.";
  }

  if (reason === "public_update_must_be_draft") {
    return "Unpublish this update before editing, or save a draft before publishing.";
  }

  if (reason === "public_update_preview_stale") {
    return "This saved preview is stale. Reload the update list, then preview the current draft again.";
  }

  if (reason === "public_update_invalid_input") {
    return "The update request has invalid or missing fields.";
  }

  if (reason === "public_update_not_found") {
    return "That update could not be found.";
  }

  return `Update request failed with ${response.status}.`;
};

export const getLoadStateForFailure = (response: Response, reason?: string): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

  if (
    response.status === 403
    || reason === "public_update_admin_forbidden"
    || reason === "public_update_admin_user_unlinked"
  ) {
    return "forbidden";
  }

  return "failed";
};
