import {
  gameCategoryLabelMaxLength,
  gameContentWarningsMaxLength,
  gameInterestStatuses,
  gameOwnershipStatuses,
  gamePlatformLabelMaxLength,
  gameSlugMaxLength,
  gameStoreProviderMaxLength,
  gameStoreUrlMaxLength,
  gameStreamFitNoteMaxLength,
  gameTitleMaxLength,
  publicGameLibraryMaxEntries,
  type GameInterestStatus,
  type GameOwnershipStatus,
  type PublicGameLibraryEntry
} from "@maiks-yt/domain/games";

type PublicGamesFailureReason = "game_library_unavailable";

type PublicGamesApiResponse =
  | {
    ok: true;
    games: readonly PublicGameLibraryEntry[];
  }
  | {
    ok: false;
    reason: PublicGamesFailureReason;
  };

const publicGamesFailureReasons = new Set<PublicGamesFailureReason>(["game_library_unavailable"]);
const ownershipStatuses = new Set<GameOwnershipStatus>(gameOwnershipStatuses);
const interestStatuses = new Set<GameInterestStatus>(gameInterestStatuses);
const gameSlugPattern = /^[a-z0-9][a-z0-9-]{0,190}$/;
const publicGameKeys = [
  "slug",
  "title",
  "platformLabel",
  "storeProvider",
  "storeUrl",
  "artworkUrl",
  "popularityScore",
  "ownershipStatus",
  "interestStatus",
  "streamFitNote",
  "contentWarnings",
  "categoryLabel",
  "updatedAt"
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).every((key) => keys.includes(key));

const hasRequiredKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  keys.every((key) => Object.hasOwn(value, key));

const isBoundedNonEmptyString = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;

const isBoundedStringOrNull = (value: unknown, maxLength: number): value is string | null =>
  value === null || (typeof value === "string" && value.length <= maxLength);

const isHttpUrlOrNull = (value: unknown): value is string | null => {
  if (value === null) return true;
  if (typeof value !== "string" || value.length > gameStoreUrlMaxLength) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

const isPopularityScoreOrNull = (value: unknown): value is number | null =>
  value === null
  || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0);

const isIsoDateString = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
};

const isNormalizedSlug = (value: unknown): value is string =>
  typeof value === "string" && value.length <= gameSlugMaxLength && gameSlugPattern.test(value);

const isOwnershipStatus = (value: unknown): value is GameOwnershipStatus =>
  typeof value === "string" && ownershipStatuses.has(value as GameOwnershipStatus);

const isInterestStatus = (value: unknown): value is GameInterestStatus =>
  typeof value === "string" && interestStatuses.has(value as GameInterestStatus);

const isFailureReason = (value: unknown): value is PublicGamesFailureReason =>
  typeof value === "string" && publicGamesFailureReasons.has(value as PublicGamesFailureReason);

const parsePublicGame = (value: unknown): PublicGameLibraryEntry | null => {
  if (!isRecord(value)
    || !hasOnlyKeys(value, publicGameKeys)
    || !hasRequiredKeys(value, publicGameKeys)
    || !isNormalizedSlug(value.slug)
    || !isBoundedNonEmptyString(value.title, gameTitleMaxLength)
    || !isBoundedStringOrNull(value.platformLabel, gamePlatformLabelMaxLength)
    || !isBoundedStringOrNull(value.storeProvider, gameStoreProviderMaxLength)
    || !isHttpUrlOrNull(value.storeUrl)
    || !isHttpUrlOrNull(value.artworkUrl)
    || !isPopularityScoreOrNull(value.popularityScore)
    || !isOwnershipStatus(value.ownershipStatus)
    || !isInterestStatus(value.interestStatus)
    || !isBoundedStringOrNull(value.streamFitNote, gameStreamFitNoteMaxLength)
    || !isBoundedStringOrNull(value.contentWarnings, gameContentWarningsMaxLength)
    || !isBoundedStringOrNull(value.categoryLabel, gameCategoryLabelMaxLength)
    || !isIsoDateString(value.updatedAt)) {
    return null;
  }

  return {
    slug: value.slug,
    title: value.title,
    platformLabel: value.platformLabel,
    storeProvider: value.storeProvider,
    storeUrl: value.storeUrl,
    artworkUrl: value.artworkUrl,
    popularityScore: value.popularityScore,
    ownershipStatus: value.ownershipStatus,
    interestStatus: value.interestStatus,
    streamFitNote: value.streamFitNote,
    contentWarnings: value.contentWarnings,
    categoryLabel: value.categoryLabel,
    updatedAt: value.updatedAt
  };
};

export const parsePublicGamesApiResponse = (value: unknown): PublicGamesApiResponse | null => {
  if (!isRecord(value) || !hasOnlyKeys(value, ["ok", "games", "reason"])) return null;

  if (value.ok === false) {
    return hasOnlyKeys(value, ["ok", "reason"]) && isFailureReason(value.reason)
      ? { ok: false, reason: value.reason }
      : null;
  }

  if (value.ok !== true
    || !hasOnlyKeys(value, ["ok", "games"])
    || !Array.isArray(value.games)
    || value.games.length > publicGameLibraryMaxEntries) {
    return null;
  }

  const games = value.games.map(parsePublicGame);
  if (games.some((game) => game === null)) return null;

  const parsedGames = games as PublicGameLibraryEntry[];
  const slugs = new Set(parsedGames.map((game) => game.slug));
  return slugs.size === parsedGames.length
    ? { ok: true, games: parsedGames }
    : null;
};
