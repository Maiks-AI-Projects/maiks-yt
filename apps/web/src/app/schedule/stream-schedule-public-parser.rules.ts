import { gamePlatformLabelMaxLength, gameTitleMaxLength } from "@maiks-yt/domain/games";
import { projectAdminTitleMaxLength } from "@maiks-yt/domain/projects";
import type {
  PublicStreamScheduleEntry,
  PublicStreamScheduleGameLink,
  PublicStreamScheduleStatus,
  StreamScheduleCancellationReasonCode,
  StreamScheduleGameLinkRelationship
} from "@maiks-yt/domain/schedule";
import {
  streamScheduleCancellationReasonCodes,
  streamScheduleCancellationReasonMaxLength,
  streamScheduleDescriptionMaxLength,
  streamScheduleFocusLabelMaxLength,
  streamScheduleFocusNoteMaxLength,
  streamScheduleGameLinkMaxCount,
  streamScheduleGameLinkRelationships,
  streamScheduleGamePublicNoteMaxLength,
  streamScheduleTitleMaxLength
} from "@maiks-yt/domain/schedule";

type StreamScheduleFailureReason = "stream_schedule_unavailable";

type StreamScheduleApiResponse =
  | { ok: true; streams: readonly PublicStreamScheduleEntry[] }
  | { ok: false; reason: StreamScheduleFailureReason };

const publicScheduleStatuses = new Set<PublicStreamScheduleStatus>(["planned", "live", "cancelled"]);
const publicScheduleFailureReasons = new Set<StreamScheduleFailureReason>(["stream_schedule_unavailable"]);
const scheduleKeyPattern = /^[a-z0-9][a-z0-9-]{0,79}$/;
const scheduleSlugPattern = /^[a-z0-9][a-z0-9-]{0,190}$/;
const scheduleEntryKeys = [
  "title", "description", "startsAt", "endsAt", "channelKey", "topicKey",
  "focusLabel", "focusNote", "focusProject", "gameLinks", "status",
  "cancellationReasonCode", "cancellationReason"
] as const;
const scheduleFocusProjectKeys = ["slug", "title"] as const;
const scheduleGameLinkKeys = ["slug", "title", "platformLabel", "relationship", "publicNote"] as const;

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
const isIsoDateString = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
};
const isOptionalIsoDateStringOrNull = (value: unknown): value is string | null =>
  value === null || isIsoDateString(value);
const isScheduleKey = (value: unknown): value is string =>
  typeof value === "string" && scheduleKeyPattern.test(value);
const isOptionalScheduleKeyOrNull = (value: unknown): value is string | null =>
  value === null || isScheduleKey(value);
const isNormalizedSlug = (value: unknown): value is string =>
  typeof value === "string" && scheduleSlugPattern.test(value);
const isPublicScheduleStatus = (value: unknown): value is PublicStreamScheduleStatus =>
  typeof value === "string" && publicScheduleStatuses.has(value as PublicStreamScheduleStatus);
const isCancellationReasonCode = (value: unknown): value is StreamScheduleCancellationReasonCode =>
  typeof value === "string"
  && streamScheduleCancellationReasonCodes.includes(value as StreamScheduleCancellationReasonCode);
const isGameLinkRelationship = (value: unknown): value is StreamScheduleGameLinkRelationship =>
  typeof value === "string"
  && streamScheduleGameLinkRelationships.includes(value as StreamScheduleGameLinkRelationship);
const isFailureReason = (value: unknown): value is StreamScheduleFailureReason =>
  typeof value === "string" && publicScheduleFailureReasons.has(value as StreamScheduleFailureReason);

const parseFocusProject = (value: unknown): PublicStreamScheduleEntry["focusProject"] | null => {
  if (value === null) return null;
  if (!isRecord(value)
    || !hasOnlyKeys(value, scheduleFocusProjectKeys)
    || !hasRequiredKeys(value, scheduleFocusProjectKeys)
    || !isNormalizedSlug(value.slug)
    || !isBoundedNonEmptyString(value.title, projectAdminTitleMaxLength)) return null;
  return { slug: value.slug, title: value.title };
};

const parseGameLink = (value: unknown): PublicStreamScheduleGameLink | null => {
  if (!isRecord(value)
    || !hasOnlyKeys(value, scheduleGameLinkKeys)
    || !hasRequiredKeys(value, scheduleGameLinkKeys)
    || !isNormalizedSlug(value.slug)
    || !isBoundedNonEmptyString(value.title, gameTitleMaxLength)
    || !isBoundedStringOrNull(value.platformLabel, gamePlatformLabelMaxLength)
    || !isGameLinkRelationship(value.relationship)
    || !isBoundedStringOrNull(value.publicNote, streamScheduleGamePublicNoteMaxLength)) return null;
  return {
    slug: value.slug,
    title: value.title,
    platformLabel: value.platformLabel,
    relationship: value.relationship,
    publicNote: value.publicNote
  };
};

const hasValidCancellationState = (value: Record<string, unknown>): boolean =>
  value.status === "cancelled"
    ? isCancellationReasonCode(value.cancellationReasonCode)
      && isBoundedNonEmptyString(value.cancellationReason, streamScheduleCancellationReasonMaxLength)
    : value.cancellationReasonCode === null && value.cancellationReason === null;

const parseEntry = (value: unknown): PublicStreamScheduleEntry | null => {
  if (!isRecord(value)
    || !hasOnlyKeys(value, scheduleEntryKeys)
    || !hasRequiredKeys(value, scheduleEntryKeys)
    || !isBoundedNonEmptyString(value.title, streamScheduleTitleMaxLength)
    || !isBoundedStringOrNull(value.description, streamScheduleDescriptionMaxLength)
    || !isIsoDateString(value.startsAt)
    || !isOptionalIsoDateStringOrNull(value.endsAt)
    || !isScheduleKey(value.channelKey)
    || !isOptionalScheduleKeyOrNull(value.topicKey)
    || !isBoundedStringOrNull(value.focusLabel, streamScheduleFocusLabelMaxLength)
    || !isBoundedStringOrNull(value.focusNote, streamScheduleFocusNoteMaxLength)
    || !Array.isArray(value.gameLinks)
    || value.gameLinks.length > streamScheduleGameLinkMaxCount
    || !isPublicScheduleStatus(value.status)
    || !hasValidCancellationState(value)) return null;

  const focusProject = parseFocusProject(value.focusProject);
  const gameLinks = value.gameLinks.map(parseGameLink);
  if ((value.focusProject !== null && !focusProject)
    || (focusProject === null && (value.focusLabel !== null || value.focusNote !== null))
    || (value.endsAt !== null && Date.parse(value.endsAt) <= Date.parse(value.startsAt))
    || gameLinks.some((gameLink) => gameLink === null)) return null;

  return {
    title: value.title,
    description: value.description,
    startsAt: value.startsAt,
    endsAt: value.endsAt,
    channelKey: value.channelKey,
    topicKey: value.topicKey,
    focusLabel: value.focusLabel,
    focusNote: value.focusNote,
    focusProject,
    gameLinks: gameLinks as PublicStreamScheduleGameLink[],
    status: value.status,
    cancellationReasonCode: value.cancellationReasonCode as StreamScheduleCancellationReasonCode | null,
    cancellationReason: value.cancellationReason as string | null
  };
};

export const parseStreamScheduleApiResponse = (value: unknown): StreamScheduleApiResponse | null => {
  if (!isRecord(value) || !hasOnlyKeys(value, ["ok", "streams", "reason"])) return null;
  if (value.ok === false) {
    return hasOnlyKeys(value, ["ok", "reason"]) && isFailureReason(value.reason)
      ? { ok: false, reason: value.reason }
      : null;
  }
  if (value.ok !== true || !hasOnlyKeys(value, ["ok", "streams"]) || !Array.isArray(value.streams)) return null;
  const streams = value.streams.map(parseEntry);
  return streams.some((stream) => stream === null)
    ? null
    : { ok: true, streams: streams as PublicStreamScheduleEntry[] };
};
