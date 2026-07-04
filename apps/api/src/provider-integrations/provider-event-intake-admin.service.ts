import { normalizeProviderIntegrationPermissions } from "./provider-integration-status.service.js";
import type {
  NormalizedProviderEventIntakeAdminFilters,
  ProviderEventIntakeAdminActor,
  ProviderEventIntakeAdminFilters,
  ProviderEventIntakeAdminRepository,
  ProviderEventIntakeAdminResult
} from "./provider-event-intake-admin.types.js";

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
}
