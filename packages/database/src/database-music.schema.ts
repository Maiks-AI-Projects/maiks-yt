import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core";

const musicRightsStateValues = ["eligible", "uncertain", "ineligible"] as const;
const musicReviewStateValues = ["unreviewed", "review", "approved", "restricted", "rejected", "blacklisted"] as const;
const musicProviderTypeValues = ["local", "catalog", "platform", "artist-direct", "manual", "other"] as const;
const musicSourceTypeValues = ["provider_catalog", "local_audio", "external_url", "manual_reference"] as const;
const musicLicenseKindValues = [
  "royalty-free",
  "creative-commons",
  "platform-library",
  "direct-permission",
  "public-domain",
  "custom",
  "unknown"
] as const;

export const musicProviderPolicies = mysqlTable(
  "music_provider_policies",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    providerKey: varchar("provider_key", { length: 80 }).notNull().unique(),
    displayName: varchar("display_name", { length: 191 }).notNull(),
    providerType: mysqlEnum("provider_type", musicProviderTypeValues).notNull().default("catalog"),
    providerStatus: mysqlEnum("provider_status", ["allowed", "limited", "blocked", "disabled"]).notNull().default("limited"),
    rightsState: mysqlEnum("rights_state", musicRightsStateValues).notNull().default("uncertain"),
    publicRequestsEnabled: boolean("public_requests_enabled").notNull().default(false),
    publicPlaybackEnabled: boolean("public_playback_enabled").notNull().default(false),
    defaultLiveSafe: boolean("default_live_safe").notNull().default(false),
    defaultVodSafe: boolean("default_vod_safe").notNull().default(false),
    attributionRequired: boolean("attribution_required").notNull().default(true),
    localCacheAllowed: boolean("local_cache_allowed").notNull().default(false),
    policyUrl: varchar("policy_url", { length: 1024 }),
    termsUrl: varchar("terms_url", { length: 1024 }),
    notesPrivate: text("notes_private"),
    effectiveFrom: timestamp("effective_from").notNull().defaultNow(),
    effectiveUntil: timestamp("effective_until"),
    createdByUserId: varchar("created_by_user_id", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("music_provider_policies_public_idx").on(
      table.providerStatus,
      table.publicRequestsEnabled,
      table.publicPlaybackEnabled
    ),
    index("music_provider_policies_rights_idx").on(table.rightsState, table.providerStatus),
    index("music_provider_policies_live_catalog_idx").on(table.providerStatus, table.rightsState, table.defaultLiveSafe),
    index("music_provider_policies_vod_catalog_idx").on(table.providerStatus, table.rightsState, table.defaultVodSafe),
    index("music_provider_policies_effective_idx").on(table.providerKey, table.effectiveFrom, table.effectiveUntil),
    check("music_provider_policies_key_check", sql`trim(${table.providerKey}) <> ''`),
    check("music_provider_policies_blocked_key_check", sql`lower(trim(${table.providerKey})) <> 'spotify'`),
    check("music_provider_policies_name_check", sql`trim(${table.displayName}) <> ''`),
    check(
      "music_provider_policies_window_check",
      sql`${table.effectiveUntil} is null or ${table.effectiveUntil} > ${table.effectiveFrom}`
    ),
    check(
      "music_provider_policies_blocked_public_check",
      sql`${table.providerStatus} <> 'blocked' or (${table.publicRequestsEnabled} = false and ${table.publicPlaybackEnabled} = false)`
    ),
    check(
      "music_provider_policies_eligible_safety_check",
      sql`(
        ${table.rightsState} <> 'eligible'
        or ${table.providerStatus} <> 'allowed'
        or (${table.publicRequestsEnabled} = false and ${table.publicPlaybackEnabled} = false)
        or ${table.defaultLiveSafe} = true
        or ${table.defaultVodSafe} = true
      )`
    )
  ]
);

export const musicTracks = mysqlTable(
  "music_tracks",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    slug: varchar("slug", { length: 191 }).notNull(),
    title: varchar("title", { length: 191 }).notNull(),
    artist: varchar("artist", { length: 191 }).notNull(),
    album: varchar("album", { length: 191 }),
    durationSeconds: int("duration_seconds"),
    isrc: varchar("isrc", { length: 32 }),
    normalizedTitleArtistKey: varchar("normalized_title_artist_key", { length: 191 }),
    rightsState: mysqlEnum("rights_state", musicRightsStateValues).notNull().default("uncertain"),
    reviewState: mysqlEnum("review_state", musicReviewStateValues).notNull().default("unreviewed"),
    liveSafe: boolean("live_safe").notNull().default(false),
    vodSafe: boolean("vod_safe").notNull().default(false),
    explicitContent: boolean("explicit_content").notNull().default(false),
    instrumental: boolean("instrumental").notNull().default(false),
    safetyTags: json("safety_tags").$type<readonly string[]>().notNull(),
    notesPrivate: text("notes_private"),
    createdByUserId: varchar("created_by_user_id", { length: 36 }),
    updatedByUserId: varchar("updated_by_user_id", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    uniqueIndex("music_tracks_slug_uidx").on(table.slug),
    index("music_tracks_public_candidate_idx").on(table.rightsState, table.reviewState, table.createdAt),
    index("music_tracks_live_catalog_idx").on(table.rightsState, table.liveSafe, table.reviewState, table.createdAt),
    index("music_tracks_vod_catalog_idx").on(table.rightsState, table.vodSafe, table.reviewState, table.createdAt),
    index("music_tracks_review_idx").on(table.reviewState, table.updatedAt),
    index("music_tracks_title_artist_idx").on(table.title, table.artist),
    index("music_tracks_normalized_key_idx").on(table.normalizedTitleArtistKey),
    check("music_tracks_slug_check", sql`trim(${table.slug}) <> ''`),
    check("music_tracks_title_check", sql`trim(${table.title}) <> ''`),
    check("music_tracks_artist_check", sql`trim(${table.artist}) <> ''`),
    check(
      "music_tracks_duration_check",
      sql`${table.durationSeconds} is null or ${table.durationSeconds} > 0`
    ),
    check(
      "music_tracks_eligible_safety_check",
      sql`(
        ${table.rightsState} <> 'eligible'
        or ${table.reviewState} in ('review', 'restricted', 'rejected', 'blacklisted')
        or ${table.liveSafe} = true
        or ${table.vodSafe} = true
      )`
    )
  ]
);

export const musicTrackSources = mysqlTable(
  "music_track_sources",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    trackId: varchar("track_id", { length: 36 }).notNull(),
    providerPolicyId: varchar("provider_policy_id", { length: 36 }),
    providerKey: varchar("provider_key", { length: 80 }).notNull(),
    sourceType: mysqlEnum("source_type", musicSourceTypeValues).notNull(),
    sourceLabel: varchar("source_label", { length: 191 }).notNull(),
    sourceExternalId: varchar("source_external_id", { length: 191 }),
    sourceUrl: varchar("source_url", { length: 1024 }),
    previewUrl: varchar("preview_url", { length: 1024 }),
    storageRef: varchar("storage_ref", { length: 512 }),
    sha256: varchar("sha256", { length: 64 }),
    mimeType: varchar("mime_type", { length: 120 }),
    previewMimeType: varchar("preview_mime_type", { length: 191 }),
    durationSeconds: int("duration_seconds"),
    rightsState: mysqlEnum("rights_state", musicRightsStateValues).notNull().default("uncertain"),
    availabilityStatus: mysqlEnum("availability_status", ["available", "unavailable", "removed", "error"]).notNull().default("available"),
    attributionText: varchar("attribution_text", { length: 1000 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("music_track_sources_track_idx").on(table.trackId),
    index("music_track_sources_provider_idx").on(table.providerKey, table.availabilityStatus),
    index("music_track_sources_rights_idx").on(table.rightsState, table.availabilityStatus),
    index("music_track_sources_policy_idx").on(table.providerPolicyId),
    uniqueIndex("music_track_sources_external_uidx").on(table.providerKey, table.sourceExternalId),
    check("music_track_sources_provider_key_check", sql`trim(${table.providerKey}) <> ''`),
    check("music_track_sources_blocked_key_check", sql`lower(trim(${table.providerKey})) <> 'spotify'`),
    check("music_track_sources_label_check", sql`trim(${table.sourceLabel}) <> ''`),
    check(
      "music_track_sources_duration_check",
      sql`${table.durationSeconds} is null or ${table.durationSeconds} > 0`
    ),
    check(
      "music_track_sources_sha256_check",
      sql`${table.sha256} is null or length(${table.sha256}) = 64`
    ),
    check(
      "music_track_sources_preview_check",
      sql`(
        (${table.previewUrl} is null and ${table.previewMimeType} is null)
        or (
          ${table.previewUrl} is not null
          and trim(${table.previewUrl}) <> ''
          and left(${table.previewUrl}, 1) <> '/'
          and lower(${table.previewUrl}) not like 'file:%'
        )
      )`
    ),
    check(
      "music_track_sources_local_audio_check",
      sql`(
        ${table.sourceType} <> 'local_audio'
        or (
          ${table.storageRef} is not null
          and trim(${table.storageRef}) <> ''
          and left(${table.storageRef}, 1) <> '/'
          and lower(${table.storageRef}) not like 'file:%'
          and ${table.sha256} is not null
          and length(${table.sha256}) = 64
          and ${table.sourceUrl} is null
        )
      )`
    )
  ]
);

export const musicLicenseSnapshots = mysqlTable(
  "music_license_snapshots",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    trackId: varchar("track_id", { length: 36 }).notNull(),
    sourceId: varchar("source_id", { length: 36 }).notNull(),
    providerPolicyId: varchar("provider_policy_id", { length: 36 }),
    licenseName: varchar("license_name", { length: 191 }).notNull(),
    licenseKind: mysqlEnum("license_kind", musicLicenseKindValues).notNull().default("unknown"),
    rightsState: mysqlEnum("rights_state", musicRightsStateValues).notNull().default("uncertain"),
    liveSafe: boolean("live_safe").notNull().default(false),
    vodSafe: boolean("vod_safe").notNull().default(false),
    attributionRequired: boolean("attribution_required").notNull().default(true),
    attributionText: varchar("attribution_text", { length: 1000 }),
    proofUrl: varchar("proof_url", { length: 1024 }),
    proofStorageRef: varchar("proof_storage_ref", { length: 512 }),
    licensePayload: json("license_payload").$type<Record<string, unknown> | null>(),
    validFrom: timestamp("valid_from"),
    validUntil: timestamp("valid_until"),
    capturedByUserId: varchar("captured_by_user_id", { length: 36 }),
    capturedAt: timestamp("captured_at").notNull().defaultNow()
  },
  (table) => [
    index("music_license_snapshots_source_captured_idx").on(table.sourceId, table.capturedAt),
    index("music_license_snapshots_track_idx").on(table.trackId, table.capturedAt),
    index("music_license_snapshots_rights_idx").on(table.rightsState, table.capturedAt),
    index("music_license_snapshots_live_idx").on(table.rightsState, table.liveSafe, table.capturedAt),
    index("music_license_snapshots_vod_idx").on(table.rightsState, table.vodSafe, table.capturedAt),
    index("music_license_snapshots_policy_idx").on(table.providerPolicyId),
    check("music_license_snapshots_name_check", sql`trim(${table.licenseName}) <> ''`),
    check(
      "music_license_snapshots_window_check",
      sql`${table.validUntil} is null or ${table.validFrom} is null or ${table.validUntil} > ${table.validFrom}`
    ),
    check(
      "music_license_snapshots_attribution_check",
      sql`${table.attributionRequired} = false or (${table.attributionText} is not null and trim(${table.attributionText}) <> '')`
    ),
    check(
      "music_license_snapshots_eligible_safety_check",
      sql`${table.rightsState} <> 'eligible' or ${table.liveSafe} = true or ${table.vodSafe} = true`
    )
  ]
);

export const musicBlacklistEntries = mysqlTable(
  "music_blacklist_entries",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    scope: mysqlEnum("scope", ["track", "source", "artist", "provider", "external_id", "keyword"]).notNull(),
    trackId: varchar("track_id", { length: 36 }),
    sourceId: varchar("source_id", { length: 36 }),
    providerKey: varchar("provider_key", { length: 80 }),
    normalizedValue: varchar("normalized_value", { length: 191 }).notNull(),
    reason: varchar("reason", { length: 500 }).notNull(),
    severity: mysqlEnum("severity", ["temporary", "permanent", "safety", "rights"]).notNull().default("permanent"),
    createdByUserId: varchar("created_by_user_id", { length: 36 }).notNull(),
    revokedByUserId: varchar("revoked_by_user_id", { length: 36 }),
    revokedAt: timestamp("revoked_at"),
    revocationReason: varchar("revocation_reason", { length: 500 }),
    createdAt: timestamp("created_at").notNull().defaultNow()
  },
  (table) => [
    index("music_blacklist_entries_scope_value_idx").on(table.scope, table.normalizedValue),
    index("music_blacklist_entries_track_idx").on(table.trackId, table.revokedAt),
    index("music_blacklist_entries_source_idx").on(table.sourceId, table.revokedAt),
    index("music_blacklist_entries_provider_idx").on(table.providerKey, table.revokedAt),
    check("music_blacklist_entries_value_check", sql`trim(${table.normalizedValue}) <> ''`),
    check("music_blacklist_entries_reason_check", sql`trim(${table.reason}) <> ''`),
    check(
      "music_blacklist_entries_revocation_check",
      sql`(
        (${table.revokedAt} is null and ${table.revokedByUserId} is null and ${table.revocationReason} is null)
        or
        (${table.revokedAt} is not null and ${table.revokedByUserId} is not null and ${table.revocationReason} is not null and trim(${table.revocationReason}) <> '')
      )`
    ),
    check(
      "music_blacklist_entries_scope_target_check",
      sql`(
        (${table.scope} = 'track' and ${table.trackId} is not null)
        or (${table.scope} = 'source' and ${table.sourceId} is not null)
        or (${table.scope} = 'provider' and ${table.providerKey} is not null)
        or (${table.scope} in ('artist', 'external_id', 'keyword'))
      )`
    )
  ]
);

export const musicPlaylists = mysqlTable(
  "music_playlists",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    slug: varchar("slug", { length: 191 }).notNull(),
    title: varchar("title", { length: 191 }).notNull(),
    description: text("description"),
    visibility: mysqlEnum("visibility", ["private", "unlisted", "public"]).notNull().default("private"),
    reviewState: mysqlEnum("review_state", ["draft", "review", "approved", "restricted", "archived"]).notNull().default("draft"),
    createdByUserId: varchar("created_by_user_id", { length: 36 }),
    updatedByUserId: varchar("updated_by_user_id", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    uniqueIndex("music_playlists_slug_uidx").on(table.slug),
    index("music_playlists_public_idx").on(table.visibility, table.reviewState, table.updatedAt),
    check("music_playlists_slug_check", sql`trim(${table.slug}) <> ''`),
    check("music_playlists_title_check", sql`trim(${table.title}) <> ''`)
  ]
);

export const musicPlaylistTracks = mysqlTable(
  "music_playlist_tracks",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    playlistId: varchar("playlist_id", { length: 36 }).notNull(),
    trackId: varchar("track_id", { length: 36 }).notNull(),
    sortOrder: int("sort_order").notNull().default(0),
    addedByUserId: varchar("added_by_user_id", { length: 36 }),
    addedAt: timestamp("added_at").notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("music_playlist_tracks_playlist_track_uidx").on(table.playlistId, table.trackId),
    index("music_playlist_tracks_playlist_order_idx").on(table.playlistId, table.sortOrder),
    index("music_playlist_tracks_track_idx").on(table.trackId),
    check("music_playlist_tracks_sort_order_check", sql`${table.sortOrder} >= 0`)
  ]
);

export const musicUserRankedPicks = mysqlTable(
  "music_user_ranked_picks",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    trackId: varchar("track_id", { length: 36 }).notNull(),
    rank: int("rank").notNull(),
    status: mysqlEnum("status", ["active", "paused", "removed"]).notNull().default("active"),
    note: varchar("note", { length: 280 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    uniqueIndex("music_user_ranked_picks_user_track_uidx").on(table.userId, table.trackId),
    uniqueIndex("music_user_ranked_picks_user_rank_uidx").on(table.userId, table.rank),
    index("music_user_ranked_picks_track_idx").on(table.trackId),
    index("music_user_ranked_picks_status_idx").on(table.status, table.updatedAt),
    check("music_user_ranked_picks_rank_check", sql`${table.rank} > 0 and ${table.rank} <= 1000`)
  ]
);

export const musicAnonymousRequestBuckets = mysqlTable(
  "music_anonymous_request_buckets",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    anonymousDailyHmac: varchar("anonymous_daily_hmac", { length: 64 }).notNull(),
    amsterdamDate: date("amsterdam_date", { mode: "string" }).notNull(),
    requestCount: int("request_count").notNull().default(0),
    lastRequestAt: timestamp("last_request_at"),
    blockedUntil: timestamp("blocked_until"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    uniqueIndex("music_anonymous_request_buckets_daily_uidx").on(table.anonymousDailyHmac, table.amsterdamDate),
    index("music_anonymous_request_buckets_date_idx").on(table.amsterdamDate),
    index("music_anonymous_request_buckets_blocked_idx").on(table.blockedUntil),
    check("music_anonymous_request_buckets_hmac_check", sql`length(${table.anonymousDailyHmac}) = 64`),
    check("music_anonymous_request_buckets_count_check", sql`${table.requestCount} >= 0`)
  ]
);

export const musicTrackRequests = mysqlTable(
  "music_track_requests",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    trackId: varchar("track_id", { length: 36 }),
    sourceId: varchar("source_id", { length: 36 }),
    requestedByUserId: varchar("requested_by_user_id", { length: 36 }),
    anonymousRequestBucketId: varchar("anonymous_request_bucket_id", { length: 36 }),
    anonymousDailyHmac: varchar("anonymous_daily_hmac", { length: 64 }),
    amsterdamDate: date("amsterdam_date", { mode: "string" }),
    requestSource: mysqlEnum("request_source", ["member", "anonymous", "admin"]).notNull(),
    status: mysqlEnum("status", ["pending", "accepted", "played", "skipped", "rejected", "expired", "cancelled"])
      .notNull()
      .default("pending"),
    requestText: varchar("request_text", { length: 500 }),
    providerKey: varchar("provider_key", { length: 80 }),
    streamSessionId: varchar("stream_session_id", { length: 36 }),
    outcomeReason: varchar("outcome_reason", { length: 500 }),
    createdByUserId: varchar("created_by_user_id", { length: 36 }),
    resolvedByUserId: varchar("resolved_by_user_id", { length: 36 }),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("music_track_requests_status_created_idx").on(table.status, table.createdAt),
    index("music_track_requests_track_status_idx").on(table.trackId, table.status),
    index("music_track_requests_user_created_idx").on(table.requestedByUserId, table.createdAt),
    index("music_track_requests_anonymous_idx").on(table.anonymousDailyHmac, table.amsterdamDate),
    index("music_track_requests_bucket_idx").on(table.anonymousRequestBucketId),
    index("music_track_requests_stream_idx").on(table.streamSessionId, table.createdAt),
    check(
      "music_track_requests_anonymous_hmac_check",
      sql`${table.anonymousDailyHmac} is null or length(${table.anonymousDailyHmac}) = 64`
    ),
    check(
      "music_track_requests_identity_check",
      sql`(
        (
          ${table.requestSource} = 'member'
          and ${table.requestedByUserId} is not null
          and ${table.anonymousRequestBucketId} is null
          and ${table.anonymousDailyHmac} is null
          and ${table.amsterdamDate} is null
        )
        or
        (
          ${table.requestSource} = 'anonymous'
          and ${table.requestedByUserId} is null
          and ${table.anonymousRequestBucketId} is not null
          and ${table.anonymousDailyHmac} is not null
          and length(${table.anonymousDailyHmac}) = 64
          and ${table.amsterdamDate} is not null
        )
        or
        (
          ${table.requestSource} = 'admin'
          and ${table.anonymousRequestBucketId} is null
          and ${table.anonymousDailyHmac} is null
          and ${table.amsterdamDate} is null
        )
      )`
    ),
    check(
      "music_track_requests_resolution_check",
      sql`(
        (${table.status} in ('pending', 'accepted') and ${table.resolvedAt} is null)
        or
        (${table.status} not in ('pending', 'accepted') and ${table.resolvedAt} is not null)
      )`
    )
  ]
);

export const musicPlayHistory = mysqlTable(
  "music_play_history",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    trackId: varchar("track_id", { length: 36 }),
    sourceId: varchar("source_id", { length: 36 }),
    requestId: varchar("request_id", { length: 36 }),
    playlistId: varchar("playlist_id", { length: 36 }),
    streamSessionId: varchar("stream_session_id", { length: 36 }),
    streamScheduleEntryId: varchar("stream_schedule_entry_id", { length: 36 }),
    startedAt: timestamp("started_at").notNull(),
    endedAt: timestamp("ended_at"),
    outcome: mysqlEnum("outcome", ["played", "skipped", "stopped", "failed", "blocked", "admin_preview"]).notNull(),
    outcomeReason: varchar("outcome_reason", { length: 500 }),
    publicVisible: boolean("public_visible").notNull().default(true),
    titleSnapshot: varchar("title_snapshot", { length: 191 }).notNull(),
    artistSnapshot: varchar("artist_snapshot", { length: 191 }).notNull(),
    durationSecondsSnapshot: int("duration_seconds_snapshot"),
    durationPlayedSeconds: int("duration_played_seconds"),
    providerKeySnapshot: varchar("provider_key_snapshot", { length: 80 }).notNull(),
    sourceTypeSnapshot: mysqlEnum("source_type_snapshot", musicSourceTypeValues).notNull(),
    sourceLabelSnapshot: varchar("source_label_snapshot", { length: 191 }).notNull(),
    sourceExternalIdSnapshot: varchar("source_external_id_snapshot", { length: 191 }),
    sourceUrlSnapshot: varchar("source_url_snapshot", { length: 1024 }),
    previewUrlSnapshot: varchar("preview_url_snapshot", { length: 1024 }),
    previewMimeTypeSnapshot: varchar("preview_mime_type_snapshot", { length: 191 }),
    sourceStorageRefSnapshot: varchar("source_storage_ref_snapshot", { length: 512 }),
    sourceSha256Snapshot: varchar("source_sha256_snapshot", { length: 64 }),
    licenseNameSnapshot: varchar("license_name_snapshot", { length: 191 }).notNull(),
    licenseKindSnapshot: mysqlEnum("license_kind_snapshot", musicLicenseKindValues).notNull(),
    licenseUrlSnapshot: varchar("license_url_snapshot", { length: 1024 }),
    providerPolicyUrlSnapshot: varchar("provider_policy_url_snapshot", { length: 1024 }),
    policyVersionLabelSnapshot: varchar("policy_version_label_snapshot", { length: 191 }),
    attributionTextSnapshot: varchar("attribution_text_snapshot", { length: 1000 }),
    rightsStateSnapshot: mysqlEnum("rights_state_snapshot", musicRightsStateValues).notNull(),
    reviewStateSnapshot: mysqlEnum("review_state_snapshot", musicReviewStateValues).notNull(),
    liveSafeSnapshot: boolean("live_safe_snapshot").notNull(),
    vodSafeSnapshot: boolean("vod_safe_snapshot").notNull(),
    safetyTagsSnapshot: json("safety_tags_snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow()
  },
  (table) => [
    index("music_play_history_started_idx").on(table.startedAt),
    index("music_play_history_public_idx").on(table.publicVisible, table.startedAt),
    index("music_play_history_track_idx").on(table.trackId, table.startedAt),
    index("music_play_history_request_idx").on(table.requestId),
    index("music_play_history_stream_idx").on(table.streamSessionId, table.startedAt),
    index("music_play_history_outcome_idx").on(table.outcome, table.startedAt),
    index("music_play_history_live_safety_idx").on(table.liveSafeSnapshot, table.startedAt),
    index("music_play_history_vod_safety_idx").on(table.vodSafeSnapshot, table.startedAt),
    check(
      "music_play_history_time_check",
      sql`${table.endedAt} is null or ${table.endedAt} >= ${table.startedAt}`
    ),
    check(
      "music_play_history_duration_snapshot_check",
      sql`${table.durationSecondsSnapshot} is null or ${table.durationSecondsSnapshot} > 0`
    ),
    check(
      "music_play_history_duration_played_check",
      sql`${table.durationPlayedSeconds} is null or ${table.durationPlayedSeconds} >= 0`
    ),
    check("music_play_history_title_snapshot_check", sql`trim(${table.titleSnapshot}) <> ''`),
    check("music_play_history_artist_snapshot_check", sql`trim(${table.artistSnapshot}) <> ''`),
    check("music_play_history_provider_snapshot_check", sql`trim(${table.providerKeySnapshot}) <> ''`),
    check("music_play_history_source_snapshot_check", sql`trim(${table.sourceLabelSnapshot}) <> ''`),
    check(
      "music_play_history_source_sha256_snapshot_check",
      sql`${table.sourceSha256Snapshot} is null or length(${table.sourceSha256Snapshot}) = 64`
    ),
    check(
      "music_play_history_preview_snapshot_check",
      sql`(
        (${table.previewUrlSnapshot} is null and ${table.previewMimeTypeSnapshot} is null)
        or (
          ${table.previewUrlSnapshot} is not null
          and trim(${table.previewUrlSnapshot}) <> ''
          and left(${table.previewUrlSnapshot}, 1) <> '/'
          and lower(${table.previewUrlSnapshot}) not like 'file:%'
        )
      )`
    ),
    check(
      "music_play_history_local_audio_snapshot_check",
      sql`(
        ${table.sourceTypeSnapshot} <> 'local_audio'
        or (
          ${table.sourceStorageRefSnapshot} is not null
          and trim(${table.sourceStorageRefSnapshot}) <> ''
          and left(${table.sourceStorageRefSnapshot}, 1) <> '/'
          and lower(${table.sourceStorageRefSnapshot}) not like 'file:%'
          and ${table.sourceSha256Snapshot} is not null
          and length(${table.sourceSha256Snapshot}) = 64
          and ${table.sourceUrlSnapshot} is null
        )
      )`
    ),
    check("music_play_history_license_snapshot_check", sql`trim(${table.licenseNameSnapshot}) <> ''`),
    check(
      "music_play_history_admin_preview_public_check",
      sql`${table.outcome} <> 'admin_preview' or ${table.publicVisible} = false`
    ),
    check(
      "music_play_history_eligible_safety_check",
      sql`${table.rightsStateSnapshot} <> 'eligible' or ${table.liveSafeSnapshot} = true or ${table.vodSafeSnapshot} = true`
    )
  ]
);

export const musicReviewQueue = mysqlTable(
  "music_review_queue",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    trackId: varchar("track_id", { length: 36 }),
    sourceId: varchar("source_id", { length: 36 }),
    requestId: varchar("request_id", { length: 36 }),
    playHistoryId: varchar("play_history_id", { length: 36 }),
    queueKind: mysqlEnum("queue_kind", [
      "manual_review",
      "skip_review",
      "rights_uncertain",
      "blacklist_review",
      "provider_policy",
      "user_report"
    ]).notNull(),
    status: mysqlEnum("status", ["open", "in_review", "resolved", "dismissed"]).notNull().default("open"),
    priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).notNull().default("normal"),
    reasonCode: mysqlEnum("reason_code", [
      "skip",
      "blacklist",
      "rights_uncertain",
      "metadata",
      "safety",
      "provider_policy",
      "user_report",
      "admin"
    ]).notNull(),
    summary: varchar("summary", { length: 500 }).notNull(),
    details: text("details"),
    createdByUserId: varchar("created_by_user_id", { length: 36 }),
    assignedToUserId: varchar("assigned_to_user_id", { length: 36 }),
    resolvedByUserId: varchar("resolved_by_user_id", { length: 36 }),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("music_review_queue_status_priority_idx").on(table.status, table.priority, table.createdAt),
    index("music_review_queue_track_status_idx").on(table.trackId, table.status),
    index("music_review_queue_source_idx").on(table.sourceId),
    index("music_review_queue_request_idx").on(table.requestId),
    index("music_review_queue_play_history_idx").on(table.playHistoryId),
    index("music_review_queue_assignee_idx").on(table.assignedToUserId, table.status),
    index("music_review_queue_reason_idx").on(table.reasonCode, table.createdAt),
    check("music_review_queue_summary_check", sql`trim(${table.summary}) <> ''`),
    check(
      "music_review_queue_skip_check",
      sql`${table.queueKind} <> 'skip_review' or (${table.reasonCode} = 'skip' and ${table.playHistoryId} is not null)`
    ),
    check(
      "music_review_queue_resolution_check",
      sql`(
        (${table.status} in ('open', 'in_review') and ${table.resolvedAt} is null and ${table.resolvedByUserId} is null)
        or
        (${table.status} in ('resolved', 'dismissed') and ${table.resolvedAt} is not null and ${table.resolvedByUserId} is not null)
      )`
    )
  ]
);

export const musicReviewEvents = mysqlTable(
  "music_review_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    queueId: varchar("queue_id", { length: 36 }),
    trackId: varchar("track_id", { length: 36 }),
    sourceId: varchar("source_id", { length: 36 }),
    actorUserId: varchar("actor_user_id", { length: 36 }),
    eventKind: mysqlEnum("event_kind", [
      "queue_created",
      "queue_resolved",
      "note_added",
      "rights_state_changed",
      "review_state_changed",
      "approved",
      "restricted",
      "rejected",
      "blacklisted",
      "blacklist_revoked",
      "skip_logged"
    ]).notNull(),
    previousRightsState: mysqlEnum("previous_rights_state", musicRightsStateValues),
    newRightsState: mysqlEnum("new_rights_state", musicRightsStateValues),
    previousReviewState: mysqlEnum("previous_review_state", musicReviewStateValues),
    newReviewState: mysqlEnum("new_review_state", musicReviewStateValues),
    note: varchar("note", { length: 1000 }),
    eventPayload: json("event_payload").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at").notNull().defaultNow()
  },
  (table) => [
    index("music_review_events_queue_created_idx").on(table.queueId, table.createdAt),
    index("music_review_events_track_created_idx").on(table.trackId, table.createdAt),
    index("music_review_events_source_created_idx").on(table.sourceId, table.createdAt),
    index("music_review_events_actor_created_idx").on(table.actorUserId, table.createdAt),
    index("music_review_events_kind_created_idx").on(table.eventKind, table.createdAt),
    check(
      "music_review_events_rights_change_check",
      sql`${table.eventKind} <> 'rights_state_changed' or ${table.newRightsState} is not null`
    ),
    check(
      "music_review_events_review_change_check",
      sql`(
        ${table.eventKind} <> 'review_state_changed'
        or ${table.newReviewState} is not null
      )`
    ),
    check(
      "music_review_events_terminal_review_check",
      sql`(
        (${table.eventKind} <> 'approved' or ${table.newReviewState} = 'approved')
        and (${table.eventKind} <> 'restricted' or ${table.newReviewState} = 'restricted')
        and (${table.eventKind} <> 'rejected' or ${table.newReviewState} = 'rejected')
        and (${table.eventKind} <> 'blacklisted' or ${table.newReviewState} = 'blacklisted')
      )`
    )
  ]
);
