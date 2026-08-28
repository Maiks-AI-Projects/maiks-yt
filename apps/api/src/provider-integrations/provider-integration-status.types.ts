import type {
  ProviderIntegrationEnvironment,
  TwitchChatReplyReadinessStatus,
  ProviderIntegrationRuntimeState,
  ProviderIntegrationStatusSnapshot
} from "@maiks-yt/integrations";

export type ProviderIntegrationStatusActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type ProviderIntegrationStatusBrowserDto = ProviderIntegrationStatusSnapshot;

export type ProviderIntegrationStatusFailureReason =
  | "not_authenticated"
  | "provider_integrations_unavailable"
  | "provider_integrations_user_unlinked"
  | "provider_integrations_forbidden";

export type ProviderIntegrationStatusServiceFailureReason = Extract<
  ProviderIntegrationStatusFailureReason,
  "provider_integrations_user_unlinked" | "provider_integrations_forbidden"
>;

export type ProviderIntegrationStatusResult =
  | ProviderIntegrationStatusBrowserDto
  | {
    ok: false;
    reason: ProviderIntegrationStatusServiceFailureReason;
  };

export interface ProviderIntegrationStatusRepository {
  resolveActor(authUserId: string): Promise<ProviderIntegrationStatusActor | null>;
}

export type ProviderIntegrationStatusOptions = {
  env?: ProviderIntegrationEnvironment;
  now?: () => Date;
  twitchChatReplyReadinessCacheNow?: () => number;
  twitchChatReplyReadinessCacheTtlMs?: number;
  runtimeState?: () => ProviderIntegrationRuntimeState;
  validateTwitchChatReplyReadiness?: (
    env: ProviderIntegrationEnvironment
  ) => Promise<TwitchChatReplyReadinessStatus>;
};
