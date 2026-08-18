import { isBlockedMusicProviderKey, musicSafetyContexts } from "@maiks-yt/domain/music";
import { z } from "zod";

export const idParamsSchema = z.object({
  id: z.string().trim().min(1).max(36)
}).strict();

export const safeHttpUrl = (maxLength: number) =>
  z.string().trim().max(maxLength).url().refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  });

export const nullableSafeHttpUrl = (maxLength: number) =>
  safeHttpUrl(maxLength).nullable().optional();

export const catalogQuerySchema = z.object({
  query: z.string().trim().max(120).optional().default(""),
  context: z.enum(musicSafetyContexts).optional().default("live"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50)
}).strict();

export const requestPayloadSchema = z.object({
  trackId: z.string().trim().min(1).max(36),
  sourceId: z.string().trim().min(1).max(36).nullable().optional(),
  context: z.enum(musicSafetyContexts).optional().default("live"),
  requestText: z.string().trim().max(500).nullable().optional()
}).strict();

export const topTracksPayloadSchema = z.object({
  tracks: z.array(z.object({
    trackId: z.string().trim().min(1).max(36),
    rank: z.number().int().min(1).max(1_000)
  }).strict()).max(1_000)
}).strict();

export const providerPolicySchema = z.object({
  providerKey: z.string().trim().min(1).max(80).refine(
    (value) => !isBlockedMusicProviderKey(value),
    "music_provider_blocked"
  ),
  displayName: z.string().trim().min(1).max(191),
  providerType: z.enum(["local", "catalog", "platform", "artist-direct", "manual", "other"]).optional(),
  providerStatus: z.enum(["allowed", "limited", "blocked", "disabled"]).optional(),
  rightsState: z.enum(["eligible", "uncertain", "ineligible"]).optional(),
  publicRequestsEnabled: z.boolean().optional(),
  publicPlaybackEnabled: z.boolean().optional(),
  defaultLiveSafe: z.boolean().optional(),
  defaultVodSafe: z.boolean().optional(),
  attributionRequired: z.boolean().optional(),
  localCacheAllowed: z.boolean().optional(),
  policyUrl: nullableSafeHttpUrl(1024),
  termsUrl: nullableSafeHttpUrl(1024),
  notesPrivate: z.string().trim().max(4_000).nullable().optional(),
  effectiveUntil: z.string().datetime().nullable().optional()
}).strict();

export const trackSchema = z.object({
  slug: z.string().trim().min(1).max(191),
  title: z.string().trim().min(1).max(191),
  artist: z.string().trim().min(1).max(191),
  album: z.string().trim().max(191).nullable().optional(),
  durationSeconds: z.number().int().positive().nullable().optional(),
  isrc: z.string().trim().max(32).nullable().optional(),
  rightsState: z.enum(["eligible", "uncertain", "ineligible"]).optional(),
  reviewState: z.enum(["unreviewed", "review", "approved", "restricted", "rejected", "blacklisted"]).optional(),
  liveSafe: z.boolean().optional(),
  vodSafe: z.boolean().optional(),
  explicitContent: z.boolean().optional(),
  instrumental: z.boolean().optional(),
  safetyTags: z.array(z.string().trim().min(1).max(80)).max(24).optional(),
  notesPrivate: z.string().trim().max(4_000).nullable().optional()
}).strict();

export const sourceSchema = z.object({
  providerPolicyId: z.string().trim().min(1).max(36).nullable().optional(),
  providerKey: z.string().trim().min(1).max(80).refine(
    (value) => !isBlockedMusicProviderKey(value),
    "music_provider_blocked"
  ),
  sourceType: z.enum(["provider_catalog", "local_audio", "external_url", "manual_reference"]),
  sourceLabel: z.string().trim().min(1).max(191),
  sourceExternalId: z.string().trim().max(191).nullable().optional(),
  sourceUrl: nullableSafeHttpUrl(1024),
  previewUrl: nullableSafeHttpUrl(1024),
  previewMimeType: z.string().trim().max(120).nullable().optional(),
  storageRef: z.string().trim().max(512).nullable().optional(),
  sha256: z.string().trim().regex(/^[a-fA-F0-9]{64}$/).nullable().optional(),
  mimeType: z.string().trim().max(120).nullable().optional(),
  durationSeconds: z.number().int().positive().nullable().optional(),
  rightsState: z.enum(["eligible", "uncertain", "ineligible"]).optional(),
  availabilityStatus: z.enum(["available", "unavailable", "removed", "error"]).optional(),
  attributionText: z.string().trim().max(1000).nullable().optional()
}).strict().superRefine((value, context) => {
  if (value.sourceType === "local_audio") {
    if (!value.storageRef || !value.sha256 || value.sourceUrl) {
      context.addIssue({
        code: "custom",
        message: "local_audio_requires_storage_ref_sha256_and_no_source_url"
      });
    }
  }

  if ((value.previewUrl && !value.previewMimeType) || (!value.previewUrl && value.previewMimeType)) {
    context.addIssue({
      code: "custom",
      message: "preview_url_and_mime_type_must_be_paired"
    });
  }
});

export const licenseSnapshotSchema = z.object({
  trackId: z.string().trim().min(1).max(36).optional(),
  sourceId: z.string().trim().min(1).max(36).optional(),
  providerPolicyId: z.string().trim().min(1).max(36).nullable().optional(),
  licenseName: z.string().trim().min(1).max(191),
  licenseKind: z.enum([
    "royalty-free",
    "creative-commons",
    "platform-library",
    "direct-permission",
    "public-domain",
    "custom",
    "unknown"
  ]).optional(),
  rightsState: z.enum(["eligible", "uncertain", "ineligible"]).optional(),
  liveSafe: z.boolean().optional(),
  vodSafe: z.boolean().optional(),
  attributionRequired: z.boolean().optional(),
  attributionText: z.string().trim().max(1000).nullable().optional(),
  proofUrl: nullableSafeHttpUrl(1024),
  proofStorageRef: z.string().trim().max(512).nullable().optional(),
  licensePayload: z.record(z.string(), z.unknown()).nullable().optional(),
  validFrom: z.string().datetime().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional()
}).strict().superRefine((value, context) => {
  if (value.attributionRequired !== false && !value.attributionText?.trim()) {
    context.addIssue({
      code: "custom",
      message: "attribution_text_required"
    });
  }
});

export const playlistSchema = z.object({
  slug: z.string().trim().min(1).max(191),
  title: z.string().trim().min(1).max(191),
  description: z.string().trim().max(4_000).nullable().optional(),
  visibility: z.enum(["private", "unlisted", "public"]).optional(),
  reviewState: z.enum(["draft", "review", "approved", "restricted", "archived"]).optional()
}).strict();

export const playlistTracksSchema = z.object({
  tracks: z.array(z.object({
    trackId: z.string().trim().min(1).max(36),
    sortOrder: z.number().int().min(0).max(100_000)
  }).strict()).max(500)
}).strict();

export const blacklistSchema = z.object({
  scope: z.enum(["track", "source", "artist", "provider", "external_id", "keyword"]),
  trackId: z.string().trim().min(1).max(36).nullable().optional(),
  sourceId: z.string().trim().min(1).max(36).nullable().optional(),
  providerKey: z.string().trim().min(1).max(80).nullable().optional(),
  normalizedValue: z.string().trim().min(1).max(191),
  reason: z.string().trim().min(1).max(500),
  severity: z.enum(["temporary", "permanent", "safety", "rights"]).optional()
}).strict();

export const revokeSchema = z.object({
  reason: z.string().trim().min(1).max(500)
}).strict();

export const reviewResolveSchema = z.object({
  action: z.enum(["keep", "restrict", "reject", "blacklist"]),
  note: z.string().trim().max(1000).nullable().optional()
}).strict();

export const historyPayloadSchema = z.object({
  trackId: z.string().trim().min(1).max(36),
  sourceId: z.string().trim().min(1).max(36).nullable().optional(),
  requestId: z.string().trim().min(1).max(36).nullable().optional(),
  playlistId: z.string().trim().min(1).max(36).nullable().optional(),
  streamSessionId: z.string().trim().min(1).max(36).nullable().optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().nullable().optional(),
  outcome: z.enum(["played-full", "skipped", "stopped", "failed", "queued-skipped", "admin-preview"]),
  outcomeReason: z.string().trim().max(500).nullable().optional(),
  durationPlayedSeconds: z.number().int().min(0).nullable().optional(),
  publicVisible: z.boolean().optional()
}).strict();

export const limitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50)
}).strict();
