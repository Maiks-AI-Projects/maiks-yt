import {
  type PublicStreamScheduleEntry,
  type PublicStreamScheduleGameLink,
  streamScheduleGameLinkRelationships
} from "@maiks-yt/domain/schedule";

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

type HomeScheduleCandidate = Pick<PublicStreamScheduleEntry, "startsAt" | "title"> & {
  status: "live" | "planned";
  gameLinks?: unknown;
};

const gameFocusTitleMaxLength = 96;
const gameFocusPlatformMaxLength = 64;
const gameSlugPattern = /^[a-z0-9][a-z0-9-]{0,190}$/;
const scheduleGameLinkKeys = ["slug", "title", "platformLabel", "relationship", "publicNote"] as const;

const isValidDateString = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, allowedKeys: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowedKeys.includes(key));

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isHomeScheduleCandidate = (
  stream: unknown
): stream is HomeScheduleCandidate => isRecord(stream)
  && isNonEmptyString(stream.title)
  && isValidDateString(stream.startsAt)
  && (stream.status === "live" || stream.status === "planned");

const isScheduleGameLink = (gameLink: unknown): gameLink is PublicStreamScheduleGameLink =>
  isRecord(gameLink)
  && hasOnlyKeys(gameLink, scheduleGameLinkKeys)
  && typeof gameLink.slug === "string"
  && gameSlugPattern.test(gameLink.slug)
  && isNonEmptyString(gameLink.title)
  && (gameLink.platformLabel === null || isNonEmptyString(gameLink.platformLabel))
  && (gameLink.publicNote === null || typeof gameLink.publicNote === "string")
  && typeof gameLink.relationship === "string"
  && streamScheduleGameLinkRelationships.includes(gameLink.relationship as PublicStreamScheduleGameLink["relationship"]);

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
