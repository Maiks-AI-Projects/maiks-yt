import type {
  EventKind,
  ProviderEventCategory,
  ProviderEventMechanism,
  ProviderEventPlatform,
  ProviderIntakeEventRoutingReviewRejection
} from "@maiks-yt/domain/events";

export type ProviderEventIntakeAdminActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type ProviderEventIntakeAdminFilters = {
  authOrTokenShaped?: boolean | null;
  catalogKnown?: boolean | null;
  highVolume?: boolean | null;
  limit?: number;
  moderationShaped?: boolean | null;
  moneyShaped?: boolean | null;
  processingStatus?: ProviderEventIntakeProcessingStatus | "any";
  provider?: ProviderEventPlatform | "any";
};

export type NormalizedProviderEventIntakeAdminFilters = {
  authOrTokenShaped: boolean | null;
  catalogKnown: boolean | null;
  highVolume: boolean | null;
  limit: number;
  moderationShaped: boolean | null;
  moneyShaped: boolean | null;
  processingStatus: ProviderEventIntakeProcessingStatus | "any";
  provider: ProviderEventPlatform | "any";
};

export type ProviderEventIntakeProcessingStatus =
  | "stored"
  | "normalized"
  | "mapped_to_event_history"
  | "ignored"
  | "failed";

export type ProviderEventIntakeAdminRow = {
  id: string;
  provider: ProviderEventPlatform;
  mechanism: ProviderEventMechanism;
  providerEventName: string;
  internalTrigger: string;
  category: ProviderEventCategory;
  sourceEventId: string | null;
  providerChannelId: string | null;
  providerMessageId: string | null;
  actorExternalId: string | null;
  actorDisplayName: string | null;
  catalogKnown: boolean;
  moneyShaped: boolean;
  moderationShaped: boolean;
  authOrTokenShaped: boolean;
  highVolume: boolean;
  overlayEligibleByDefault: false;
  processingStatus: ProviderEventIntakeProcessingStatus;
  eventHistoryId: string | null;
  redactedPayloadPreview: Record<string, unknown>;
  occurredAt: string | null;
  receivedAt: string;
};

export type ProviderEventIntakeReviewAction = "map_internal" | "ignore";

export type ProviderEventIntakeReviewCandidate = ProviderEventIntakeAdminRow & {
  redactedPayloadPreview: Record<string, unknown>;
};

export type ProviderEventIntakeReviewHistory = {
  id: string;
  eventKind: EventKind;
  sourcePlatform: ProviderEventPlatform;
  routingOutcome: "stored_internal";
  destination: "internal_audit";
  publicPlayback: false;
  createdAt: string;
};

export type ProviderEventIntakeHealthStatus = "healthy" | "stale" | "missing";

export type ProviderEventIntakeHealthMechanism = {
  provider: ProviderEventPlatform;
  mechanism: ProviderEventMechanism;
  label: string;
};

export type ProviderEventIntakeHealthRow = {
  provider: ProviderEventPlatform;
  mechanism: ProviderEventMechanism;
  lastProviderEventName: string | null;
  lastReceivedAt: string | null;
  rowCount: number;
};

export type ProviderEventIntakeHealthEntry = ProviderEventIntakeHealthMechanism & {
  lastProviderEventName: string | null;
  lastReceivedAt: string | null;
  rowCount: number;
  status: ProviderEventIntakeHealthStatus;
};

export type ProviderEventIntakeAdminRepository = {
  findReviewCandidate(id: string): Promise<ProviderEventIntakeReviewCandidate | null>;
  listHealthRows(): Promise<ProviderEventIntakeHealthRow[]>;
  listRecent(filters: NormalizedProviderEventIntakeAdminFilters): Promise<ProviderEventIntakeAdminRow[]>;
  markIgnored(input: { id: string }): Promise<boolean>;
  mapToEventHistory(input: {
    row: ProviderEventIntakeReviewCandidate;
    eventKind: EventKind;
    reviewedByUserId: string;
  }): Promise<ProviderEventIntakeReviewHistory | null>;
  resolveActor(authUserId: string): Promise<ProviderEventIntakeAdminActor | null>;
};

export type ProviderEventIntakeAdminResult =
  | {
    ok: true;
    readOnly: true;
    filters: NormalizedProviderEventIntakeAdminFilters;
    rows: ProviderEventIntakeAdminRow[];
  }
  | {
    ok: false;
    reason: "provider_event_intake_user_unlinked" | "provider_event_intake_forbidden";
  };

export type ProviderEventIntakeHealthResult =
  | {
    ok: true;
    readOnly: true;
    generatedAt: string;
    staleAfterMinutes: number;
    entries: ProviderEventIntakeHealthEntry[];
  }
  | {
    ok: false;
    reason: "provider_event_intake_user_unlinked" | "provider_event_intake_forbidden";
  };

export type ProviderEventIntakeReviewResult =
  | {
    ok: true;
    action: ProviderEventIntakeReviewAction;
    rowId: string;
    processingStatus: "ignored" | "mapped_to_event_history";
    eventHistory: ProviderEventIntakeReviewHistory | null;
    publicPlayback: false;
  }
  | {
    ok: false;
    reason:
      | "provider_event_intake_user_unlinked"
      | "provider_event_intake_forbidden"
      | "provider_event_intake_not_found"
      | "provider_event_intake_already_reviewed"
      | "provider_event_intake_review_unavailable"
      | ProviderIntakeEventRoutingReviewRejection;
  };
