import type { EventKind, EventSourcePlatform } from "./event-registry.types.js";
import type {
  ProviderEventCategory,
  ProviderEventPlatform
} from "./provider-event-catalog.types.js";

export type ProviderIntakeEventRoutingReviewInput = {
  provider: ProviderEventPlatform;
  providerEventName: string;
  internalTrigger: string;
  category: ProviderEventCategory;
  catalogKnown: boolean;
  moneyShaped: boolean;
  moderationShaped: boolean;
  authOrTokenShaped: boolean;
  highVolume: boolean;
};

export type ProviderIntakeEventRoutingReviewCandidate = {
  sourcePlatform: EventSourcePlatform;
  eventKind: EventKind;
  destination: "internal_audit";
  routingOutcome: "stored_internal";
  publicRoutingAllowed: false;
  reason: "provider_intake_review_internal_only";
};

export type ProviderIntakeEventRoutingReviewRejection =
  | "provider_intake_review_unknown_catalog_event"
  | "provider_intake_review_auth_or_token_shaped"
  | "provider_intake_review_high_volume"
  | "provider_intake_review_no_event_kind_mapping";

export type ProviderIntakeEventRoutingReviewResult =
  | {
    ok: true;
    candidate: ProviderIntakeEventRoutingReviewCandidate;
  }
  | {
    ok: false;
    reason: ProviderIntakeEventRoutingReviewRejection;
  };
