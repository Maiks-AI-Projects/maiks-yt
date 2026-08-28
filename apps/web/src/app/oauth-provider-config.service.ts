import { providerDefinitions } from "./account/account-settings-data";
import type { OAuthProviderId } from "./account/account.types";

export type OAuthProvider = {
  readonly id: OAuthProviderId;
  readonly label: string;
};

const providerOrder = providerDefinitions.map((provider) => provider.id);

const providerLabels = new Map<OAuthProviderId, string>(
  providerDefinitions.map((provider) => [provider.id, `Continue with ${provider.label}`])
);

const isProviderConfigResponse = (
  value: unknown
): value is { ok: true; configuredProviderIds: readonly unknown[] } => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return record.ok === true && Array.isArray(record.configuredProviderIds);
};

export const projectConfiguredProviders = (value: unknown): readonly OAuthProvider[] => {
  if (!isProviderConfigResponse(value)) {
    return [];
  }

  const configuredProviderIds = new Set(value.configuredProviderIds);

  return providerOrder
    .filter((providerId) => configuredProviderIds.has(providerId))
    .map((providerId) => ({
      id: providerId,
      label: providerLabels.get(providerId) ?? `Continue with ${providerId}`
    }));
};
