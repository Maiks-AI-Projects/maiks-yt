import {
  type StreamScheduleEntry,
  type StreamScheduleGameLink,
  streamScheduleGameLinkRelationships
} from "@maiks-yt/domain/schedule";
import {
  gameInterestStatuses,
  gameOwnershipStatuses
} from "@maiks-yt/domain/games";

import type { StreamScheduleLoadResult } from "../schedule/stream-schedule-data";
import { formatScheduleDate } from "../schedule/stream-schedule-data";

export type HomeScheduleSlot =
  | {
    status: "live" | "planned";
    title: string;
    timeLabel: string;
    gameFocus?: HomeScheduleGameFocus;
  }
  | {
    status: "empty" | "unavailable";
  };

export type HomeScheduleGameFocus = {
  title: string;
  platformLabel?: string;
};

type HomeScheduleCandidate = Pick<StreamScheduleEntry, "startsAt" | "title"> & {
  status: "live" | "planned";
  gameLinks?: unknown;
};

const gameFocusTitleMaxLength = 96;
const gameFocusPlatformMaxLength = 64;
const gameSlugPattern = /^[a-z0-9][a-z0-9-]{0,190}$/;

const isValidDateString = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isHomeScheduleCandidate = (
  stream: unknown
): stream is HomeScheduleCandidate => isRecord(stream)
  && isNonEmptyString(stream.title)
  && isValidDateString(stream.startsAt)
  && (stream.status === "live" || stream.status === "planned");

const isNormalizedSlug = (value: unknown): value is string =>
  typeof value === "string" && gameSlugPattern.test(value);

const isGameOwnershipStatus = (
  value: unknown
): value is StreamScheduleGameLink["ownershipStatus"] =>
  typeof value === "string"
  && gameOwnershipStatuses.includes(value as StreamScheduleGameLink["ownershipStatus"]);

const isGameInterestStatus = (
  value: unknown
): value is StreamScheduleGameLink["interestStatus"] =>
  typeof value === "string"
  && gameInterestStatuses.includes(value as StreamScheduleGameLink["interestStatus"]);

const isGameLinkRelationship = (
  value: unknown
): value is StreamScheduleGameLink["relationship"] =>
  typeof value === "string"
  && streamScheduleGameLinkRelationships.includes(value as StreamScheduleGameLink["relationship"]);

const isScheduleGameLink = (gameLink: unknown): gameLink is StreamScheduleGameLink =>
  isRecord(gameLink)
  && isNonEmptyString(gameLink.id)
  && isNonEmptyString(gameLink.gameId)
  && isNormalizedSlug(gameLink.slug)
  && isNonEmptyString(gameLink.title)
  && (gameLink.platformLabel === null || isNonEmptyString(gameLink.platformLabel))
  && isGameOwnershipStatus(gameLink.ownershipStatus)
  && isGameInterestStatus(gameLink.interestStatus)
  && isGameLinkRelationship(gameLink.relationship)
  && (gameLink.publicNote === null || typeof gameLink.publicNote === "string")
  && typeof gameLink.sortOrder === "number"
  && Number.isInteger(gameLink.sortOrder);

const boundText = (value: string, maxLength: number): string =>
  value.trim().slice(0, maxLength).trimEnd();

const getGameFocus = (gameLinks: unknown): HomeScheduleGameFocus | undefined => {
  if (!Array.isArray(gameLinks)) {
    return undefined;
  }

  const gameLink = gameLinks.find(isScheduleGameLink);

  if (!gameLink) {
    return undefined;
  }

  return {
    title: boundText(gameLink.title, gameFocusTitleMaxLength),
    ...(gameLink.platformLabel
      ? { platformLabel: boundText(gameLink.platformLabel, gameFocusPlatformMaxLength) }
      : {})
  };
};

const chooseEarlierStream = (
  current: HomeScheduleCandidate | null,
  candidate: HomeScheduleCandidate
): HomeScheduleCandidate => {
  if (!current) {
    return candidate;
  }

  return Date.parse(candidate.startsAt) < Date.parse(current.startsAt)
    ? candidate
    : current;
};

export const getHomeScheduleSlot = (
  result: StreamScheduleLoadResult
): HomeScheduleSlot => {
  if (result.status === "error") {
    return { status: "unavailable" };
  }

  if (!Array.isArray(result.streams)) {
    return { status: "unavailable" };
  }

  let liveStream: HomeScheduleCandidate | null = null;
  let plannedStream: HomeScheduleCandidate | null = null;
  let hasMalformedCurrentCandidate = false;

  for (const stream of result.streams) {
    const status = isRecord(stream) ? stream.status : undefined;

    if (status !== "live" && status !== "planned") {
      if (status !== "cancelled" && status !== "completed") {
        hasMalformedCurrentCandidate = true;
      }
      continue;
    }

    if (!isHomeScheduleCandidate(stream)) {
      hasMalformedCurrentCandidate = true;
      continue;
    }

    if (stream.status === "live") {
      liveStream = chooseEarlierStream(liveStream, stream);
    }
    if (stream.status === "planned") {
      plannedStream = chooseEarlierStream(plannedStream, stream);
    }
  }

  const stream = liveStream ?? plannedStream ?? null;

  if (!stream) {
    return { status: hasMalformedCurrentCandidate ? "unavailable" : "empty" };
  }

  const gameFocus = getGameFocus(stream.gameLinks);

  return {
    status: stream.status,
    title: stream.title.trim(),
    timeLabel: formatScheduleDate(stream.startsAt),
    ...(gameFocus ? { gameFocus } : {})
  };
};
