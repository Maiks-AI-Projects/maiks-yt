import type {
  YouTubeAudioLibraryBulkManifest,
  YouTubeAudioLibraryRejectedTrack
} from "@maiks-yt/domain/music";

export type MusicEligibilityState = "eligible" | "uncertain" | "ineligible";
export type MusicReviewState = "unreviewed" | "review" | "approved" | "restricted" | "rejected" | "blacklisted";

export type MusicApiCatalogTrack = {
  readonly trackId: string;
  readonly sourceId: string;
  readonly title: string;
  readonly artist: string;
  readonly durationSeconds: number | null;
  readonly providerKey: string;
  readonly providerName: string;
  readonly sourceLabel: string;
  readonly previewUrl: string | null;
  readonly previewMimeType: string | null;
  readonly sourceUrl: string | null;
  readonly attributionText: string | null;
  readonly licenseName: string;
  readonly licenseKind: string;
  readonly licenseUrl: string | null;
  readonly providerPolicyUrl: string | null;
  readonly providerTermsUrl: string | null;
  readonly liveSafe: boolean;
  readonly vodSafe: boolean;
};

export type MusicUiTrack = {
  readonly id: string;
  readonly trackId: string;
  readonly sourceId: string | null;
  readonly title: string;
  readonly artist: string;
  readonly durationSeconds: number | null;
  readonly provider: string;
  readonly providerKey: string;
  readonly sourceLabel: string | null;
  readonly liveSafe: boolean;
  readonly vodSafe: boolean;
  readonly attributionCue: string | null;
  readonly previewUrl: string | null;
  readonly previewMimeType: string | null;
  readonly unavailableReason?: string | null;
};

export type MusicTopTrackPick = {
  readonly trackId: string;
  readonly rank: number;
  readonly title: string;
  readonly artist: string;
  readonly durationSeconds: number | null;
  readonly providerKey: string;
  readonly attributionText: string | null;
  readonly licenseName: string;
  readonly licenseUrl: string | null;
};

export type MusicProviderPolicyRecord = {
  readonly id: string;
  readonly providerKey: string;
  readonly displayName: string;
  readonly providerType: string;
  readonly providerStatus: string;
  readonly rightsState: MusicEligibilityState;
  readonly publicRequestsEnabled: boolean;
  readonly publicPlaybackEnabled: boolean;
  readonly defaultLiveSafe: boolean;
  readonly defaultVodSafe: boolean;
  readonly attributionRequired: boolean;
  readonly localCacheAllowed: boolean;
  readonly policyUrl: string | null;
  readonly termsUrl: string | null;
  readonly notesPrivate: string | null;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type MusicTrackSourceRecord = {
  readonly id: string;
  readonly trackId: string;
  readonly providerPolicyId: string | null;
  readonly providerKey: string;
  readonly sourceType: string;
  readonly sourceLabel: string;
  readonly sourceExternalId: string | null;
  readonly sourceUrl: string | null;
  readonly previewUrl: string | null;
  readonly previewMimeType: string | null;
  readonly storageRef?: string | null;
  readonly sha256?: string | null;
  readonly mimeType: string | null;
  readonly durationSeconds: number | null;
  readonly rightsState: MusicEligibilityState;
  readonly availabilityStatus: string;
  readonly attributionText: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type MusicLicenseSnapshotRecord = {
  readonly id: string;
  readonly trackId: string;
  readonly sourceId: string;
  readonly providerPolicyId: string | null;
  readonly licenseName: string;
  readonly licenseKind: string;
  readonly rightsState: MusicEligibilityState;
  readonly liveSafe: boolean;
  readonly vodSafe: boolean;
  readonly attributionRequired: boolean;
  readonly attributionText: string | null;
  readonly proofUrl: string | null;
  readonly validFrom: string | null;
  readonly validUntil: string | null;
  readonly capturedAt: string;
};

export type MusicTrackAdminRecord = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly artist: string;
  readonly album: string | null;
  readonly durationSeconds: number | null;
  readonly isrc: string | null;
  readonly rightsState: MusicEligibilityState;
  readonly reviewState: MusicReviewState;
  readonly liveSafe: boolean;
  readonly vodSafe: boolean;
  readonly explicitContent: boolean;
  readonly instrumental: boolean;
  readonly safetyTags: readonly string[];
  readonly notesPrivate: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly sources: readonly MusicTrackSourceRecord[];
  readonly licenseSnapshots: readonly MusicLicenseSnapshotRecord[];
};

export type MusicPlaylistRecord = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly visibility: string;
  readonly reviewState: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly tracks: readonly { readonly trackId: string; readonly sortOrder: number }[];
};

export type MusicBlacklistEntryRecord = {
  readonly id: string;
  readonly scope: string;
  readonly trackId: string | null;
  readonly sourceId: string | null;
  readonly providerKey: string | null;
  readonly normalizedValue: string;
  readonly reason: string;
  readonly severity: string;
  readonly createdByUserId: string;
  readonly revokedByUserId: string | null;
  readonly revokedAt: string | null;
  readonly revocationReason: string | null;
  readonly createdAt: string;
};

export type MusicReviewAction = "keep" | "restrict" | "reject" | "blacklist";

export type MusicReviewQueueRecord = {
  readonly id: string;
  readonly trackId: string | null;
  readonly sourceId: string | null;
  readonly requestId: string | null;
  readonly playHistoryId: string | null;
  readonly queueKind: string;
  readonly status: string;
  readonly priority: string;
  readonly reasonCode: string;
  readonly summary: string;
  readonly details: string | null;
  readonly createdByUserId: string | null;
  readonly assignedToUserId: string | null;
  readonly resolvedByUserId: string | null;
  readonly resolvedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type MusicPlayHistoryRecord = {
  readonly id: string;
  readonly trackId: string | null;
  readonly sourceId: string | null;
  readonly requestId: string | null;
  readonly playlistId: string | null;
  readonly streamSessionId: string | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly outcome: string;
  readonly outcomeReason: string | null;
  readonly publicVisible: boolean;
  readonly titleSnapshot: string;
  readonly artistSnapshot: string;
  readonly durationSecondsSnapshot: number | null;
  readonly durationPlayedSeconds: number | null;
  readonly providerKeySnapshot: string;
  readonly sourceTypeSnapshot: string;
  readonly sourceLabelSnapshot: string;
  readonly sourceExternalIdSnapshot: string | null;
  readonly sourceUrlSnapshot: string | null;
  readonly previewUrlSnapshot: string | null;
  readonly previewMimeTypeSnapshot: string | null;
  readonly licenseNameSnapshot: string;
  readonly licenseKindSnapshot: string;
  readonly licenseUrlSnapshot: string | null;
  readonly providerPolicyUrlSnapshot: string | null;
  readonly attributionTextSnapshot: string | null;
  readonly rightsStateSnapshot: MusicEligibilityState;
  readonly reviewStateSnapshot: MusicReviewState;
  readonly liveSafeSnapshot: boolean;
  readonly vodSafeSnapshot: boolean;
  readonly createdAt: string;
};

export type MusicAdminOverview = {
  readonly providerPolicies: readonly MusicProviderPolicyRecord[];
  readonly tracks: readonly MusicTrackAdminRecord[];
  readonly playlists: readonly MusicPlaylistRecord[];
  readonly blacklistEntries: readonly MusicBlacklistEntryRecord[];
  readonly reviewQueue: readonly MusicReviewQueueRecord[];
  readonly playHistory: readonly MusicPlayHistoryRecord[];
};

export type MusicApiResult<TData> =
  | ({ readonly ok: true } & TData)
  | { readonly ok: false; readonly reason: string };

export type MusicRequestResult = MusicApiResult<{
  readonly request: {
    readonly id: string;
    readonly trackId: string;
    readonly sourceId: string;
    readonly status: string;
    readonly amsterdamDate: string;
    readonly createdAt: string;
  };
}>;

export type MusicAudioUploadResult = MusicApiResult<{
  readonly upload: {
    readonly storageRef: string;
    readonly filename: string;
    readonly contentType: string;
    readonly sizeBytes: number;
    readonly sha256: string;
  };
}>;

export type MusicYouTubeAudioLibraryImportSummary = {
  readonly received: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly markedUnavailable: number;
  readonly licenseSnapshotsAppended: number;
};

export type MusicYouTubeAudioLibraryImportItem = {
  readonly externalId: string | null;
  readonly title: string | null;
  readonly action: "create" | "update" | "unchanged" | "mark_unavailable" | "skip";
  readonly reason: string | null;
};

export type MusicYouTubeAudioLibraryImportResult = MusicApiResult<{
  readonly mode: "dry-run" | "apply";
  readonly summary: MusicYouTubeAudioLibraryImportSummary;
  readonly items: readonly MusicYouTubeAudioLibraryImportItem[];
  readonly rejectedTracks: readonly YouTubeAudioLibraryRejectedTrack[];
}>;

export type MusicYouTubeAudioLibraryManifest = YouTubeAudioLibraryBulkManifest;
