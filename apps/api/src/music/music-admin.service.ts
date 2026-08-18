import type {
  MusicBlacklistInput,
  MusicLicenseSnapshotInput,
  MusicPlaylistInput,
  MusicProviderPolicyInput,
  MusicRepository,
  MusicReviewResolutionAction,
  MusicTrackInput,
  MusicTrackSourceInput
} from "./music.types.js";
import { requireMusicManageActor } from "./music-service-authorization.service.js";

export class MusicAdminService {
  public constructor(private readonly repository: MusicRepository) {}

  public async listAdmin(input: { authUserId: string }) {
    const actor = await requireMusicManageActor(this.repository, input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    return {
      ok: true as const,
      providerPolicies: await this.repository.listProviderPolicies(),
      tracks: await this.repository.listAdminCatalog(),
      playlists: await this.repository.listPlaylists(),
      blacklistEntries: await this.repository.listBlacklistEntries(),
      reviewQueue: await this.repository.listReviewQueue(),
      playHistory: await this.repository.listPlayHistory(50)
    };
  }

  public async createProviderPolicy(authUserId: string, input: MusicProviderPolicyInput) {
    const actor = await requireMusicManageActor(this.repository, authUserId);

    if (!actor.ok) {
      return actor;
    }

    return {
      ok: true as const,
      providerPolicy: await this.repository.createProviderPolicy({
        ...input,
        actorUserId: actor.domainUserId
      })
    };
  }

  public async updateProviderPolicy(authUserId: string, id: string, input: MusicProviderPolicyInput) {
    const actor = await requireMusicManageActor(this.repository, authUserId);

    if (!actor.ok) {
      return actor;
    }

    const providerPolicy = await this.repository.updateProviderPolicy({
      ...input,
      id,
      actorUserId: actor.domainUserId
    });

    return providerPolicy
      ? { ok: true as const, providerPolicy }
      : { ok: false as const, reason: "music_not_found" as const };
  }

  public async createTrack(authUserId: string, input: MusicTrackInput) {
    const actor = await requireMusicManageActor(this.repository, authUserId);

    if (!actor.ok) {
      return actor;
    }

    return {
      ok: true as const,
      track: await this.repository.createTrack({ ...input, actorUserId: actor.domainUserId })
    };
  }

  public async updateTrack(authUserId: string, id: string, input: MusicTrackInput) {
    const actor = await requireMusicManageActor(this.repository, authUserId);

    if (!actor.ok) {
      return actor;
    }

    const track = await this.repository.updateTrack({ ...input, id, actorUserId: actor.domainUserId });

    return track ? { ok: true as const, track } : { ok: false as const, reason: "music_not_found" as const };
  }

  public async createTrackSource(authUserId: string, trackId: string, input: MusicTrackSourceInput) {
    const actor = await requireMusicManageActor(this.repository, authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (input.providerPolicyId && !await this.repository.providerPolicyMatchesKey({
      id: input.providerPolicyId,
      providerKey: input.providerKey
    })) {
      return { ok: false as const, reason: "music_provider_policy_mismatch" as const };
    }

    const source = await this.repository.createTrackSource({
      ...input,
      trackId,
      actorUserId: actor.domainUserId
    });

    return source
      ? { ok: true as const, source }
      : { ok: false as const, reason: "music_not_found" as const };
  }

  public async updateTrackSource(authUserId: string, id: string, input: MusicTrackSourceInput) {
    const actor = await requireMusicManageActor(this.repository, authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (input.providerPolicyId && !await this.repository.providerPolicyMatchesKey({
      id: input.providerPolicyId,
      providerKey: input.providerKey
    })) {
      return { ok: false as const, reason: "music_provider_policy_mismatch" as const };
    }

    const source = await this.repository.updateTrackSource({
      ...input,
      id,
      actorUserId: actor.domainUserId
    });

    return source
      ? { ok: true as const, source }
      : { ok: false as const, reason: "music_not_found" as const };
  }

  public async createLicenseSnapshot(authUserId: string, sourceId: string, input: MusicLicenseSnapshotInput) {
    const actor = await requireMusicManageActor(this.repository, authUserId);

    if (!actor.ok) {
      return actor;
    }

    const licenseSnapshot = await this.repository.createLicenseSnapshot({
      ...input,
      sourceId,
      actorUserId: actor.domainUserId
    });

    return licenseSnapshot
      ? { ok: true as const, licenseSnapshot }
      : { ok: false as const, reason: "music_not_found" as const };
  }

  public async updateLicenseSnapshot(authUserId: string, id: string, input: MusicLicenseSnapshotInput) {
    const actor = await requireMusicManageActor(this.repository, authUserId);

    if (!actor.ok) {
      return actor;
    }

    const licenseSnapshot = await this.repository.updateLicenseSnapshot({
      ...input,
      id,
      actorUserId: actor.domainUserId
    });

    return licenseSnapshot
      ? { ok: true as const, licenseSnapshot }
      : { ok: false as const, reason: "music_not_found" as const };
  }

  public async createPlaylist(authUserId: string, input: MusicPlaylistInput) {
    const actor = await requireMusicManageActor(this.repository, authUserId);

    if (!actor.ok) {
      return actor;
    }

    return {
      ok: true as const,
      playlist: await this.repository.createPlaylist({ ...input, actorUserId: actor.domainUserId })
    };
  }

  public async updatePlaylist(authUserId: string, id: string, input: MusicPlaylistInput) {
    const actor = await requireMusicManageActor(this.repository, authUserId);

    if (!actor.ok) {
      return actor;
    }

    const playlist = await this.repository.updatePlaylist({ ...input, id, actorUserId: actor.domainUserId });

    return playlist
      ? { ok: true as const, playlist }
      : { ok: false as const, reason: "music_not_found" as const };
  }

  public async replacePlaylistTracks(authUserId: string, playlistId: string, tracks: readonly { trackId: string; sortOrder: number }[]) {
    const actor = await requireMusicManageActor(this.repository, authUserId);

    if (!actor.ok) {
      return actor;
    }

    const playlist = await this.repository.replacePlaylistTracks({
      playlistId,
      tracks,
      actorUserId: actor.domainUserId
    });

    return playlist
      ? { ok: true as const, playlist }
      : { ok: false as const, reason: "music_not_found" as const };
  }

  public async createBlacklistEntry(authUserId: string, input: MusicBlacklistInput) {
    const actor = await requireMusicManageActor(this.repository, authUserId);

    if (!actor.ok) {
      return actor;
    }

    return {
      ok: true as const,
      blacklistEntry: await this.repository.createBlacklistEntry({ ...input, actorUserId: actor.domainUserId })
    };
  }

  public async revokeBlacklistEntry(authUserId: string, id: string, reason: string) {
    const actor = await requireMusicManageActor(this.repository, authUserId);

    if (!actor.ok) {
      return actor;
    }

    const blacklistEntry = await this.repository.revokeBlacklistEntry({
      id,
      actorUserId: actor.domainUserId,
      reason
    });

    return blacklistEntry
      ? { ok: true as const, blacklistEntry }
      : { ok: false as const, reason: "music_not_found" as const };
  }

  public async resolveReviewQueueItem(authUserId: string, id: string, input: {
    action: MusicReviewResolutionAction;
    note: string | null;
  }) {
    const actor = await requireMusicManageActor(this.repository, authUserId);

    if (!actor.ok) {
      return actor;
    }

    const reviewItem = await this.repository.resolveReviewQueueItem({
      id,
      actorUserId: actor.domainUserId,
      action: input.action,
      note: input.note
    });

    if (reviewItem === "conflict") {
      return {
        ok: false as const,
        reason: "music_review_conflict" as const
      };
    }

    return reviewItem
      ? { ok: true as const, reviewItem }
      : { ok: false as const, reason: "music_not_found" as const };
  }
}
