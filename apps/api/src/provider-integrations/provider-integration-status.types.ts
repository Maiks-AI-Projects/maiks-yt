import type {
  ProviderIntegrationEnvironment,
  ProviderIntegrationRuntimeState,
  ProviderIntegrationStatusSnapshot
} from "@maiks-yt/integrations";

export type ProviderIntegrationStatusActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type ProviderIntegrationStatusResult =
  | ProviderIntegrationStatusSnapshot
  | {
    ok: false;
    reason: "provider_integrations_user_unlinked" | "provider_integrations_forbidden";
  };

export interface ProviderIntegrationStatusRepository {
  resolveActor(authUserId: string): Promise<ProviderIntegrationStatusActor | null>;
}

export type ProviderIntegrationStatusOptions = {
  env?: ProviderIntegrationEnvironment;
  now?: () => Date;
  runtimeState?: () => ProviderIntegrationRuntimeState;
};
