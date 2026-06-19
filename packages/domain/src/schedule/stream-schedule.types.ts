export const streamScheduleVisibilities = ["draft", "public", "private"] as const;
export const streamScheduleStatuses = ["planned", "live", "completed", "cancelled"] as const;
export const streamScheduleCancellationReasonCodes = [
  "health",
  "family",
  "energy",
  "technical",
  "schedule-conflict",
  "other"
] as const;

export type StreamScheduleVisibility = typeof streamScheduleVisibilities[number];
export type StreamScheduleStatus = typeof streamScheduleStatuses[number];
export type StreamScheduleCancellationReasonCode = typeof streamScheduleCancellationReasonCodes[number];

export type StreamScheduleEntry = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  channelKey: string;
  topicKey: string | null;
  themeKey: string | null;
  visibility: StreamScheduleVisibility;
  status: StreamScheduleStatus;
  cancellationReasonCode: StreamScheduleCancellationReasonCode | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StreamScheduleInput = {
  title: string;
  description?: string | null | undefined;
  startsAt: string;
  endsAt?: string | null | undefined;
  channelKey: string;
  topicKey?: string | null | undefined;
  themeKey?: string | null | undefined;
  visibility: StreamScheduleVisibility;
  status: StreamScheduleStatus;
  cancellationReasonCode?: StreamScheduleCancellationReasonCode | null | undefined;
  cancellationReason?: string | null | undefined;
};

export type StreamScheduleUpdateInput = {
  title?: string | undefined;
  description?: string | null | undefined;
  startsAt?: string | undefined;
  endsAt?: string | null | undefined;
  channelKey?: string | undefined;
  topicKey?: string | null | undefined;
  themeKey?: string | null | undefined;
  visibility?: StreamScheduleVisibility | undefined;
  status?: StreamScheduleStatus | undefined;
  cancellationReasonCode?: StreamScheduleCancellationReasonCode | null | undefined;
  cancellationReason?: string | null | undefined;
};

export type StreamScheduleCancellationInput = {
  cancellationReasonCode: StreamScheduleCancellationReasonCode;
  cancellationReason: string;
};
