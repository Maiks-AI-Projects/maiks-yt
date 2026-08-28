import {
  buildPublicCreatorLink,
  buildPublicCreatorLinkList,
  type CreatorLinkAvailability,
  type CreatorLinkIcon,
  type CreatorLinkPurpose,
  type CreatorLinkSource,
  type PublicCreatorLink
} from "@maiks-yt/domain";

export type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";

export type LinkFormState = {
  key: string;
  title: string;
  description: string;
  purpose: CreatorLinkPurpose;
  icon: CreatorLinkIcon;
  availability: CreatorLinkAvailability;
  href: string;
  availabilityNote: string;
  isPrimary: boolean;
  isPublished: boolean;
};

export type CreatorLinkDeleteEligibility =
  | { ok: true }
  | {
    ok: false;
    reason: "new_link" | "published" | "protected";
  };

export const protectedFundingAvailabilityNote = "Funding launches later";

export const emptyCreatorLinkForm: LinkFormState = {
  key: "",
  title: "",
  description: "",
  purpose: "social",
  icon: "social",
  availability: "unavailable",
  href: "",
  availabilityNote: "Destination not available yet.",
  isPrimary: false,
  isPublished: false
};

export const creatorLinkPurposes = [
  "account",
  "accountability",
  "affiliate",
  "community",
  "context",
  "feed",
  "project",
  "social",
  "stream",
  "support",
  "tool"
] satisfies CreatorLinkPurpose[];

export const creatorLinkIconNames = [
  "account",
  "accountability",
  "affiliate",
  "community",
  "context",
  "discord",
  "feed",
  "project",
  "social",
  "stream",
  "support",
  "twitch",
  "tool",
  "youtube"
] satisfies CreatorLinkIcon[];

export const formatCreatorLinkLabel = (value: string): string =>
  value.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");

export const sortCreatorLinks = (links: readonly CreatorLinkSource[]): CreatorLinkSource[] =>
  links.slice().sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title));

export const toCreatorLinkForm = (link: CreatorLinkSource): LinkFormState => ({
  key: link.key,
  title: link.title,
  description: link.description,
  purpose: link.purpose,
  icon: link.icon,
  availability: link.availability,
  href: link.href ?? "",
  availabilityNote: link.availabilityNote ?? "",
  isPrimary: link.isPrimary,
  isPublished: link.isPublished
});

export const isFundingCreatorLinkForm = (form: LinkFormState): boolean =>
  form.key.trim() === "support" || form.purpose === "support";

export const isFundingCreatorLinkSource = (link: CreatorLinkSource): boolean =>
  link.key === "support" || link.purpose === "support";

export const getEffectiveAvailability = (form: LinkFormState): CreatorLinkAvailability =>
  isFundingCreatorLinkForm(form) ? "unavailable" : form.availability;

export const toCreatorLinkPayload = (form: LinkFormState): Record<string, unknown> => {
  const funding = isFundingCreatorLinkForm(form);
  const availability = funding ? "unavailable" : form.availability;

  return {
    ...form,
    key: form.key.trim(),
    title: form.title.trim(),
    description: form.description.trim(),
    availability,
    href: availability === "available" ? form.href.trim() : null,
    availabilityNote: availability === "unavailable"
      ? funding ? protectedFundingAvailabilityNote : form.availabilityNote.trim()
      : null
  };
};

export const formsMatch = (left: LinkFormState, right: LinkFormState): boolean =>
  left.key === right.key
  && left.title === right.title
  && left.description === right.description
  && left.purpose === right.purpose
  && left.icon === right.icon
  && left.availability === right.availability
  && left.href === right.href
  && left.availabilityNote === right.availabilityNote
  && left.isPrimary === right.isPrimary
  && left.isPublished === right.isPublished;

export const isCreatorLinkFormDirty = (
  selectedLink: CreatorLinkSource | null,
  form: LinkFormState
): boolean =>
  !formsMatch(selectedLink ? toCreatorLinkForm(selectedLink) : emptyCreatorLinkForm, form);

export const requiresUnsavedEditGuard = (formIsDirty: boolean): boolean => formIsDirty;

export const getPublishDirtyGuardMessage = (willPublish: boolean): string =>
  willPublish ? "Publish these unsaved edits?" : "Save and unpublish these unsaved edits?";

export const moveCreatorLink = (
  links: readonly CreatorLinkSource[],
  from: number,
  to: number
): CreatorLinkSource[] => {
  if (from < 0 || to < 0 || from >= links.length || to >= links.length || from === to) {
    return links.slice();
  }

  const next = links.slice();
  const [item] = next.splice(from, 1);

  if (!item) {
    return links.slice();
  }

  next.splice(to, 0, item);
  return next.map((link, index) => ({ ...link, sortOrder: index + 1 }));
};

export const destinationLooksValid = (form: LinkFormState): boolean =>
  getEffectiveAvailability(form) === "available"
  && (form.href.startsWith("/") || /^https?:\/\/[^\s]+$/u.test(form.href));

export const buildLocalDraftCreatorLinkPreview = (
  form: LinkFormState,
  selectedLink: CreatorLinkSource | null
): PublicCreatorLink | null => {
  if (!form.key.trim() || !form.title.trim() || !form.description.trim()) {
    return null;
  }

  if (getEffectiveAvailability(form) === "available" && !destinationLooksValid(form)) {
    return null;
  }

  const payload = toCreatorLinkPayload(form);
  const source: CreatorLinkSource = {
    key: String(payload.key),
    title: String(payload.title),
    description: String(payload.description),
    purpose: payload.purpose as CreatorLinkPurpose,
    icon: payload.icon as CreatorLinkIcon,
    availability: payload.availability as CreatorLinkAvailability,
    href: payload.href as string | null,
    availabilityNote: payload.availabilityNote as string | null,
    isPrimary: Boolean(payload.isPrimary),
    sortOrder: selectedLink?.sortOrder ?? 0,
    isPublished: true
  };

  return buildPublicCreatorLink(source);
};

export const buildSavedPublicCreatorLinkPreview = (
  links: readonly CreatorLinkSource[]
): readonly PublicCreatorLink[] =>
  buildPublicCreatorLinkList(links);

export const getCreatorLinkDeleteEligibility = (
  selectedLink: CreatorLinkSource | null
): CreatorLinkDeleteEligibility => {
  if (!selectedLink) {
    return {
      ok: false,
      reason: "new_link"
    };
  }

  if (isFundingCreatorLinkSource(selectedLink)) {
    return {
      ok: false,
      reason: "protected"
    };
  }

  if (selectedLink.isPublished) {
    return {
      ok: false,
      reason: "published"
    };
  }

  return {
    ok: true
  };
};

export const getCreatorLinkDeleteUnavailableMessage = (
  eligibility: CreatorLinkDeleteEligibility
): string | null => {
  if (eligibility.ok) {
    return null;
  }

  if (eligibility.reason === "protected") {
    return "Funding is protected and cannot be deleted.";
  }

  if (eligibility.reason === "published") {
    return "Unpublish this link before deleting it.";
  }

  return "Save the draft before deleting it.";
};

export const isExactDeleteConfirmation = (
  selectedLink: CreatorLinkSource | null,
  confirmationTitle: string
): boolean =>
  Boolean(selectedLink && confirmationTitle === selectedLink.title);

export const getCreatorLinkFailureMessage = (response: Pick<Response, "status">, reason?: string): string => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "Sign in before managing Creator Hub links.";
  }

  if (
    response.status === 403
    || reason === "creator_link_admin_forbidden"
    || reason === "creator_link_admin_user_unlinked"
  ) {
    return "Your account does not have Creator Hub link admin permission.";
  }

  if (reason === "creator_link_key_conflict") {
    return "That link key is already in use.";
  }

  if (reason === "creator_link_admin_invalid_input") {
    return "The link request has invalid or missing fields.";
  }

  if (reason === "creator_link_delete_confirmation_mismatch") {
    return "Type the exact saved title before deleting this draft.";
  }

  if (reason === "creator_link_delete_published_blocked") {
    return "Unpublish this link before deleting it.";
  }

  if (reason === "creator_link_delete_protected") {
    return "Funding is protected and cannot be deleted.";
  }

  if (reason === "creator_link_not_found") {
    return "That link could not be found. Reload the list before trying again.";
  }

  return "Creator Hub link admin is temporarily unavailable. Try again shortly.";
};

export const getCreatorLinkLoadStateForFailure = (
  response: Pick<Response, "status">,
  reason?: string
): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

  if (
    response.status === 403
    || reason === "creator_link_admin_forbidden"
    || reason === "creator_link_admin_user_unlinked"
  ) {
    return "forbidden";
  }

  return "failed";
};
