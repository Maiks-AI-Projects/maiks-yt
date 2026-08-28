import {
  decideMusicTrackSelection,
  defaultMusicTopTrackLimit,
  getAmsterdamCalendarDate,
  shouldQueueMusicTrackReview,
  validateRankedMusicTracks,
  type MusicSafetyContext
} from "@maiks-yt/domain/music";

import {
  deriveAnonymousMusicRequestHmac,
  getMusicRequestHashSecret
} from "./music-request-hash.service.js";
import { MusicAdminService } from "./music-admin.service.js";
import { requireMusicPlayControlActor } from "./music-service-authorization.service.js";
import { safeHttpUrlOrNull, toAccountCatalogTrack, toPublicCatalogTrack } from "./music-service-catalog.service.js";
import type {
  MusicAuthUser,
  MusicBlacklistInput,
  MusicLicenseSnapshotInput,
  MusicPlaybackOutcomeInput,
  MusicPlaylistInput,
  MusicProviderPolicyInput,
  MusicRepository,
  MusicReviewResolutionAction,
  MusicTrackSourceInput,
  MusicTrackInput
} from "./music.types.js";

export { normalizeMusicPermissions } from "./music-service-authorization.service.js";

export class MusicService {
  private readonly adminService: MusicAdminService;

  public constructor(
    private readonly repository: MusicRepository,
    private readonly options: {
      getNow?: () => Date;
      getRequestHashSecret?: () => string | null;
      topTrackLimit?: number;
    } = {}
  ) {
    this.adminService = new MusicAdminService(repository);
  }

  public async listPublicCatalog(input: {
    query: string | null;
    context: MusicSafetyContext;
    limit?: number;
  }) {
    const tracks = await this.repository.listPublicCatalog({
      query: input.query?.trim() || null,
      context: input.context,
      limit: input.limit ?? 50
    });
    const projectedTracks = tracks
      .filter((track) => decideMusicTrackSelection(track, input.context).ok)
      .map(toPublicCatalogTrack);
    const referenceCounts = new Map<string, number>();

    for (const track of projectedTracks) {
      referenceCounts.set(track.selectionReference, (referenceCounts.get(track.selectionReference) ?? 0) + 1);
    }

    return {
      ok: true as const,
      tracks: projectedTracks.filter((track) => referenceCounts.get(track.selectionReference) === 1)
    };
  }

  public async createAnonymousRequest(input: {
    selectionReference: string;
    context: MusicSafetyContext;
    viewerIp: string;
    requestText: string | null;
  }) {
    const secret = this.options.getRequestHashSecret?.() ?? getMusicRequestHashSecret();

    if (!secret) {
      return {
        ok: false as const,
        reason: "music_request_unavailable" as const
      };
    }

    const amsterdamDate = getAmsterdamCalendarDate(this.options.getNow?.() ?? new Date());
    const anonymousDailyHmac = deriveAnonymousMusicRequestHmac({
      ipAddress: input.viewerIp,
      amsterdamDate,
      secret
    });

    return await this.repository.createAnonymousTrackRequest({
      selectionReference: input.selectionReference,
      context: input.context,
      anonymousDailyHmac,
      amsterdamDate,
      requestText: input.requestText?.trim() || null
    });
  }

  public async listAccountCatalog(input: {
    query: string | null;
    context: MusicSafetyContext;
    limit?: number;
  }) {
    const tracks = await this.repository.listPublicCatalog({
      query: input.query?.trim() || null,
      context: input.context,
      limit: input.limit ?? 50
    });
    const seenTrackIds = new Set<string>();
    const accountTracks = [];

    for (const track of tracks) {
      if (!decideMusicTrackSelection(track, input.context).ok || seenTrackIds.has(track.trackId)) {
        continue;
      }

      seenTrackIds.add(track.trackId);
      accountTracks.push(toAccountCatalogTrack(track));
    }

    return {
      ok: true as const,
      tracks: accountTracks
    };
  }

  public async getTopTracks(input: { authUser: MusicAuthUser; limit?: number }) {
    const domainUser = await this.repository.resolveOrCreateDomainUser(input.authUser);
    const limit = input.limit ?? this.options.topTrackLimit ?? defaultMusicTopTrackLimit;

    return {
      ok: true as const,
      limit,
      tracks: await this.repository.listTopTracks(domainUser.id, limit)
    };
  }

  public async replaceTopTracks(input: {
    authUser: MusicAuthUser;
    tracks: readonly { trackId: string; rank: number }[];
  }) {
    const limit = this.options.topTrackLimit ?? defaultMusicTopTrackLimit;
    const validation = validateRankedMusicTracks(input.tracks, limit);

    if (!validation.ok) {
      return {
        ok: false as const,
        reason: `music_top_tracks_${validation.reason}` as const
      };
    }

    for (const track of validation.tracks) {
      const selectable = await this.repository.getSelectableTrack({
        trackId: track.trackId,
        sourceId: null,
        context: "live",
        requirePublicRequest: false
      });

      if (!selectable || !decideMusicTrackSelection(selectable, "live").ok) {
        return {
          ok: false as const,
          reason: "music_top_tracks_track_not_selectable" as const
        };
      }
    }

    const domainUser = await this.repository.resolveOrCreateDomainUser(input.authUser);
    await this.repository.replaceTopTracks({
      userId: domainUser.id,
      picks: validation.tracks
    });

    return {
      ok: true as const,
      limit,
      tracks: await this.repository.listTopTracks(domainUser.id, limit)
    };
  }

  public async listAdmin(input: { authUserId: string }) {
    return await this.adminService.listAdmin(input);
  }

  public async createProviderPolicy(authUserId: string, input: MusicProviderPolicyInput) {
    return await this.adminService.createProviderPolicy(authUserId, input);
  }

  public async updateProviderPolicy(authUserId: string, id: string, input: MusicProviderPolicyInput) {
    return await this.adminService.updateProviderPolicy(authUserId, id, input);
  }

  public async createTrack(authUserId: string, input: MusicTrackInput) {
    return await this.adminService.createTrack(authUserId, input);
  }

  public async updateTrack(authUserId: string, id: string, input: MusicTrackInput) {
    return await this.adminService.updateTrack(authUserId, id, input);
  }

  public async createTrackSource(authUserId: string, trackId: string, input: MusicTrackSourceInput) {
    return await this.adminService.createTrackSource(authUserId, trackId, input);
  }

  public async updateTrackSource(authUserId: string, id: string, input: MusicTrackSourceInput) {
    return await this.adminService.updateTrackSource(authUserId, id, input);
  }

  public async createLicenseSnapshot(authUserId: string, sourceId: string, input: MusicLicenseSnapshotInput) {
    return await this.adminService.createLicenseSnapshot(authUserId, sourceId, input);
  }

  public async updateLicenseSnapshot(authUserId: string, id: string, input: MusicLicenseSnapshotInput) {
    return await this.adminService.updateLicenseSnapshot(authUserId, id, input);
  }

  public async createPlaylist(authUserId: string, input: MusicPlaylistInput) {
    return await this.adminService.createPlaylist(authUserId, input);
  }

  public async updatePlaylist(authUserId: string, id: string, input: MusicPlaylistInput) {
    return await this.adminService.updatePlaylist(authUserId, id, input);
  }

  public async replacePlaylistTracks(authUserId: string, playlistId: string, tracks: readonly { trackId: string; sortOrder: number }[]) {
    return await this.adminService.replacePlaylistTracks(authUserId, playlistId, tracks);
  }

  public async createBlacklistEntry(authUserId: string, input: MusicBlacklistInput) {
    return await this.adminService.createBlacklistEntry(authUserId, input);
  }

  public async revokeBlacklistEntry(authUserId: string, id: string, reason: string) {
    return await this.adminService.revokeBlacklistEntry(authUserId, id, reason);
  }

  public async resolveReviewQueueItem(authUserId: string, id: string, input: {
    action: MusicReviewResolutionAction;
    note: string | null;
  }) {
    return await this.adminService.resolveReviewQueueItem(authUserId, id, input);
  }

  public async appendPlayHistory(authUserId: string, input: {
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
    publicVisible?: boolean;
  }) {
    const actor = await requireMusicPlayControlActor(this.repository, authUserId);

    if (!actor.ok) {
      return actor;
    }

    const selectable = input.outcome === "admin-preview"
      ? await this.repository.getAdminPreviewTrack({
        trackId: input.trackId,
        sourceId: input.sourceId
      })
      : input.outcome === "played-full"
        ? await this.repository.getSelectableTrack({
          trackId: input.trackId,
          sourceId: input.sourceId,
          context: "live",
          requirePublicRequest: false
        })
        : null;

    if (input.outcome === "admin-preview"
      && (!selectable || !safeHttpUrlOrNull(selectable.previewUrl) || !selectable.previewMimeType)) {
      return {
        ok: false as const,
        reason: "music_track_not_selectable" as const
      };
    }

    if (input.outcome === "played-full"
      && (!selectable || !decideMusicTrackSelection(selectable, "live").ok)) {
      return {
        ok: false as const,
        reason: "music_track_not_selectable" as const
      };
    }

    return await this.repository.appendPlayHistory({
      ...input,
      actorUserId: actor.domainUserId,
      publicVisible: input.outcome === "admin-preview" ? false : input.publicVisible ?? true
    });
  }

  public shouldQueueReview(outcome: MusicPlaybackOutcomeInput): boolean {
    return outcome === "admin-preview" ? false : shouldQueueMusicTrackReview(outcome);
  }
}
