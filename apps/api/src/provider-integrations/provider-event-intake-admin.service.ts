import { reviewProviderIntakeForInternalEventRouting } from "@maiks-yt/domain/events";

import { normalizeProviderIntegrationPermissions } from "./provider-integration-status.service.js";
import type {
  NormalizedProviderEventIntakeAdminFilters,
  ProviderEventIntakeAdminActor,
  ProviderEventIntakeAdminBrowserRow,
  ProviderEventIntakeAdminFilters,
  ProviderEventIntakeAdminRow,
  ProviderEventIntakeAdminRepository,
  ProviderEventIntakeAdminResult,
  ProviderEventIntakeHealthEntry,
  ProviderEventIntakeHealthMechanism,
  ProviderEventIntakeHealthResult,
  ProviderEventIntakeHealthRow,
  ProviderEventIntakeReviewAction,
  ProviderEventIntakeReviewResult
} from "./provider-event-intake-admin.types.js";
import {
  createProviderEventIntakeReviewRef,
  getProviderEventIntakeReviewRefSecret,
  parseProviderEventIntakeReviewRef
} from "./provider-event-intake-admin-review-ref.service.js";

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

const providerLabels = {
  discord: "Discord",
  twitch: "Twitch",
  youtube: "YouTube"
} satisfies Record<ProviderEventIntakeAdminRow["provider"], string>;

const compactText = (value: string | null, fallback: string, maxLength = 96): string => {
  const compacted = value?.replace(/\s+/g, " ").trim() ?? "";
  const display = compacted.length > 0 ? compacted : fallback;

  return display.length > maxLength ? `${display.slice(0, maxLength - 1)}...` : display;
};

const isReviewed = (row: ProviderEventIntakeAdminRow): boolean =>
  Boolean(row.eventHistoryId)
  || row.processingStatus === "mapped_to_event_history"
  || row.processingStatus === "ignored";

const projectBrowserRow = ({
  actor,
  authUserId,
  row,
  secret
}: {
  actor: ProviderEventIntakeAdminActor;
  authUserId: string;
  row: ProviderEventIntakeAdminRow;
  secret: string;
}): ProviderEventIntakeAdminBrowserRow => {
  const eventName = compactText(row.providerEventName, "provider event", 120);
  const actorLabel = compactText(row.actorDisplayName, "unknown actor", 80);

  return {
    catalogKnown: row.catalogKnown,
    category: row.category,
    internalTrigger: compactText(row.internalTrigger, "provider.unknown", 140),
    mechanism: row.mechanism,
    occurredAt: row.occurredAt,
    overlayEligibleByDefault: false,
    processingStatus: row.processingStatus,
    provider: row.provider,
    providerEventName: eventName,
    receivedAt: row.receivedAt,
    reviewRef: createProviderEventIntakeReviewRef({
      authUserId,
      domainUserId: actor.domainUserId,
      rowId: row.id,
      secret
    }),
    reviewable: !isReviewed(row),
    safeSummary: compactText(`${providerLabels[row.provider]} ${eventName} from ${actorLabel}`, "Provider event", 180),
    safetyFlags: {
      authOrTokenShaped: row.authOrTokenShaped,
      highVolume: row.highVolume,
      moderationShaped: row.moderationShaped,
      moneyShaped: row.moneyShaped
    }
  };
};

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
  public constructor(
    private readonly repository: ProviderEventIntakeAdminRepository,
    private readonly options: { reviewRefSecret?: string | null } = {}
  ) {}

  private getReviewRefSecret(): string {
    const secret = this.options.reviewRefSecret ?? getProviderEventIntakeReviewRefSecret();

    if (!secret) {
      throw new Error("Provider event intake review references are unavailable.");
    }

    return secret;
  }

  private resolveReviewRowId(input: {
    actor: ProviderEventIntakeAdminActor;
    authUserId: string;
    reviewRef: string;
  }): string | null {
    const payload = parseProviderEventIntakeReviewRef({
      reviewRef: input.reviewRef,
      secret: this.getReviewRefSecret()
    });

    if (!payload || payload.authUserId !== input.authUserId || payload.domainUserId !== input.actor.domainUserId) {
      return null;
    }

    return payload.rowId;
  }

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
      rows: (await this.repository.listRecent(filters)).map((row) => projectBrowserRow({
        actor,
        authUserId: input.authUserId,
        row,
        secret: this.getReviewRefSecret()
      }))
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
    reviewRef: string;
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

    const rowId = this.resolveReviewRowId({
      actor,
      authUserId: input.authUserId,
      reviewRef: input.reviewRef
    });

    if (!rowId) {
      return {
        ok: false,
        reason: "provider_event_intake_not_found"
      };
    }

    const row = await this.repository.findReviewCandidate(rowId);

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
          ok: true,
          processingStatus: "ignored",
          publicPlayback: false
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
      ok: true,
      processingStatus: "mapped_to_event_history",
      publicPlayback: false
    };
  }
}
