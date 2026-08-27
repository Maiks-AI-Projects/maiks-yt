import type {
  StreamScheduleCancellationReasonCode,
  StreamScheduleEntry
} from "@maiks-yt/domain/schedule";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.maiks.yt";

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
    status: "error";
    streams: readonly [];
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

export const getPublicStreamSchedule = async (): Promise<StreamScheduleLoadResult> => {
  try {
    const response = await fetch(`${apiBaseUrl}/schedule`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return { status: "error", streams: [] };
    }

    const payload = await response.json() as StreamScheduleApiResponse;

    return payload.ok
      ? { status: "loaded", streams: payload.streams }
      : { status: "error", streams: [] };
  } catch {
    return { status: "error", streams: [] };
  }
};
