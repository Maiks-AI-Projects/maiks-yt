import type { MusicSafetyContext } from "@maiks-yt/domain/music";

import type { MusicActor, MusicAuthUser } from "./music-auth.types.js";
import type { MusicPlayHistoryRecord, MusicBlacklistEntryRecord, MusicLicenseSnapshotRecord, MusicPlaylistRecord, MusicProviderPolicyRecord, MusicReviewQueueRecord, MusicSelectableTrack, MusicTrackAdminRecord, MusicTrackSourceRecord } from "./music-record.types.js";
import type { MusicBlacklistInput, MusicLicenseSnapshotInput, MusicPlaybackOutcomeInput, MusicPlaylistInput, MusicProviderPolicyInput, MusicReviewResolutionAction, MusicTopTrackPick, MusicTrackInput, MusicTrackSourceInput } from "./music-input.types.js";
import type { MusicPlayHistoryAppendResult, MusicTrackRequestCreateResult } from "./music-result.types.js";

export type MusicRepository = {
  resolveActor(authUserId: string): Promise<MusicActor | null>;
  resolveOrCreateDomainUser(authUser: MusicAuthUser): Promise<{ id: string; displayName: string }>;
  listPublicCatalog(input: {
    query: string | null;
    context: MusicSafetyContext;
    limit: number;
  }): Promise<readonly MusicSelectableTrack[]>;
  getSelectableTrack(input: {
    trackId: string;
    sourceId: string | null;
    context: MusicSafetyContext;
    requirePublicRequest: boolean;
  }): Promise<MusicSelectableTrack | null>;
  getAdminPreviewTrack(input: {
    trackId: string;
    sourceId: string | null;
  }): Promise<MusicSelectableTrack | null>;
  createAnonymousTrackRequest(input: {
    trackId: string;
    sourceId: string;
    providerKey: string;
    anonymousDailyHmac: string;
    amsterdamDate: string;
    requestText: string | null;
  }): Promise<MusicTrackRequestCreateResult>;
  listTopTracks(userId: string, limit: number): Promise<readonly MusicTopTrackPick[]>;
  replaceTopTracks(input: {
    userId: string;
    picks: readonly { trackId: string; rank: number }[];
  }): Promise<void>;
  listProviderPolicies(): Promise<readonly MusicProviderPolicyRecord[]>;
  providerPolicyMatchesKey(input: { id: string; providerKey: string }): Promise<boolean>;
  createProviderPolicy(input: MusicProviderPolicyInput & { actorUserId: string }): Promise<MusicProviderPolicyRecord>;
  updateProviderPolicy(input: MusicProviderPolicyInput & { id: string; actorUserId: string }): Promise<MusicProviderPolicyRecord | null>;
  listAdminCatalog(): Promise<readonly MusicTrackAdminRecord[]>;
  createTrack(input: MusicTrackInput & { actorUserId: string }): Promise<MusicTrackAdminRecord>;
  updateTrack(input: MusicTrackInput & { id: string; actorUserId: string }): Promise<MusicTrackAdminRecord | null>;
  createTrackSource(input: MusicTrackSourceInput & {
    trackId: string;
    actorUserId: string;
  }): Promise<MusicTrackSourceRecord | null>;
  updateTrackSource(input: MusicTrackSourceInput & {
    id: string;
    actorUserId: string;
  }): Promise<MusicTrackSourceRecord | null>;
  createLicenseSnapshot(input: MusicLicenseSnapshotInput & {
    sourceId: string;
    actorUserId: string;
  }): Promise<MusicLicenseSnapshotRecord | null>;
  updateLicenseSnapshot(input: MusicLicenseSnapshotInput & {
    id: string;
    actorUserId: string;
  }): Promise<MusicLicenseSnapshotRecord | null>;
  listPlaylists(): Promise<readonly MusicPlaylistRecord[]>;
  createPlaylist(input: MusicPlaylistInput & { actorUserId: string }): Promise<MusicPlaylistRecord>;
  updatePlaylist(input: MusicPlaylistInput & { id: string; actorUserId: string }): Promise<MusicPlaylistRecord | null>;
  replacePlaylistTracks(input: {
    playlistId: string;
    tracks: readonly { trackId: string; sortOrder: number }[];
    actorUserId: string;
  }): Promise<MusicPlaylistRecord | null>;
  listBlacklistEntries(): Promise<readonly MusicBlacklistEntryRecord[]>;
  createBlacklistEntry(input: MusicBlacklistInput & { actorUserId: string }): Promise<MusicBlacklistEntryRecord>;
  revokeBlacklistEntry(input: {
    id: string;
    actorUserId: string;
    reason: string;
  }): Promise<MusicBlacklistEntryRecord | null>;
  listReviewQueue(): Promise<readonly MusicReviewQueueRecord[]>;
  resolveReviewQueueItem(input: {
    id: string;
    actorUserId: string;
    action: MusicReviewResolutionAction;
    note: string | null;
  }): Promise<MusicReviewQueueRecord | "conflict" | null>;
  listPlayHistory(limit: number): Promise<readonly MusicPlayHistoryRecord[]>;
  appendPlayHistory(input: {
    actorUserId: string;
    trackId: string;
    sourceId: string | null;
    requestId: string | null;
    playlistId: string | null;
    streamSessionId: string | null;
    startedAt: Date;
    endedAt: Date | null;
    outcome: MusicPlaybackOutcomeInput;
    outcomeReason: string | null;
    durationPlayedSeconds: number | null;
    publicVisible: boolean;
  }): Promise<MusicPlayHistoryAppendResult>;
};
