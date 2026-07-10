import { reviewProviderIntakeForInternalEventRouting } from "@maiks-yt/domain/events";

import { normalizeProviderIntegrationPermissions } from "./provider-integration-status.service.js";
import type {
  NormalizedProviderEventIntakeAdminFilters,
  ProviderEventIntakeAdminActor,
  ProviderEventIntakeAdminFilters,
  ProviderEventIntakeAdminRepository,
  ProviderEventIntakeAdminResult,
  ProviderEventIntakeHealthEntry,
  ProviderEventIntakeHealthMechanism,
  ProviderEventIntakeHealthResult,
  ProviderEventIntakeHealthRow,
  ProviderEventIntakeReviewAction,
  ProviderEventIntakeReviewResult
} from "./provider-event-intake-admin.types.js";

const staleAfterMinutes = 60 * 24 * 7;

const trackedMechanisms = [
  { label: "Twitch EventSub", mechanism: "twitch-eventsub", provider: "twitch" },
  { label: "Twitch Chat", mechanism: "twitch-irc", provider: "twitch" },
  { label: "YouTube Live Chat", mechanism: "youtube-live-chat", provider: "youtube" },
  { label: "YouTube Activities", mechanism: "youtube-activity", provider: "youtube" },
  { label: "YouTube PubSub", mechanism: "youtube-pubsub", provider: "youtube" },
  { label: "Discord Gateway", mechanism: "discord-gateway", provider: "discord" },
  { label: "Discord Webhooks", mechanism: "discord-webhook", provider: "discord" }
] satisfies readonly ProviderEventIntakeHealthMechanism[];

const canViewProviderEventIntake = (actor: ProviderEventIntakeAdminActor): boolean =>
  normalizeProviderIntegrationPermissions(actor.rolePermissionValues).includes("*");

const normalizeFilters = (
  filters: ProviderEventIntakeAdminFilters = {}
): NormalizedProviderEventIntakeAdminFilters => ({
  authOrTokenShaped: filters.authOrTokenShaped ?? null,
  catalogKnown: filters.catalogKnown ?? null,
  highVolume: filters.highVolume ?? null,
  limit: Math.min(Math.max(filters.limit ?? 50, 1), 100),
  moderationShaped: filters.moderationShaped ?? null,
  moneyShaped: filters.moneyShaped ?? null,
  processingStatus: filters.processingStatus ?? "any",
  provider: filters.provider ?? "any"
});

const healthKey = (row: Pick<ProviderEventIntakeHealthRow, "mechanism" | "provider">): string =>
  `${row.provider}:${row.mechanism}`;

const projectHealth = (
  rows: readonly ProviderEventIntakeHealthRow[],
  now: Date
): ProviderEventIntakeHealthEntry[] => {
  const rowsByMechanism = new Map(rows.map((row) => [healthKey(row), row]));
  const staleAfterMs = staleAfterMinutes * 60 * 1000;

  return trackedMechanisms.map((mechanism) => {
    const row = rowsByMechanism.get(healthKey(mechanism));
    const lastReceivedAt = row?.lastReceivedAt ?? null;
    const lastReceivedMs = lastReceivedAt ? new Date(lastReceivedAt).getTime() : Number.NaN;
    const status = !row || !lastReceivedAt || Number.isNaN(lastReceivedMs)
      ? "missing"
      : now.getTime() - lastReceivedMs > staleAfterMs
        ? "stale"
        : "healthy";

    return {
      ...mechanism,
      lastProviderEventName: row?.lastProviderEventName ?? null,
      lastReceivedAt,
      rowCount: row?.rowCount ?? 0,
      status
    };
  });
};

export class ProviderEventIntakeAdminService {
  public constructor(private readonly repository: ProviderEventIntakeAdminRepository) {}

  public async listRecent(input: {
    authUserId: string;
    filters?: ProviderEventIntakeAdminFilters;
  }): Promise<ProviderEventIntakeAdminResult> {
    const actor = await this.repository.resolveActor(input.authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "provider_event_intake_user_unlinked"
      };
    }

    if (!canViewProviderEventIntake(actor)) {
      return {
        ok: false,
        reason: "provider_event_intake_forbidden"
      };
    }

    const filters = normalizeFilters(input.filters);

    return {
      filters,
      ok: true,
      readOnly: true,
      rows: await this.repository.listRecent(filters)
    };
  }

  public async getHealth(input: {
    authUserId: string;
    now?: Date;
  }): Promise<ProviderEventIntakeHealthResult> {
    const actor = await this.repository.resolveActor(input.authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "provider_event_intake_user_unlinked"
      };
    }

    if (!canViewProviderEventIntake(actor)) {
      return {
        ok: false,
        reason: "provider_event_intake_forbidden"
      };
    }

    const now = input.now ?? new Date();

    return {
      entries: projectHealth(await this.repository.listHealthRows(), now),
      generatedAt: now.toISOString(),
      ok: true,
      readOnly: true,
      staleAfterMinutes
    };
  }

  public async review(input: {
    action: ProviderEventIntakeReviewAction;
    authUserId: string;
    rowId: string;
  }): Promise<ProviderEventIntakeReviewResult> {
    const actor = await this.repository.resolveActor(input.authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "provider_event_intake_user_unlinked"
      };
    }

    if (!canViewProviderEventIntake(actor)) {
      return {
        ok: false,
        reason: "provider_event_intake_forbidden"
      };
    }

    const row = await this.repository.findReviewCandidate(input.rowId);

    if (!row) {
      return {
        ok: false,
        reason: "provider_event_intake_not_found"
      };
    }

    if (row.eventHistoryId || row.processingStatus === "mapped_to_event_history" || row.processingStatus === "ignored") {
      return {
        ok: false,
        reason: "provider_event_intake_already_reviewed"
      };
    }

    if (input.action === "ignore") {
      return await this.repository.markIgnored({ id: row.id })
        ? {
          action: "ignore",
          eventHistory: null,
          ok: true,
          processingStatus: "ignored",
          publicPlayback: false,
          rowId: row.id
        }
        : {
          ok: false,
          reason: "provider_event_intake_review_unavailable"
        };
    }

    const review = reviewProviderIntakeForInternalEventRouting(row);

    if (!review.ok) {
      return {
        ok: false,
        reason: review.reason
      };
    }

    const eventHistory = await this.repository.mapToEventHistory({
      eventKind: review.candidate.eventKind,
      reviewedByUserId: actor.domainUserId,
      row
    });

    if (!eventHistory) {
      return {
        ok: false,
        reason: "provider_event_intake_review_unavailable"
      };
    }

    return {
      action: "map_internal",
      eventHistory,
      ok: true,
      processingStatus: "mapped_to_event_history",
      publicPlayback: false,
      rowId: row.id
    };
  }
}
