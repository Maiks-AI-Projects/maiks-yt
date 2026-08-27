import type { EventKind } from "@maiks-yt/domain/events";

export type ProductionWebsiteEventKind = Exclude<EventKind, "simulated.support-money">;

export type WebsiteEventRoutingProductionInput = {
  eventKind: ProductionWebsiteEventKind;
  sourceEventId: string;
  actorUserId: string | null;
  actorExternalId: string | null;
  actorDisplayName: string | null;
  userId: string | null;
  streamSessionId: string | null;
  streamScheduleEntryId: string | null;
  sessionId: string | null;
  redactedPayload: Record<string, unknown>;
  occurredAt: Date;
  receivedAt: Date;
};

export type WebsiteEventRoutingProductionResult = {
  status:
    | "ignored"
    | "stored_internal"
    | "routed"
    | "queued_for_approval"
    | "blocked_safety"
    | "blocked_opt_out"
    | "blocked_cooldown";
  playbackEmitted: boolean;
};

export type WebsiteEventRoutingProductionPublisher = (
  event: WebsiteEventRoutingProductionInput
) => Promise<WebsiteEventRoutingProductionResult>;
