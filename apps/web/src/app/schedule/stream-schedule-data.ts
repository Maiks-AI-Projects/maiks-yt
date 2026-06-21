import type {
  StreamScheduleCancellationReasonCode,
  StreamScheduleEntry
} from "@maiks-yt/domain/schedule";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

type StreamScheduleApiResponse =
  | {
    ok: true;
    streams: readonly StreamScheduleEntry[];
  }
  | {
    ok: false;
    reason: string;
  };

export type StreamScheduleLoadResult =
  | {
    status: "loaded";
    streams: readonly StreamScheduleEntry[];
  }
  | {
    status: "fallback";
    streams: readonly StreamScheduleEntry[];
  };

export const cancellationReasonLabels = {
  health: "Health",
  family: "Family",
  energy: "Energy",
  technical: "Technical",
  "schedule-conflict": "Schedule conflict",
  other: "Other"
} satisfies Record<StreamScheduleCancellationReasonCode, string>;

export const formatScheduleLabel = (value: string): string =>
  value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const formatScheduleDate = (value: string): string =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam"
  }).format(new Date(value));

export const fallbackScheduleStreams = [
  {
    id: "fallback-build-stream",
    title: "Maiks.yt V2 build stream",
    description: "Fallback schedule entry shown while the dev API or database migration is unavailable.",
    startsAt: "2026-06-20T18:00:00.000Z",
    endsAt: "2026-06-20T20:00:00.000Z",
    channelKey: "coding",
    topicKey: "maiks-yt",
    themeKey: "default",
    projectId: null,
    focusLabel: null,
    focusNote: null,
    focusProject: null,
    visibility: "public",
    status: "planned",
    cancellationReasonCode: null,
    cancellationReason: null,
    createdAt: "2026-06-19T12:00:00.000Z",
    updatedAt: "2026-06-19T12:00:00.000Z"
  },
  {
    id: "fallback-cancelled-layout",
    title: "Late night layout polish",
    description: "Fallback cancelled entry so cancellation wording remains inspectable.",
    startsAt: "2026-06-21T20:00:00.000Z",
    endsAt: "2026-06-21T21:30:00.000Z",
    channelKey: "coding",
    topicKey: "overlays",
    themeKey: "default",
    projectId: null,
    focusLabel: null,
    focusNote: null,
    focusProject: null,
    visibility: "public",
    status: "cancelled",
    cancellationReasonCode: "energy",
    cancellationReason: "I need to save energy and will pick this up another day.",
    createdAt: "2026-06-19T12:00:00.000Z",
    updatedAt: "2026-06-19T12:00:00.000Z"
  }
] satisfies readonly StreamScheduleEntry[];

export const getPublicStreamSchedule = async (): Promise<StreamScheduleLoadResult> => {
  try {
    const response = await fetch(`${apiBaseUrl}/schedule`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return {
        status: "fallback",
        streams: fallbackScheduleStreams
      };
    }

    const payload = await response.json() as StreamScheduleApiResponse;

    if (!payload.ok) {
      return {
        status: "fallback",
        streams: fallbackScheduleStreams
      };
    }

    return {
      status: "loaded",
      streams: payload.streams
    };
  } catch {
    return {
      status: "fallback",
      streams: fallbackScheduleStreams
    };
  }
};
