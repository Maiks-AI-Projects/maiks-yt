import { getProviderEventCatalogEntry } from "./provider-event-catalog.rules.js";
import type { ProviderEventSafety } from "./provider-event-catalog.types.js";
import type {
  NormalizedProviderEventIntake,
  ProviderEventIntakeInput,
  ProviderEventIntakeValidationResult
} from "./provider-event-intake.types.js";

const maxStringLength = 512;
const maxPayloadKeys = 50;
const redactedKeyPattern = /token|secret|authorization|cookie|password|refresh/i;

const unknownSafety = {
  authOrTokenShaped: false,
  highVolume: false,
  internalOnly: true,
  moderationShaped: false,
  moneyShaped: false,
  overlayEligibleByDefault: false,
  providerWriteRequired: false
} satisfies ProviderEventSafety;

const trimOptional = (value: string | null | undefined, maxLength = 191): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

const parseDate = (value: Date | string | null | undefined): Date | null | "invalid" => {
  if (value == null) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "invalid" : date;
};

const sanitizePayloadValue = (value: unknown, depth = 0): unknown => {
  if (value == null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return value.slice(0, maxStringLength);
  }

  if (Array.isArray(value)) {
    return depth >= 2
      ? "[array]"
      : value.slice(0, 25).map((item) => sanitizePayloadValue(item, depth + 1));
  }

  if (typeof value === "object") {
    if (depth >= 2) {
      return "[object]";
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value).slice(0, maxPayloadKeys)) {
      sanitized[key] = redactedKeyPattern.test(key)
        ? "[redacted]"
        : sanitizePayloadValue(nestedValue, depth + 1);
    }
    return sanitized;
  }

  return String(value).slice(0, maxStringLength);
};

const sanitizePayload = (payload: Record<string, unknown>): Record<string, unknown> =>
  sanitizePayloadValue(payload) as Record<string, unknown>;

const normalizeProviderEventName = (value: string): string => value.trim().slice(0, 191);

const unknownInternalTrigger = (input: ProviderEventIntakeInput, providerEventName: string): string =>
  `provider.${input.provider}.unknown.${input.mechanism.replaceAll("-", ".")}.${providerEventName.toLowerCase().replaceAll("_", "-").replaceAll(".", "-")}`.slice(0, 191);

export const normalizeProviderEventIntake = (
  input: ProviderEventIntakeInput
): ProviderEventIntakeValidationResult => {
  const providerEventName = normalizeProviderEventName(input.providerEventName);
  if (!providerEventName) {
    return { ok: false, reason: "provider_event_name_required" };
  }

  if (!input.redactedPayload || Object.keys(input.redactedPayload).length === 0) {
    return { ok: false, reason: "redacted_payload_required" };
  }

  const occurredAt = parseDate(input.occurredAt);
  const receivedAt = parseDate(input.receivedAt) ?? new Date();
  if (occurredAt === "invalid" || receivedAt === "invalid") {
    return { ok: false, reason: "invalid_date" };
  }

  const catalogEntry = getProviderEventCatalogEntry(input.provider, providerEventName);
  const safety = catalogEntry?.safety ?? unknownSafety;

  const value: NormalizedProviderEventIntake = {
    actorDisplayName: trimOptional(input.actorDisplayName),
    actorExternalId: trimOptional(input.actorExternalId),
    catalogKnown: Boolean(catalogEntry),
    category: catalogEntry?.category ?? "unknown",
    internalTrigger: catalogEntry?.internalTrigger ?? unknownInternalTrigger(input, providerEventName),
    mechanism: input.mechanism,
    occurredAt,
    payloadSchemaVersion: 1,
    provider: input.provider,
    providerChannelId: trimOptional(input.providerChannelId),
    providerChannelIdentityId: trimOptional(input.providerChannelIdentityId, 36),
    providerEventName,
    providerMessageId: trimOptional(input.providerMessageId),
    receivedAt,
    redactedPayload: sanitizePayload(input.redactedPayload),
    safety,
    sourceEventId: trimOptional(input.sourceEventId)
  };

  return { ok: true, value };
};
