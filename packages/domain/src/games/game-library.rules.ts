import {
  gameInterestStatuses,
  gameLibraryManageCapability,
  gameOwnershipStatuses,
  gameVisibilities,
  type GameLibraryAdminInput,
  type GameLibraryCapability,
  type GameLibrarySource,
  type GameSlugValidationResult,
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

export const buildPublicGameLibraryEntry = (entry: GameLibrarySource): PublicGameLibraryEntry | null => {
  if (entry.visibility !== "public") {
    return null;
  }

  return {
    id: entry.id,
    slug: entry.slug,
    title: entry.title,
    platformLabel: entry.platformLabel,
    ownershipStatus: entry.ownershipStatus,
    interestStatus: entry.interestStatus,
    streamFitNote: entry.streamFitNote,
    contentWarnings: entry.contentWarnings,
    categoryLabel: entry.categoryLabel,
    updatedAt: entry.updatedAt
  };
};
