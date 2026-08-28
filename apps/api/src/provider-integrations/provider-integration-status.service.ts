import {
  getProviderIntegrationStatusSnapshot,
  validateTwitchChatReplyReadiness,
  type TwitchChatReplyReadinessStatus
} from "@maiks-yt/integrations";

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

const defaultTwitchChatReplyReadinessCacheTtlMs = 60_000;

export class ProviderIntegrationStatusService {
  private readonly env: NonNullable<ProviderIntegrationStatusOptions["env"]>;

  private twitchChatReplyReadinessCache: {
    expiresAt: number;
    status: TwitchChatReplyReadinessStatus;
  } | null = null;

  private twitchChatReplyReadinessInFlight: Promise<TwitchChatReplyReadinessStatus> | null = null;

  public constructor(
    private readonly repository: ProviderIntegrationStatusRepository,
    private readonly options: ProviderIntegrationStatusOptions = {}
  ) {
    this.env = Object.freeze({ ...(options.env ?? process.env) });
  }

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

    const twitchChatReplies = await this.resolveTwitchChatReplyReadiness();

    return getProviderIntegrationStatusSnapshot(
      this.env,
      this.options.now?.() ?? new Date(),
      this.options.runtimeState?.(),
      { twitchChatReplies }
    );
  }

  private async resolveTwitchChatReplyReadiness(): Promise<TwitchChatReplyReadinessStatus> {
    const cacheNow = this.options.twitchChatReplyReadinessCacheNow ?? Date.now;
    const now = cacheNow();
    const cachedReadiness = this.twitchChatReplyReadinessCache;

    if (cachedReadiness && cachedReadiness.expiresAt > now) {
      return cachedReadiness.status;
    }

    if (this.twitchChatReplyReadinessInFlight) {
      return this.twitchChatReplyReadinessInFlight;
    }

    const validation = this.runTwitchChatReplyReadinessValidation().then((status) => {
      const configuredTtl = this.options.twitchChatReplyReadinessCacheTtlMs
        ?? defaultTwitchChatReplyReadinessCacheTtlMs;
      const ttlMs = Number.isFinite(configuredTtl) ? Math.max(0, configuredTtl) : 0;

      this.twitchChatReplyReadinessCache = {
        expiresAt: cacheNow() + ttlMs,
        status
      };

      return status;
    });

    this.twitchChatReplyReadinessInFlight = validation;

    try {
      return await validation;
    } finally {
      if (this.twitchChatReplyReadinessInFlight === validation) {
        this.twitchChatReplyReadinessInFlight = null;
      }
    }
  }

  private async runTwitchChatReplyReadinessValidation(): Promise<TwitchChatReplyReadinessStatus> {
    try {
      return await (
        this.options.validateTwitchChatReplyReadiness?.(this.env)
        ?? validateTwitchChatReplyReadiness({ env: this.env })
      );
    } catch {
      return {
        issue: "validation_unavailable",
        state: "needs_attention"
      };
    }
  }
}
