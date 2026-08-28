import type {
  LoadState,
  ProviderCapabilityState,
  ProviderIntegrationStatusFailureReason,
  ProviderIntegrationReadiness,
  ProviderIntegrationsStatusResponse,
  ProviderRuntimeConnectionState,
  ProviderRuntimeStatus
} from "./provider-integrations-status.types";

export const readinessLabels: Record<ProviderIntegrationReadiness, string> = {
  ready: "Ready",
  needs_setup: "Needs setup",
  needs_attention: "Needs attention",
  disabled: "Disabled"
};

export const capabilityStateLabels: Record<ProviderCapabilityState, string> = {
  available: "Available",
  needs_setup: "Needs setup",
  needs_attention: "Needs attention",
  disabled: "Disabled"
};

const providerIds = ["twitch", "youtube", "discord"] as const;
const providerLabels = {
  twitch: "Twitch",
  youtube: "YouTube",
  discord: "Discord"
} as const;
const readinessStates = ["ready", "needs_setup", "needs_attention", "disabled"] as const;
const capabilityStates = ["available", "needs_setup", "needs_attention", "disabled"] as const;
const runtimeStates = ["connected", "connecting", "waiting", "retrying", "stopped", "unconfigured"] as const;
const failureReasons = [
  "not_authenticated",
  "provider_integrations_unavailable",
  "provider_integrations_user_unlinked",
  "provider_integrations_forbidden"
] as const satisfies readonly ProviderIntegrationStatusFailureReason[];
const providerCapabilities = {
  twitch: [
    { key: "twitch_api_access", label: "Twitch API access" },
    { key: "twitch_chat_intake", label: "Twitch chat intake" },
    { key: "twitch_eventsub_intake", label: "Twitch event intake" }
  ],
  youtube: [
    { key: "youtube_data_access", label: "YouTube data access" },
    { key: "youtube_owner_consent", label: "YouTube owner consent" },
    { key: "youtube_live_chat_intake", label: "YouTube live chat intake" }
  ],
  discord: [
    { key: "discord_bot_access", label: "Discord bot access" },
    { key: "discord_guild_target", label: "Discord guild target" },
    { key: "discord_webhook_intake", label: "Discord webhook intake" },
    { key: "discord_chat_intake", label: "Discord chat intake" }
  ]
} as const satisfies Record<
  typeof providerIds[number],
  readonly { key: ProviderStatusProvider["capabilities"][number]["key"]; label: string }[]
>;

const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();

  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key, index) => key === expectedKeys[index]);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isEnumValue = <Value extends string>(
  value: unknown,
  values: readonly Value[]
): value is Value =>
  typeof value === "string" && values.includes(value as Value);

const isBoundedText = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= maxLength;

const isNullableBoundedText = (value: unknown, maxLength: number): value is string | null =>
  value === null || isBoundedText(value, maxLength);

const isIsoTimestampOrNull = (value: unknown): value is string | null => {
  if (value === null) {
    return true;
  }

  if (typeof value !== "string" || value.length > 40) {
    return false;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
};

type ProviderStatusSuccess = Extract<ProviderIntegrationsStatusResponse, { ok: true }>;
type ProviderStatusProvider = ProviderStatusSuccess["providers"][number];

const parseRuntime = (
  value: unknown,
  generatedAt: string
): ProviderRuntimeStatus | null => {
  if (!isRecord(value) || !exactKeys(value, [
    "state",
    "accountSummary",
    "connectedAt",
    "lastActivityAt",
    "nextRetryAt"
  ])) {
    return null;
  }

  if (
    !isEnumValue<ProviderRuntimeConnectionState>(value.state, runtimeStates)
    || !isNullableBoundedText(value.accountSummary, 80)
    || !isIsoTimestampOrNull(value.connectedAt)
    || !isIsoTimestampOrNull(value.lastActivityAt)
    || !isIsoTimestampOrNull(value.nextRetryAt)
  ) {
    return null;
  }

  if (
    value.state === "retrying"
      ? value.nextRetryAt === null || new Date(value.nextRetryAt).getTime() <= new Date(generatedAt).getTime()
      : value.nextRetryAt !== null
  ) {
    return null;
  }

  return {
    state: value.state,
    accountSummary: value.accountSummary,
    connectedAt: value.connectedAt,
    lastActivityAt: value.lastActivityAt,
    nextRetryAt: value.nextRetryAt
  };
};

const parseCapabilities = (
  value: unknown,
  providerId: ProviderStatusProvider["id"]
): ProviderStatusProvider["capabilities"] | null => {
  const expectedCapabilities = providerCapabilities[providerId];

  if (!Array.isArray(value) || value.length !== expectedCapabilities.length) {
    return null;
  }

  const capabilities: ProviderStatusProvider["capabilities"][number][] = [];

  for (const [index, entry] of value.entries()) {
    const expected = expectedCapabilities[index];

    if (!isRecord(entry) || !exactKeys(entry, ["key", "label", "state"])) {
      return null;
    }

    if (
      !expected
      || entry.key !== expected.key
      || entry.label !== expected.label
      || !isEnumValue<ProviderCapabilityState>(entry.state, capabilityStates)
    ) {
      return null;
    }

    capabilities.push({
      key: expected.key,
      label: expected.label,
      state: entry.state
    });
  }

  return capabilities;
};

const parseProvider = (
  value: unknown,
  generatedAt: string
): ProviderStatusProvider | null => {
  if (!isRecord(value) || !exactKeys(value, [
    "id",
    "label",
    "readiness",
    "capabilities",
    "runtime",
    "guidance"
  ])) {
    return null;
  }

  if (!isEnumValue(value.id, providerIds)) {
    return null;
  }

  const label = providerLabels[value.id];

  if (
    value.label !== label
    || !isEnumValue<ProviderIntegrationReadiness>(value.readiness, readinessStates)
    || !isNullableBoundedText(value.guidance, 180)
  ) {
    return null;
  }

  const capabilities = parseCapabilities(value.capabilities, value.id);
  const runtime = parseRuntime(value.runtime, generatedAt);

  if (!capabilities || !runtime) {
    return null;
  }

  return {
    id: value.id,
    label,
    readiness: value.readiness,
    capabilities,
    runtime,
    guidance: value.guidance
  };
};

export const parseProviderIntegrationsStatusResponse = (
  value: unknown
): ProviderIntegrationsStatusResponse | null => {
  if (!isRecord(value) || !("ok" in value)) {
    return null;
  }

  if (value.ok === false) {
    return exactKeys(value, ["ok", "reason"])
      && isEnumValue<ProviderIntegrationStatusFailureReason>(value.reason, failureReasons)
      ? {
        ok: false,
        reason: value.reason
      }
      : null;
  }

  if (value.ok !== true || !exactKeys(value, ["ok", "generatedAt", "providers"])) {
    return null;
  }

  const generatedAt = value.generatedAt;

  if (!isIsoTimestampOrNull(generatedAt) || generatedAt === null || !Array.isArray(value.providers)) {
    return null;
  }

  const providers = value.providers.map((provider) => parseProvider(provider, generatedAt));

  if (providers.some((provider) => provider === null)) {
    return null;
  }

  const ids = providers.map((provider) => provider?.id);
  if (ids.length !== providerIds.length || !providerIds.every((providerId, index) => ids[index] === providerId)) {
    return null;
  }

  return {
    ok: true,
    generatedAt,
    providers: providers as ProviderStatusSuccess["providers"]
  };
};

export const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

export const getFailureMessage = (
  response: Response,
  reason?: ProviderIntegrationStatusFailureReason
): string => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "Sign in before opening provider integration status.";
  }

  if (
    response.status === 403
    || reason === "provider_integrations_forbidden"
    || reason === "provider_integrations_user_unlinked"
  ) {
    return "Your account does not have owner access to provider integration status.";
  }

  return `Provider integration status request failed with ${response.status}.`;
};

export const getLoadStateForFailure = (
  response: Response,
  reason?: ProviderIntegrationStatusFailureReason
): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

  if (
    response.status === 403
    || reason === "provider_integrations_forbidden"
    || reason === "provider_integrations_user_unlinked"
  ) {
    return "forbidden";
  }

  return "failed";
};

export const parseJson = async <ResponseBody,>(response: Response): Promise<ResponseBody | null> => {
  try {
    return await response.json() as ResponseBody;
  } catch {
    return null;
  }
};
