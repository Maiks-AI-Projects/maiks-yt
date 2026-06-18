import {
  validateCreatorLinkAvailability
} from "./creator-link-read-model.rules.js";
import type {
  CreatorLinkAdminCapability,
  CreatorLinkAdminInput,
  CreatorLinkAdminReorderInput
} from "./creator-link-admin.types.js";

export const creatorLinkAdminKeyMaxLength = 80;
export const creatorLinkAdminTitleMaxLength = 191;
export const creatorLinkAdminDescriptionMaxLength = 2_000;
export const creatorLinkAdminHrefMaxLength = 1_024;
export const creatorLinkAdminAvailabilityNoteMaxLength = 191;

const creatorLinkKeyPattern = /^[a-z0-9][a-z0-9-]{0,79}$/;

export const canManageCreatorLinks = (capabilities: readonly unknown[]): boolean =>
  capabilities.some((capability): capability is CreatorLinkAdminCapability =>
    capability === "*" || capability === "creator-links:manage"
  );

export const isValidCreatorLinkAdminKey = (key: string): boolean =>
  creatorLinkKeyPattern.test(key);

const isValidRequiredText = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;

const isValidOptionalText = (value: unknown, maxLength: number): boolean =>
  value === undefined
    || value === null
    || (typeof value === "string" && value.trim().length <= maxLength);

const isSupportDestinationStillUnavailable = (input: CreatorLinkAdminInput): boolean =>
  input.key !== "support"
  && input.purpose !== "support"
  || input.availability === "unavailable";

export const isValidCreatorLinkAdminInput = (input: CreatorLinkAdminInput): boolean =>
  isValidCreatorLinkAdminKey(input.key)
  && isValidRequiredText(input.title, creatorLinkAdminTitleMaxLength)
  && isValidRequiredText(input.description, creatorLinkAdminDescriptionMaxLength)
  && isValidOptionalText(input.href, creatorLinkAdminHrefMaxLength)
  && isValidOptionalText(input.availabilityNote, creatorLinkAdminAvailabilityNoteMaxLength)
  && Number.isInteger(input.sortOrder)
  && input.sortOrder >= 0
  && validateCreatorLinkAvailability(input).length === 0
  && isSupportDestinationStillUnavailable(input);

export const isValidCreatorLinkAdminReorderInput = (input: CreatorLinkAdminReorderInput): boolean =>
  input.orderedKeys.length > 0
  && input.orderedKeys.every((key) => typeof key === "string" && isValidCreatorLinkAdminKey(key))
  && new Set(input.orderedKeys).size === input.orderedKeys.length;
