import type {
  StreamScheduleCancellationInput,
  StreamScheduleInput,
  StreamScheduleUpdateInput
} from "./stream-schedule.types.js";
import {
  streamScheduleCancellationReasonCodes,
  streamScheduleStatuses,
  streamScheduleVisibilities
} from "./stream-schedule.types.js";

export const streamScheduleTitleMaxLength = 191;
export const streamScheduleDescriptionMaxLength = 2_000;
export const streamScheduleKeyMaxLength = 80;
export const streamScheduleCancellationReasonMaxLength = 500;

const streamScheduleKeyPattern = /^[a-z0-9][a-z0-9-]{0,79}$/;

const isValidRequiredText = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;

const isValidOptionalText = (value: unknown, maxLength: number): boolean =>
  value === undefined
  || value === null
  || (typeof value === "string" && value.trim().length <= maxLength);

const isValidIsoDate = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

const isValidOptionalIsoDate = (value: unknown): boolean =>
  value === undefined || value === null || isValidIsoDate(value);

const isValidKey = (value: unknown): value is string =>
  typeof value === "string" && streamScheduleKeyPattern.test(value.trim());

const isValidOptionalKey = (value: unknown): boolean =>
  value === undefined || value === null || isValidKey(value);

const isValidWindow = (startsAt: string, endsAt?: string | null): boolean =>
  !endsAt || Date.parse(endsAt) > Date.parse(startsAt);

const hasValidCancellation = (
  input: Pick<StreamScheduleInput, "status" | "cancellationReasonCode" | "cancellationReason">
): boolean => {
  if (input.status !== "cancelled") {
    return (input.cancellationReasonCode ?? null) === null
      && (input.cancellationReason ?? null) === null;
  }

  return streamScheduleCancellationReasonCodes.includes(input.cancellationReasonCode as never)
    && isValidRequiredText(input.cancellationReason, streamScheduleCancellationReasonMaxLength);
};

export const isValidStreamScheduleInput = (input: StreamScheduleInput): boolean =>
  isValidRequiredText(input.title, streamScheduleTitleMaxLength)
  && isValidOptionalText(input.description, streamScheduleDescriptionMaxLength)
  && isValidIsoDate(input.startsAt)
  && isValidOptionalIsoDate(input.endsAt)
  && isValidWindow(input.startsAt, input.endsAt)
  && isValidKey(input.channelKey)
  && isValidOptionalKey(input.topicKey)
  && isValidOptionalKey(input.themeKey)
  && streamScheduleVisibilities.includes(input.visibility)
  && streamScheduleStatuses.includes(input.status)
  && hasValidCancellation(input);

export const isValidStreamScheduleUpdateInput = (input: StreamScheduleUpdateInput): boolean =>
  Object.keys(input).length > 0
  && (input.title === undefined || isValidRequiredText(input.title, streamScheduleTitleMaxLength))
  && isValidOptionalText(input.description, streamScheduleDescriptionMaxLength)
  && (input.startsAt === undefined || isValidIsoDate(input.startsAt))
  && isValidOptionalIsoDate(input.endsAt)
  && (input.channelKey === undefined || isValidKey(input.channelKey))
  && isValidOptionalKey(input.topicKey)
  && isValidOptionalKey(input.themeKey)
  && (input.visibility === undefined || streamScheduleVisibilities.includes(input.visibility))
  && (input.status === undefined || streamScheduleStatuses.includes(input.status))
  && (
    input.cancellationReasonCode === undefined
    || input.cancellationReasonCode === null
    || streamScheduleCancellationReasonCodes.includes(input.cancellationReasonCode)
  )
  && isValidOptionalText(input.cancellationReason, streamScheduleCancellationReasonMaxLength);

export const isValidStreamScheduleCancellationInput = (
  input: StreamScheduleCancellationInput
): boolean =>
  streamScheduleCancellationReasonCodes.includes(input.cancellationReasonCode)
  && isValidRequiredText(input.cancellationReason, streamScheduleCancellationReasonMaxLength);

export const canManageStreamSchedule = (capabilities: readonly unknown[]): boolean =>
  capabilities.some((capability) => capability === "*" || capability === "schedule:manage");

export const normalizeStreamScheduleInput = (input: StreamScheduleInput): StreamScheduleInput => ({
  ...input,
  title: input.title.trim(),
  description: input.description?.trim() || null,
  channelKey: input.channelKey.trim(),
  topicKey: input.topicKey?.trim() || null,
  themeKey: input.themeKey?.trim() || null,
  cancellationReasonCode: input.status === "cancelled" ? input.cancellationReasonCode ?? null : null,
  cancellationReason: input.status === "cancelled" ? input.cancellationReason?.trim() ?? "" : null
});

export const normalizeStreamScheduleUpdateInput = (
  input: StreamScheduleUpdateInput
): StreamScheduleUpdateInput => ({
  ...input,
  ...(input.title === undefined ? {} : { title: input.title.trim() }),
  ...(input.description === undefined ? {} : { description: input.description?.trim() || null }),
  ...(input.channelKey === undefined ? {} : { channelKey: input.channelKey.trim() }),
  ...(input.topicKey === undefined ? {} : { topicKey: input.topicKey?.trim() || null }),
  ...(input.themeKey === undefined ? {} : { themeKey: input.themeKey?.trim() || null }),
  ...(input.cancellationReason === undefined ? {} : { cancellationReason: input.cancellationReason?.trim() || null })
});
