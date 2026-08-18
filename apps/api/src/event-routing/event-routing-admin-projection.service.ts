import { getEventRegistryEntry } from "@maiks-yt/domain/events";

import type {
  EventRoutingAdminApprovalRecord,
  EventRoutingAdminApprovalRepositoryRecord,
  EventRoutingAdminOperationalHistoryRecord,
  EventRoutingAdminSafeContext,
  EventRoutingApprovalReviewPlayback,
  EventRoutingOperationalHistoryRepositoryRecord
} from "./event-routing-admin.types.js";

const compactText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  return normalized.length > 0 ? normalized.slice(0, maxLength) : null;
};

const compactAmount = (value: unknown): number | string | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return compactText(value, 64);
};

export const buildEventRoutingAdminSafeContext = (input: {
  redactedPayload: Record<string, unknown>;
  actorDisplayName?: string | null;
}): EventRoutingAdminSafeContext => ({
  displayText: compactText(input.redactedPayload.displayText, 280),
  displayName: compactText(
    input.redactedPayload.displayName ?? input.actorDisplayName,
    191
  ),
  title: compactText(input.redactedPayload.title, 191),
  projectLabel: compactText(input.redactedPayload.projectLabel, 191),
  amount: compactAmount(input.redactedPayload.amount),
  currency: compactText(input.redactedPayload.currency, 12)
});

export const projectEventRoutingAdminApproval = (
  approval: EventRoutingAdminApprovalRepositoryRecord,
  playback: EventRoutingApprovalReviewPlayback | null
): EventRoutingAdminApprovalRecord => {
  const entry = getEventRegistryEntry(approval.event.eventKind);

  return {
    id: approval.id,
    productionEvent: !approval.event.isTest
      && !approval.event.isSimulated
      && !approval.event.testResettable,
    destination: approval.destination,
    status: approval.status,
    reviewedAt: approval.reviewedAt,
    reviewNote: approval.reviewNote,
    createdAt: approval.createdAt,
    updatedAt: approval.updatedAt,
    event: {
      sourcePlatform: approval.event.sourcePlatform,
      eventKind: approval.event.eventKind,
      occurredAt: approval.event.occurredAt,
      context: buildEventRoutingAdminSafeContext({
        redactedPayload: approval.event.redactedPayload,
        actorDisplayName: approval.event.actorDisplayName
      })
    },
    rule: approval.rule,
    label: entry.label,
    description: entry.description,
    safety: entry.safety,
    playback
  };
};

export const projectEventRoutingOperationalHistory = (
  history: EventRoutingOperationalHistoryRepositoryRecord
): EventRoutingAdminOperationalHistoryRecord => ({
  sourcePlatform: history.sourcePlatform,
  eventKind: history.eventKind,
  label: getEventRegistryEntry(history.eventKind).label,
  destination: history.destination,
  routingOutcome: history.routingOutcome,
  occurredAt: history.occurredAt,
  context: buildEventRoutingAdminSafeContext({
    redactedPayload: history.redactedPayload,
    actorDisplayName: history.actorDisplayName
  })
});
