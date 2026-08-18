import {
  booleanValue,
  integerValue,
  nullableStringValue,
  stringValue
} from "../admin-music-data.service";

export const providerTypeOptions = ["catalog", "platform", "artist-direct", "local", "manual", "other"] as const;
export const providerStatusOptions = ["limited", "allowed", "blocked", "disabled"] as const;
export const rightsStateOptions = ["uncertain", "eligible", "ineligible"] as const;
export const trackReviewStateOptions = ["unreviewed", "review", "approved", "restricted", "rejected", "blacklisted"] as const;
export const sourceTypeOptions = ["provider_catalog", "local_audio", "external_url", "manual_reference"] as const;
export const availabilityStatusOptions = ["available", "unavailable", "removed", "error"] as const;
export const licenseKindOptions = [
  "royalty-free",
  "creative-commons",
  "platform-library",
  "direct-permission",
  "public-domain",
  "custom",
  "unknown"
] as const;

export type SourceTypeOption = typeof sourceTypeOptions[number];

export const isSourceTypeOption = (value: string | undefined): value is SourceTypeOption =>
  sourceTypeOptions.some((option) => option === value);

const splitTags = (value: string): readonly string[] =>
  value.split(",").map((tag) => tag.trim()).filter(Boolean);

export const buildProviderPolicyPayload = (data: FormData): Record<string, unknown> => ({
  attributionRequired: booleanValue(data, "attributionRequired"),
  defaultLiveSafe: booleanValue(data, "defaultLiveSafe"),
  defaultVodSafe: booleanValue(data, "defaultVodSafe"),
  displayName: stringValue(data, "displayName"),
  effectiveUntil: nullableStringValue(data, "effectiveUntil"),
  localCacheAllowed: booleanValue(data, "localCacheAllowed"),
  notesPrivate: nullableStringValue(data, "notesPrivate"),
  policyUrl: nullableStringValue(data, "policyUrl"),
  providerKey: stringValue(data, "providerKey"),
  providerStatus: stringValue(data, "providerStatus"),
  providerType: stringValue(data, "providerType"),
  publicPlaybackEnabled: booleanValue(data, "publicPlaybackEnabled"),
  publicRequestsEnabled: booleanValue(data, "publicRequestsEnabled"),
  rightsState: stringValue(data, "rightsState"),
  termsUrl: nullableStringValue(data, "termsUrl")
});

export const buildTrackPayload = (data: FormData): Record<string, unknown> => ({
  album: nullableStringValue(data, "album"),
  artist: stringValue(data, "artist"),
  durationSeconds: integerValue(data, "durationSeconds"),
  explicitContent: booleanValue(data, "explicitContent"),
  instrumental: booleanValue(data, "instrumental"),
  isrc: nullableStringValue(data, "isrc"),
  liveSafe: booleanValue(data, "liveSafe"),
  notesPrivate: nullableStringValue(data, "notesPrivate"),
  reviewState: stringValue(data, "reviewState"),
  rightsState: stringValue(data, "rightsState"),
  safetyTags: splitTags(stringValue(data, "safetyTags")),
  slug: stringValue(data, "slug"),
  title: stringValue(data, "title"),
  vodSafe: booleanValue(data, "vodSafe")
});

export const buildSourcePayload = (data: FormData): {
  readonly error: string | null;
  readonly payload: Record<string, unknown>;
} => {
  const sourceType = stringValue(data, "sourceType") as SourceTypeOption;
  const previewUrl = nullableStringValue(data, "previewUrl");
  const previewMimeType = nullableStringValue(data, "previewMimeType");
  const storageRef = nullableStringValue(data, "storageRef");
  const sha256 = nullableStringValue(data, "sha256");
  const sourceUrl = sourceType === "local_audio" ? null : nullableStringValue(data, "sourceUrl");

  if (sourceType === "local_audio" && (!storageRef || !sha256)) {
    return {
      error: "Local audio sources need a storage ref and sha256, and source URL is left empty.",
      payload: {}
    };
  }

  if ((previewUrl && !previewMimeType) || (!previewUrl && previewMimeType)) {
    return {
      error: "Preview URL and preview MIME must be saved together.",
      payload: {}
    };
  }

  return {
    error: null,
    payload: {
      attributionText: nullableStringValue(data, "attributionText"),
      availabilityStatus: stringValue(data, "availabilityStatus"),
      durationSeconds: integerValue(data, "durationSeconds"),
      mimeType: nullableStringValue(data, "mimeType"),
      previewMimeType,
      previewUrl,
      providerKey: stringValue(data, "providerKey"),
      providerPolicyId: nullableStringValue(data, "providerPolicyId"),
      rightsState: stringValue(data, "rightsState"),
      sha256,
      sourceExternalId: nullableStringValue(data, "sourceExternalId"),
      sourceLabel: stringValue(data, "sourceLabel"),
      sourceType,
      sourceUrl,
      storageRef
    }
  };
};

export const buildLicenseSnapshotPayload = (
  data: FormData,
  selectedTrackId: string | null,
  selectedSourceId: string | null
): Record<string, unknown> => ({
  attributionRequired: booleanValue(data, "attributionRequired"),
  attributionText: nullableStringValue(data, "attributionText"),
  licenseKind: stringValue(data, "licenseKind"),
  licenseName: stringValue(data, "licenseName"),
  liveSafe: booleanValue(data, "liveSafe"),
  proofStorageRef: nullableStringValue(data, "proofStorageRef"),
  proofUrl: nullableStringValue(data, "proofUrl"),
  providerPolicyId: nullableStringValue(data, "providerPolicyId"),
  rightsState: stringValue(data, "rightsState"),
  sourceId: nullableStringValue(data, "sourceId") ?? selectedSourceId ?? undefined,
  trackId: selectedTrackId ?? undefined,
  validFrom: nullableStringValue(data, "validFrom"),
  validUntil: nullableStringValue(data, "validUntil"),
  vodSafe: booleanValue(data, "vodSafe")
});
