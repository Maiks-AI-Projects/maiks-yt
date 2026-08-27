import { describe, expect, it } from "vitest";

import { MusicPlaybackService } from "../../src/music/music-playback.service.js";
import type {
  MusicActor,
  MusicPlaybackOutcomeInput,
  MusicPlayHistoryAppendResult,
  MusicPlayHistoryRecord,
  MusicPlaylistRecord,
  MusicRepository,
  MusicSelectableTrack
} from "../../src/music/index.js";

const createSelectableTrack = (
  id: string,
  overrides: Partial<MusicSelectableTrack> = {}
): MusicSelectableTrack => ({
  id,
  trackId: id,
  sourceId: `${id}-source`,
  title: `Track ${id}`,
  artist: "Artist",
  durationSeconds: 180,
  providerKey: "youtube-audio-library",
  providerName: "YouTube Audio Library",
  sourceType: "local_audio",
  sourceLabel: "Imported audio",
  sourceExternalId: `external-${id}`,
  previewUrl: null,
  previewMimeType: null,
  sourceUrl: null,
  sourceStorageRef: `music-audio:${"a".repeat(64)}:${id}.mp3`,
  sourceSha256: "a".repeat(64),
  safetyTags: [],
  explicitContent: false,
  instrumental: true,
  attributionText: "Artist via YouTube Audio Library",
  licenseName: "YouTube Audio Library",
  licenseKind: "platform-library",
  licenseUrl: null,
  providerPolicyUrl: null,
  providerTermsUrl: null,
  providerPolicyState: "allowed",
  eligibilityState: "eligible",
  reviewState: "approved",
  liveSafe: true,
  vodSafe: true,
  hasActiveBlacklist: false,
  ...overrides
});

class PlaybackRepository {
  public actor: MusicActor | null = {
    domainUserId: "domain-owner",
    rolePermissionValues: [["music:play-control"]]
  };
  public catalog: MusicSelectableTrack[] = [];
  public playlists: MusicPlaylistRecord[] = [];
  public history: MusicPlayHistoryRecord[] = [];

  public async resolveActor(): Promise<MusicActor | null> {
    return this.actor;
  }

  public async listPlaybackCatalog(): Promise<readonly MusicSelectableTrack[]> {
    return this.catalog.map((track) => structuredClone(track));
  }

  public async listPlaylists(): Promise<readonly MusicPlaylistRecord[]> {
    return this.playlists.map((playlist) => structuredClone(playlist));
  }

  public async listPlayHistory(): Promise<readonly MusicPlayHistoryRecord[]> {
    return this.history.map((record) => structuredClone(record));
  }
}

class PlaybackHistoryService {
  public readonly appended: Array<{
    outcome: MusicPlaybackOutcomeInput;
    trackId: string;
    durationPlayedSeconds: number | null;
  }> = [];

  public async appendPlayHistory(_authUserId: string, input: {
    trackId: string;
    outcome: MusicPlaybackOutcomeInput;
    durationPlayedSeconds: number | null;
  }): Promise<MusicPlayHistoryAppendResult> {
    this.appended.push({
      outcome: input.outcome,
      trackId: input.trackId,
      durationPlayedSeconds: input.durationPlayedSeconds
    });

    return {
      ok: true,
      history: {
        id: `history-${this.appended.length}`,
        trackId: input.trackId,
        outcome: input.outcome === "played-full" ? "played" : input.outcome
      } as MusicPlayHistoryRecord,
      reviewQueued: input.outcome === "skipped"
    };
  }
}

const createPlayback = (repository: PlaybackRepository): {
  historyService: PlaybackHistoryService;
  service: MusicPlaybackService;
} => {
  const historyService = new PlaybackHistoryService();

  return {
    historyService,
    service: new MusicPlaybackService(
      repository as unknown as MusicRepository,
      historyService,
      { getNow: () => new Date("2026-08-20T12:00:00.000Z") }
    )
  };
};

describe("MusicPlaybackService", () => {
  it("rejects blacklisted and otherwise ineligible tracks before playback starts", async () => {
    const repository = new PlaybackRepository();
    repository.catalog = [
      createSelectableTrack("blacklisted", { hasActiveBlacklist: true }),
      createSelectableTrack("ineligible", { eligibilityState: "ineligible" })
    ];
    const { service } = createPlayback(repository);

    const state = await service.control({ action: "play", authUserId: "owner" });

    expect(state.ok).toBe(true);
    expect(state.ok ? state.currentTrack : null).toBeNull();
    expect(state.ok ? state.reason : null).toBe("music_no_playable_tracks");
  });

  it("uses approved playlist order deterministically before catalog fallback", async () => {
    const repository = new PlaybackRepository();
    repository.catalog = [
      createSelectableTrack("catalog-a", { title: "A catalog track" }),
      createSelectableTrack("playlist-b", { title: "B playlist track" })
    ];
    repository.playlists = [{
      id: "playlist",
      slug: "stream",
      title: "Stream",
      description: null,
      visibility: "private",
      reviewState: "approved",
      createdAt: "2026-08-20T10:00:00.000Z",
      updatedAt: "2026-08-20T10:00:00.000Z",
      tracks: [{ trackId: "playlist-b", sortOrder: 1 }]
    }];
    const { service } = createPlayback(repository);

    const state = await service.control({ action: "play", authUserId: "owner" });

    expect(state.ok ? state.currentTrack?.trackId : null).toBe("playlist-b");
  });

  it("keeps history truthful across play, pause, resume, and skip", async () => {
    const repository = new PlaybackRepository();
    repository.catalog = [
      createSelectableTrack("first"),
      createSelectableTrack("second")
    ];
    const { historyService, service } = createPlayback(repository);

    const loaded = await service.control({ action: "play", authUserId: "owner" });
    expect(loaded.ok ? loaded.status : null).toBe("loading");
    expect(historyService.appended).toHaveLength(0);

    const playerState = service.getPlayerState({
      clientId: "obs-player",
      createAudioUrl: (playbackId) => `https://api.example.test/music/playback/audio/${playbackId}`
    });
    expect(playerState.audioUrl).toContain("/music/playback/audio/");
    await service.recordPlayerEvent({
      clientId: "obs-player",
      event: "started",
      playbackId: playerState.playbackId!,
      positionSeconds: 0
    });
    expect(historyService.appended).toHaveLength(0);

    const paused = await service.control({ action: "pause", authUserId: "owner" });
    expect(paused.ok ? paused.status : null).toBe("paused");
    const resumed = await service.control({ action: "play", authUserId: "owner" });
    expect(resumed.ok ? resumed.status : null).toBe("playing");

    const skipped = await service.control({ action: "skip", authUserId: "owner" });

    expect(historyService.appended).toEqual([{
      outcome: "skipped",
      trackId: "first",
      durationPlayedSeconds: 0
    }]);
    expect(skipped.ok ? skipped.currentTrack?.trackId : null).toBe("second");
  });

  it("dedupes active OBS players while allowing same-client reload", async () => {
    const repository = new PlaybackRepository();
    repository.catalog = [createSelectableTrack("track")];
    const { service } = createPlayback(repository);

    await service.control({ action: "play", authUserId: "owner" });
    const first = service.getPlayerState({
      clientId: "obs-player-a",
      createAudioUrl: (playbackId) => `https://api.example.test/music/playback/audio/${playbackId}`
    });
    const second = service.getPlayerState({
      clientId: "obs-player-b",
      createAudioUrl: (playbackId) => `https://api.example.test/music/playback/audio/${playbackId}`
    });
    const reload = service.getPlayerState({
      clientId: "obs-player-a",
      createAudioUrl: (playbackId) => `https://api.example.test/music/playback/audio/${playbackId}`
    });

    expect(first.status).toBe("loading");
    expect(second.status).toBe("blocked");
    expect(second.audioUrl).toBeNull();
    expect(reload.playbackId).toBe(first.playbackId);
    expect(reload.audioUrl).toBe(first.audioUrl);
  });

  it("writes played history only after a started track ends", async () => {
    const repository = new PlaybackRepository();
    repository.catalog = [createSelectableTrack("track")];
    const { historyService, service } = createPlayback(repository);

    await service.control({ action: "play", authUserId: "owner" });
    const playerState = service.getPlayerState({
      clientId: "obs-player",
      createAudioUrl: (playbackId) => `https://api.example.test/music/playback/audio/${playbackId}`
    });

    expect(historyService.appended).toHaveLength(0);
    await service.recordPlayerEvent({
      clientId: "obs-player",
      event: "started",
      playbackId: playerState.playbackId!,
      positionSeconds: 0
    });
    expect(historyService.appended).toHaveLength(0);
    await service.recordPlayerEvent({
      clientId: "obs-player",
      event: "ended",
      playbackId: playerState.playbackId!,
      positionSeconds: 179
    });

    expect(historyService.appended).toEqual([{
      outcome: "played-full",
      trackId: "track",
      durationPlayedSeconds: 179
    }]);
  });

  it("keeps failure states sanitized and avoids history when audio never started", async () => {
    const repository = new PlaybackRepository();
    repository.catalog = [createSelectableTrack("track")];
    const { historyService, service } = createPlayback(repository);

    await service.control({ action: "play", authUserId: "owner" });
    const playerState = service.getPlayerState({
      clientId: "obs-player",
      createAudioUrl: (playbackId) => `https://api.example.test/music/playback/audio/${playbackId}`
    });
    const failed = await service.recordPlayerEvent({
      clientId: "obs-player",
      event: "failed",
      playbackId: playerState.playbackId!,
      positionSeconds: null
    });

    expect(historyService.appended).toHaveLength(0);
    expect(failed.ok ? failed.reason : null).toBe("music_audio_failed_before_start");
    expect(failed.ok ? failed.currentTrack : "unexpected").toBeNull();
  });
});
