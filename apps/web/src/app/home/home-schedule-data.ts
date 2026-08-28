import type { StreamScheduleEntry } from "@maiks-yt/domain/schedule";

import type { StreamScheduleLoadResult } from "../schedule/stream-schedule-data";
import { formatScheduleDate } from "../schedule/stream-schedule-data";

export type HomeScheduleSlot =
  | {
    status: "live" | "planned";
    title: string;
    timeLabel: string;
  }
  | {
    status: "empty" | "unavailable";
  };

type HomeScheduleCandidate = Pick<StreamScheduleEntry, "startsAt" | "title"> & {
  status: "live" | "planned";
};

const isValidDateString = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isHomeScheduleCandidate = (
  stream: unknown
): stream is HomeScheduleCandidate => isRecord(stream)
  && typeof stream.title === "string"
  && stream.title.trim().length > 0
  && isValidDateString(stream.startsAt)
  && (stream.status === "live" || stream.status === "planned");

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

  return {
    status: stream.status,
    title: stream.title.trim(),
    timeLabel: formatScheduleDate(stream.startsAt)
  };
};
