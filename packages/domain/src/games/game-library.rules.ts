import {
  gameInterestStatuses,
  gameLibraryManageCapability,
  gameOwnershipStatuses,
  gameSuggestionStatuses,
  gameVisibilities,
  type GameLibraryAdminEntry,
  type GameLibraryAdminInput,
  type GameLibraryCapability,
  type GameLibrarySource,
  type GameScheduleAssociationSummary,
  type GameSuggestionAdminEntry,
  type GameSuggestionReviewInput,
  type GameSuggestionSource,
  type GameSlugValidationResult,
  type PublicGameSuggestionInput,
  type PublicGameLibraryEntry
} from "./game-library.types.js";

export const gameTitleMaxLength = 191;
export const gameSlugMaxLength = 191;
export const gamePlatformLabelMaxLength = 120;
export const gameStoreProviderMaxLength = 80;
export const gameStoreUrlMaxLength = 1024;
export const gameStreamFitNoteMaxLength = 500;
export const gameCategoryLabelMaxLength = 120;
export const gameContentWarningsMaxLength = 2000;
export const gameSuggestionReasonMaxLength = 1000;
export const gameSuggestionNameMaxLength = 191;
export const gameSuggestionReviewerNoteMaxLength = 1000;
export const gameSuggestionMaxTags = 8;
export const gameSuggestionTagMaxLength = 40;
export const gameSortOrderMin = -10_000;
export const gameSortOrderMax = 10_000;

const gameSlugPattern = /^[a-z0-9][a-z0-9-]{0,190}$/;

export const canManageGameLibrary = (capabilities: readonly unknown[]): boolean =>
  capabilities.some((capability): capability is GameLibraryCapability =>
    capability === "*" || capability === gameLibraryManageCapability
  );

export const normalizeGameSlug = (rawSlug: string): GameSlugValidationResult => {
  const trimmedSlug = rawSlug.trim().toLowerCase();

  if (trimmedSlug.length === 0) {
    return {
      ok: false,
      reason: "empty_slug"
    };
  }

  if (trimmedSlug.length > gameSlugMaxLength) {
    return {
      ok: false,
      reason: "slug_too_long"
    };
  }

  if (!gameSlugPattern.test(trimmedSlug)) {
    return {
      ok: false,
      reason: "malformed_slug"
    };
  }

  return {
    ok: true,
    slug: trimmedSlug
  };
};

export const createGameSlugFromTitle = (title: string): string => {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, gameSlugMaxLength);

  return normalized || "game";
};

const isValidRequiredText = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;

const isValidOptionalText = (value: unknown, maxLength: number): boolean =>
  value === undefined
  || value === null
  || (typeof value === "string" && value.trim().length <= maxLength);

const isValidOptionalUrl = (value: unknown): boolean => {
  if (value === undefined || value === null || value === "") {
    return true;
  }

  if (typeof value !== "string" || value.trim().length > gameStoreUrlMaxLength) {
    return false;
  }

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

const normalizeOptionalText = (value: string | null | undefined): string | null =>
  value?.trim() || null;

const normalizeSuggestionTags = (tags: readonly string[] | undefined): readonly string[] =>
  [...new Set((tags ?? [])
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0))]
    .slice(0, gameSuggestionMaxTags);

const isValidSortOrder = (value: unknown): boolean =>
  value === undefined
  || (typeof value === "number" && Number.isInteger(value) && value >= gameSortOrderMin && value <= gameSortOrderMax);

export const isValidGameLibraryAdminInput = (input: GameLibraryAdminInput): boolean => {
  const rawSlug = input.slug?.trim() || createGameSlugFromTitle(input.title);

  return isValidRequiredText(input.title, gameTitleMaxLength)
    && normalizeGameSlug(rawSlug).ok
    && isValidOptionalText(input.platformLabel, gamePlatformLabelMaxLength)
    && isValidOptionalText(input.storeProvider, gameStoreProviderMaxLength)
    && isValidOptionalUrl(input.storeUrl)
    && gameOwnershipStatuses.includes(input.ownershipStatus)
    && gameInterestStatuses.includes(input.interestStatus)
    && isValidOptionalText(input.streamFitNote, gameStreamFitNoteMaxLength)
    && isValidOptionalText(input.contentWarnings, gameContentWarningsMaxLength)
    && isValidOptionalText(input.categoryLabel, gameCategoryLabelMaxLength)
    && gameVisibilities.includes(input.visibility)
    && isValidSortOrder(input.sortOrder);
};

export const normalizePublicGameSuggestionInput = (
  input: PublicGameSuggestionInput
): PublicGameSuggestionInput => ({
  title: input.title.trim(),
  platformLabel: normalizeOptionalText(input.platformLabel),
  storeUrl: normalizeOptionalText(input.storeUrl),
  reason: normalizeOptionalText(input.reason),
  tags: normalizeSuggestionTags(input.tags),
  suggestedByName: normalizeOptionalText(input.suggestedByName)
});

export const isValidPublicGameSuggestionInput = (
  input: PublicGameSuggestionInput
): boolean =>
  isValidRequiredText(input.title, gameTitleMaxLength)
  && isValidOptionalText(input.platformLabel, gamePlatformLabelMaxLength)
  && isValidOptionalUrl(input.storeUrl)
  && isValidOptionalText(input.reason, gameSuggestionReasonMaxLength)
  && isValidOptionalText(input.suggestedByName, gameSuggestionNameMaxLength)
  && (input.tags ?? []).length <= gameSuggestionMaxTags
  && (input.tags ?? []).every((tag) => tag.trim().length > 0 && tag.trim().length <= gameSuggestionTagMaxLength);

export const normalizeGameSuggestionReviewInput = (
  input: GameSuggestionReviewInput
): GameSuggestionReviewInput => ({
  status: input.status,
  reviewerNote: normalizeOptionalText(input.reviewerNote),
  linkedGameId: normalizeOptionalText(input.linkedGameId)
});

export const isValidGameSuggestionReviewInput = (
  input: GameSuggestionReviewInput
): boolean =>
  gameSuggestionStatuses.includes(input.status)
  && (input.status as string) !== "pending"
  && isValidOptionalText(input.reviewerNote, gameSuggestionReviewerNoteMaxLength)
  && (input.linkedGameId === undefined
    || input.linkedGameId === null
    || (typeof input.linkedGameId === "string" && input.linkedGameId.trim().length > 0 && input.linkedGameId.trim().length <= 36));

export const buildGameSuggestionAdminEntry = (
  suggestion: GameSuggestionSource
): GameSuggestionAdminEntry => ({
  id: suggestion.id,
  title: suggestion.title,
  platformLabel: suggestion.platformLabel,
  storeUrl: suggestion.storeUrl,
  reason: suggestion.reason,
  tags: suggestion.tags,
  suggestedByName: suggestion.suggestedByName,
  status: suggestion.status,
  linkedGameId: suggestion.linkedGameId,
  reviewerNote: suggestion.reviewerNote,
  reviewedAt: suggestion.reviewedAt
});

export const buildPublicGameLibraryEntry = (entry: GameLibrarySource): PublicGameLibraryEntry | null => {
  if (entry.visibility !== "public") {
    return null;
  }

  return {
    id: entry.id,
    slug: entry.slug,
    title: entry.title,
    platformLabel: entry.platformLabel,
    storeProvider: entry.storeProvider,
    storeUrl: entry.storeUrl,
    artworkUrl: entry.artworkUrl,
    popularityScore: entry.popularityScore,
    ownershipStatus: entry.ownershipStatus,
    interestStatus: entry.interestStatus,
    streamFitNote: entry.streamFitNote,
    contentWarnings: entry.contentWarnings,
    categoryLabel: entry.categoryLabel,
    updatedAt: entry.updatedAt
  };
};

export const isRelevantGameScheduleAssociation = (
  association: GameScheduleAssociationSummary,
  now: Date
): boolean => {
  if (association.relationship !== "planned" && association.relationship !== "current") {
    return false;
  }

  if (association.status !== "planned" && association.status !== "live") {
    return false;
  }

  if (association.status === "live") {
    return true;
  }

  const startsAtTime = Date.parse(association.startsAt);

  return !Number.isNaN(startsAtTime) && startsAtTime >= now.getTime();
};

export const compareGameScheduleAssociations = (
  left: GameScheduleAssociationSummary,
  right: GameScheduleAssociationSummary
): number =>
  Date.parse(left.startsAt) - Date.parse(right.startsAt)
  || left.sortOrder - right.sortOrder
  || left.title.localeCompare(right.title);

export const buildGameLibraryAdminEntry = (
  entry: GameLibrarySource,
  scheduleAssociations: readonly GameScheduleAssociationSummary[],
  now: Date
): GameLibraryAdminEntry => {
  return {
    id: entry.id,
    slug: entry.slug,
    title: entry.title,
    platformLabel: entry.platformLabel,
    storeProvider: entry.storeProvider,
    storeUrl: entry.storeUrl,
    artworkUrl: entry.artworkUrl,
    popularityScore: entry.popularityScore,
    ownershipStatus: entry.ownershipStatus,
    interestStatus: entry.interestStatus,
    streamFitNote: entry.streamFitNote,
    contentWarnings: entry.contentWarnings,
    categoryLabel: entry.categoryLabel,
    visibility: entry.visibility,
    sortOrder: entry.sortOrder,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    scheduleAssociations: scheduleAssociations
      .filter((association) => isRelevantGameScheduleAssociation(association, now))
      .slice()
      .sort(compareGameScheduleAssociations)
  };
};
