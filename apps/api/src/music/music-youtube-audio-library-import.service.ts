import {
  validateIncompetechManifest,
  validateYouTubeAudioLibraryManifest,
  type YouTubeAudioLibraryBulkManifest
} from "@maiks-yt/domain/music";

import { requireMusicManageActor } from "./music-service-authorization.service.js";
import type { MusicRepository } from "./music.types.js";
import { incompetechImportProvider, youtubeAudioLibraryImportProvider } from "./music-youtube-audio-library-import-store.service.js";
import type {
  MusicLibraryImportManifest,
  MusicLibraryImportProvider,
  MusicLibraryImportValidatedTrack,
  MusicYouTubeAudioLibraryImportItem,
  MusicYouTubeAudioLibraryImportRepository,
  MusicYouTubeAudioLibraryImportResult,
  MusicYouTubeAudioLibraryImportSummary,
  MusicAudioStorageVerifier
} from "./music-youtube-audio-library-import.types.js";

const emptySummary = (
  received: number,
  accepted: number,
  rejected: number
): MusicYouTubeAudioLibraryImportSummary => ({
  received,
  accepted,
  rejected,
  created: 0,
  updated: 0,
  unchanged: 0,
  markedUnavailable: 0,
  licenseSnapshotsAppended: 0
});

const manifestMaxAgeMs = 7 * 24 * 60 * 60 * 1000;
const manifestFutureSkewMs = 10 * 60 * 1000;

const comparableForTrack = (track: MusicLibraryImportValidatedTrack): string =>
  JSON.stringify({
    title: track.title,
    artist: track.artist,
    durationSeconds: track.durationSeconds,
    sourceType: track.audio.sourceType,
    sourceUrl: null,
    storageRef: track.audio.storageRef,
    sha256: track.audio.sha256,
    mimeType: track.audio.mimeType,
    attributionText: track.attributionText,
    safetyTags: track.safetyTags,
    explicitContent: track.explicitContent,
    instrumental: track.instrumental,
    licenseName: track.licenseName,
    licenseUrl: track.licenseUrl,
    proofUrl: track.proofUrl,
    proofStorageRef: track.proofStorageRef,
    licensePayload: track.licensePayload
  });

const manifestClaimsCompleteFullRefresh = (manifest: YouTubeAudioLibraryBulkManifest): boolean => {
  if (manifest.refreshMode !== "full") {
    return true;
  }

  const completeness = manifest.exportCompleteness;
  if (!completeness) {
    return false;
  }

  return completeness.reachedEnd
    && completeness.tracksExported > 0
    && completeness.tracksExported === manifest.tracks.length
    && completeness.processedCandidates === completeness.tracksExported
    && completeness.candidateRows === completeness.tracksExported
    && completeness.skippedCandidates === 0
    && !completeness.hitMaxTracks
    && completeness.filterApplied === true
    && completeness.refreshMode === "full";
};

export class MusicYouTubeAudioLibraryImportService {
  public constructor(
    private readonly authRepository: Pick<MusicRepository, "resolveActor">,
    private readonly importRepository: MusicYouTubeAudioLibraryImportRepository,
    private readonly audioVerifier: MusicAudioStorageVerifier,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async dryRun(authUserId: string, manifestInput: unknown) {
    return await this.import(authUserId, manifestInput, "dry-run");
  }

  public async apply(authUserId: string, manifestInput: unknown) {
    return await this.import(authUserId, manifestInput, "apply");
  }

  private async import(
    authUserId: string,
    manifestInput: unknown,
    mode: "dry-run" | "apply"
  ): Promise<MusicYouTubeAudioLibraryImportResult | {
    ok: false;
    reason:
      | "music_admin_forbidden"
      | "music_admin_user_unlinked"
      | "music_import_invalid_manifest"
      | "music_import_incomplete_manifest"
      | "music_import_audio_unverified"
      | "music_import_stale_manifest"
      | "music_import_future_manifest";
  }> {
    const actor = await requireMusicManageActor(this.authRepository, authUserId);

    if (!actor.ok) {
      return actor;
    }

    const provider = youtubeAudioLibraryImportProvider;
    const validation = validateYouTubeAudioLibraryManifest(manifestInput);

    if (!validation.ok) {
      return {
        ok: false,
        reason: "music_import_invalid_manifest"
      };
    }

    const freshness = this.validateFreshness(validation.manifest.exportedAt);
    if (!freshness.ok) {
      return {
        ok: false,
        reason: freshness.reason
      };
    }

    if (
      validation.manifest.refreshMode === "full"
      && (
        validation.tracks.length === 0
        || validation.rejectedTracks.length > 0
        || !manifestClaimsCompleteFullRefresh(validation.manifest)
      )
    ) {
      return {
        ok: false,
        reason: "music_import_incomplete_manifest"
      };
    }

    const verifiedTracks = await this.verifyAudio(validation.tracks);
    if (!verifiedTracks) {
      return {
        ok: false,
        reason: "music_import_audio_unverified"
      };
    }

    if (mode === "apply") {
      const summary = await this.importRepository.applyImport({
        actorUserId: actor.domainUserId,
        provider,
        manifest: validation.manifest,
        tracks: verifiedTracks
      });

      return {
        ok: true,
        mode,
        summary: {
          ...summary,
          received: validation.manifest.tracks.length,
          accepted: verifiedTracks.length,
          rejected: validation.rejectedTracks.length
        },
        items: this.buildItemsFromSummary(provider, validation.manifest, verifiedTracks, summary),
        rejectedTracks: validation.rejectedTracks
      };
    }

    const state = await this.importRepository.getImportState({ providerKey: provider.providerKey });
    const acceptedExternalIds = new Set(verifiedTracks.map((track) => track.externalId.toLowerCase()));
    const existingByExternalId = new Map(state.sources.map((source) => [source.externalId.toLowerCase(), source]));
    const items: MusicYouTubeAudioLibraryImportItem[] = [];
    const summary = emptySummary(
      validation.manifest.tracks.length,
      verifiedTracks.length,
      validation.rejectedTracks.length
    );

    for (const track of verifiedTracks) {
      const existing = existingByExternalId.get(track.externalId.toLowerCase());

      if (!existing) {
        summary.created += 1;
        summary.licenseSnapshotsAppended += 1;
        items.push({
          externalId: track.externalId,
          title: track.title,
          action: "create",
          reason: null
        });
        continue;
      }

      if (existing.latestLicenseComparable === comparableForTrack(track)
        && existing.availabilityStatus === "available"
        && existing.rightsState === "eligible") {
        summary.unchanged += 1;
        items.push({
          externalId: track.externalId,
          title: track.title,
          action: "unchanged",
          reason: null
        });
        continue;
      }

      summary.updated += 1;
      summary.licenseSnapshotsAppended += existing.latestLicenseComparable === comparableForTrack(track) ? 0 : 1;
      items.push({
        externalId: track.externalId,
        title: track.title,
        action: "update",
        reason: null
      });
    }

    if (validation.manifest.refreshMode === "full") {
      for (const source of state.sources) {
        if (source.availabilityStatus === "available" && !acceptedExternalIds.has(source.externalId.toLowerCase())) {
          summary.markedUnavailable += 1;
          items.push({
            externalId: source.externalId,
            title: source.title,
            action: "mark_unavailable",
            reason: "not_present_as_valid_cc_by_4"
          });
        }
      }
    }

    for (const rejectedTrack of validation.rejectedTracks) {
      items.push({
        externalId: rejectedTrack.externalId,
        title: rejectedTrack.title,
        action: "skip",
        reason: rejectedTrack.reason
      });
    }

    return {
      ok: true,
      mode,
      summary,
      items,
      rejectedTracks: validation.rejectedTracks
    };
  }

  private validateFreshness(exportedAt: string): {
    ok: true;
  } | {
    ok: false;
    reason: "music_import_stale_manifest" | "music_import_future_manifest";
  } {
    const exportedAtMs = Date.parse(exportedAt);
    const nowMs = this.now().getTime();

    if (exportedAtMs > nowMs + manifestFutureSkewMs) {
      return {
        ok: false,
        reason: "music_import_future_manifest"
      };
    }

    if (exportedAtMs < nowMs - manifestMaxAgeMs) {
      return {
        ok: false,
        reason: "music_import_stale_manifest"
      };
    }

    return {
      ok: true
    };
  }

  private async verifyAudio(
    tracks: readonly MusicLibraryImportValidatedTrack[]
  ): Promise<readonly MusicLibraryImportValidatedTrack[] | null> {
    const verifiedTracks: MusicLibraryImportValidatedTrack[] = [];

    for (const track of tracks) {
      const verified = await this.audioVerifier.verify({
        storageRef: track.audio.storageRef,
        sha256: track.audio.sha256
      });

      if (!verified.ok) {
        return null;
      }

      verifiedTracks.push({
        ...track,
        audio: {
          ...track.audio,
          mimeType: verified.contentType
        }
      });
    }

    return verifiedTracks;
  }

  private buildItemsFromSummary(
    provider: MusicLibraryImportProvider,
    manifest: MusicLibraryImportManifest,
    tracks: readonly MusicLibraryImportValidatedTrack[],
    summary: MusicYouTubeAudioLibraryImportSummary
  ): readonly MusicYouTubeAudioLibraryImportItem[] {
    const items = tracks.map((track): MusicYouTubeAudioLibraryImportItem => ({
      externalId: track.externalId,
      title: track.title,
      action: "unchanged",
      reason: `applied_to_${provider.providerKey}`
    }));

    if (manifest.refreshMode === "full" && summary.markedUnavailable > 0) {
      items.push({
        externalId: null,
        title: null,
        action: "mark_unavailable",
        reason: `${summary.markedUnavailable}_sources`
      });
    }

    return items;
  }
}

export class MusicIncompetechImportService {
  public constructor(
    private readonly authRepository: Pick<MusicRepository, "resolveActor">,
    private readonly importRepository: MusicYouTubeAudioLibraryImportRepository,
    private readonly audioVerifier: MusicAudioStorageVerifier
  ) {}

  public async dryRun(authUserId: string, manifestInput: unknown) {
    return await this.import(authUserId, manifestInput, "dry-run");
  }

  public async apply(authUserId: string, manifestInput: unknown) {
    return await this.import(authUserId, manifestInput, "apply");
  }

  private async import(
    authUserId: string,
    manifestInput: unknown,
    mode: "dry-run" | "apply"
  ): Promise<MusicYouTubeAudioLibraryImportResult | {
    ok: false;
    reason:
      | "music_admin_forbidden"
      | "music_admin_user_unlinked"
      | "music_import_invalid_manifest"
      | "music_import_incomplete_manifest"
      | "music_import_audio_unverified";
  }> {
    const actor = await requireMusicManageActor(this.authRepository, authUserId);

    if (!actor.ok) {
      return actor;
    }

    const provider = incompetechImportProvider;
    const validation = validateIncompetechManifest(manifestInput);

    if (!validation.ok) {
      return {
        ok: false,
        reason: "music_import_invalid_manifest"
      };
    }

    const verifiedTracks = await this.verifyAudio(validation.tracks);
    if (!verifiedTracks) {
      return {
        ok: false,
        reason: "music_import_audio_unverified"
      };
    }

    if (mode === "apply") {
      const summary = await this.importRepository.applyImport({
        actorUserId: actor.domainUserId,
        provider,
        manifest: validation.manifest,
        tracks: verifiedTracks
      });

      return {
        ok: true,
        mode,
        summary: {
          ...summary,
          received: validation.manifest.tracks.length,
          accepted: verifiedTracks.length,
          rejected: validation.rejectedTracks.length
        },
        items: this.buildItemsFromSummary(provider, validation.manifest, verifiedTracks, summary),
        rejectedTracks: validation.rejectedTracks
      };
    }

    const state = await this.importRepository.getImportState({ providerKey: provider.providerKey });
    const existingByExternalId = new Map(state.sources.map((source) => [source.externalId.toLowerCase(), source]));
    const items: MusicYouTubeAudioLibraryImportItem[] = [];
    const summary = emptySummary(
      validation.manifest.tracks.length,
      verifiedTracks.length,
      validation.rejectedTracks.length
    );

    for (const track of verifiedTracks) {
      const existing = existingByExternalId.get(track.externalId.toLowerCase());

      if (!existing) {
        summary.created += 1;
        summary.licenseSnapshotsAppended += 1;
        items.push({
          externalId: track.externalId,
          title: track.title,
          action: "create",
          reason: null
        });
        continue;
      }

      if (existing.latestLicenseComparable === comparableForTrack(track)
        && existing.availabilityStatus === "available"
        && existing.rightsState === "eligible") {
        summary.unchanged += 1;
        items.push({
          externalId: track.externalId,
          title: track.title,
          action: "unchanged",
          reason: null
        });
        continue;
      }

      summary.updated += 1;
      summary.licenseSnapshotsAppended += existing.latestLicenseComparable === comparableForTrack(track) ? 0 : 1;
      items.push({
        externalId: track.externalId,
        title: track.title,
        action: "update",
        reason: null
      });
    }

    return {
      ok: true,
      mode,
      summary,
      items,
      rejectedTracks: validation.rejectedTracks
    };
  }

  private async verifyAudio(
    tracks: readonly MusicLibraryImportValidatedTrack[]
  ): Promise<readonly MusicLibraryImportValidatedTrack[] | null> {
    const verifiedTracks: MusicLibraryImportValidatedTrack[] = [];

    for (const track of tracks) {
      const verified = await this.audioVerifier.verify({
        storageRef: track.audio.storageRef,
        sha256: track.audio.sha256
      });

      if (!verified.ok || verified.contentType !== "audio/mpeg") {
        return null;
      }

      verifiedTracks.push({
        ...track,
        audio: {
          ...track.audio,
          mimeType: verified.contentType
        }
      });
    }

    return verifiedTracks;
  }

  private buildItemsFromSummary(
    provider: MusicLibraryImportProvider,
    manifest: MusicLibraryImportManifest,
    tracks: readonly MusicLibraryImportValidatedTrack[],
    summary: MusicYouTubeAudioLibraryImportSummary
  ): readonly MusicYouTubeAudioLibraryImportItem[] {
    const items = tracks.map((track): MusicYouTubeAudioLibraryImportItem => ({
      externalId: track.externalId,
      title: track.title,
      action: "unchanged",
      reason: `applied_to_${provider.providerKey}`
    }));

    if (manifest.refreshMode === "full" && summary.markedUnavailable > 0) {
      items.push({
        externalId: null,
        title: null,
        action: "mark_unavailable",
        reason: `${summary.markedUnavailable}_sources`
      });
    }

    return items;
  }
}
