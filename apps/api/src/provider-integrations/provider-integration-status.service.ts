import { getProviderIntegrationStatusSnapshot } from "@maiks-yt/integrations";

import type {
  ProviderIntegrationStatusActor,
  ProviderIntegrationStatusOptions,
  ProviderIntegrationStatusRepository,
  ProviderIntegrationStatusResult
} from "./provider-integration-status.types.js";

const parsePermissionArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const normalizeProviderIntegrationPermissions = (
  rolePermissionValues: readonly unknown[]
): string[] => {
  const permissions = new Set<string>();

  for (const rolePermissionValue of rolePermissionValues) {
    for (const permission of parsePermissionArray(rolePermissionValue)) {
      if (typeof permission === "string") {
        permissions.add(permission);
      }
    }
  }

  return [...permissions];
};

const canViewProviderIntegrations = (actor: ProviderIntegrationStatusActor): boolean =>
  normalizeProviderIntegrationPermissions(actor.rolePermissionValues).includes("*");

export class ProviderIntegrationStatusService {
  public constructor(
    private readonly repository: ProviderIntegrationStatusRepository,
    private readonly options: ProviderIntegrationStatusOptions = {}
  ) {}

  public async getStatus(input: { authUserId: string }): Promise<ProviderIntegrationStatusResult> {
    const actor = await this.repository.resolveActor(input.authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "provider_integrations_user_unlinked"
      };
    }

    if (!canViewProviderIntegrations(actor)) {
      return {
        ok: false,
        reason: "provider_integrations_forbidden"
      };
    }

    return getProviderIntegrationStatusSnapshot(
      this.options.env ?? process.env,
      this.options.now?.() ?? new Date(),
      this.options.runtimeState?.()
    );
  }
}
