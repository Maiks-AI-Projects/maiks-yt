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

  it("selects an explicit catalog track and keeps the chosen audio route in state", async () => {
    const repository = new PlaybackRepository();
    repository.catalog = [
      createSelectableTrack("first"),
      createSelectableTrack("second")
    ];
    const { service } = createPlayback(repository);

    const selected = await service.control({
      action: "select",
      audioRouteId: "game",
      authUserId: "owner",
      trackId: "second"
    });

    expect(selected.ok ? selected.currentTrack?.trackId : null).toBe("second");
    expect(selected.ok ? selected.audioRouteId : null).toBe("game");
    expect(selected.ok ? selected.audioRoutes.map((route) => [route.id, route.pipeWireSink]) : []).toEqual([
      ["communication", "stream_communication"],
      ["music", "stream_music"],
      ["private", "stream_private"],
      ["game", "stream_game"]
    ]);
  });

  it("selects an audio route without changing catalog playback or history", async () => {
    const repository = new PlaybackRepository();
    repository.catalog = [createSelectableTrack("first")];
    const { historyService, service } = createPlayback(repository);

    await service.control({ action: "play", authUserId: "owner" });
    const routed = await service.control({
      action: "route.select",
      audioRouteId: "communication",
      authUserId: "owner"
    });

    expect(routed.ok ? routed.currentTrack?.trackId : null).toBe("first");
    expect(routed.ok ? routed.audioRouteId : null).toBe("communication");
    expect(historyService.appended).toHaveLength(0);
  });

  it("reports unsupported explicit selection and resume cases without fabricating playback", async () => {
    const repository = new PlaybackRepository();
    repository.catalog = [
      createSelectableTrack("blocked", { liveSafe: false })
    ];
    const { service } = createPlayback(repository);

    const missingSelection = await service.control({ action: "select", authUserId: "owner" });
    expect(missingSelection.ok ? missingSelection.reason : null).toBe("music_track_selection_required");
    expect(missingSelection.ok ? missingSelection.currentTrack : "unexpected").toBeNull();

    const blockedSelection = await service.control({ action: "select", authUserId: "owner", trackId: "blocked" });
    expect(blockedSelection.ok ? blockedSelection.reason : null).toBe("music_selected_track_not_playable");
    expect(blockedSelection.ok ? blockedSelection.currentTrack : "unexpected").toBeNull();

    const resume = await service.control({ action: "resume", authUserId: "owner" });
    expect(resume.ok ? resume.reason : null).toBe("music_resume_without_paused_track");
    expect(resume.ok ? resume.currentTrack : "unexpected").toBeNull();
  });

  it("stops current playback without selecting the next track", async () => {
    const repository = new PlaybackRepository();
    repository.catalog = [
      createSelectableTrack("first"),
      createSelectableTrack("second")
    ];
    const { historyService, service } = createPlayback(repository);

    await service.control({ action: "play", authUserId: "owner" });
    const playerState = service.getPlayerState({
      clientId: "obs-player",
      createAudioUrl: (playbackId) => `https://api.example.test/music/playback/audio/${playbackId}`
    });
    await service.recordPlayerEvent({
      clientId: "obs-player",
      event: "started",
      playbackId: playerState.playbackId!,
      positionSeconds: 0
    });
    const stopped = await service.control({ action: "stop", authUserId: "owner" });
    const idlePlayer = service.getPlayerState({
      clientId: "obs-player",
      createAudioUrl: (playbackId) => `https://api.example.test/music/playback/audio/${playbackId}`
    });

    expect(stopped.ok ? stopped.currentTrack : "unexpected").toBeNull();
    expect(idlePlayer).toMatchObject({
      audioUrl: null,
      currentTrack: null,
      playbackId: null,
      player: {
        authority: "none",
        connected: false,
        owned: false,
        state: "idle"
      },
      status: "idle"
    });
    expect(historyService.appended).toEqual([{
      outcome: "stopped",
      trackId: "first",
      durationPlayedSeconds: 0
    }]);
  });

  it("does not let idle browser-player polling claim fallback authority", () => {
    const repository = new PlaybackRepository();
    const { service } = createPlayback(repository);

    const idlePlayer = service.getPlayerState({
      clientId: "obs-player",
      createAudioUrl: (playbackId) => `https://api.example.test/music/playback/audio/${playbackId}`,
      playerKind: "browser-fallback"
    });

    expect(idlePlayer).toMatchObject({
      audioUrl: null,
      currentTrack: null,
      playbackId: null,
      player: {
        authority: "none",
        connected: false,
        kind: "browser-fallback",
        owned: false,
        state: "idle"
      },
      status: "idle"
    });
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

  it("lets a healthy Local Agent preempt an existing browser lease without changing selection or history", async () => {
    const repository = new PlaybackRepository();
    repository.catalog = [createSelectableTrack("track")];
    const { historyService, service } = createPlayback(repository);

    const loaded = await service.control({ action: "play", authUserId: "owner" });
    const browser = service.getPlayerState({
      clientId: "obs-browser-player",
      createAudioUrl: (playbackId) => `https://api.example.test/music/playback/audio/${playbackId}`,
      playerKind: "browser-fallback"
    });
    service.setAuthoritativePlayer({
      clientId: "local-agent-vlc",
      healthyUntil: "2026-08-20T12:00:30.000Z"
    });
    const localAgent = service.getPlayerState({
      clientId: "local-agent-vlc",
      createAudioUrl: (playbackId) => `https://api.example.test/music/playback/audio/${playbackId}`,
      playerKind: "local-agent"
    });
    const blockedBrowser = service.getPlayerState({
      clientId: "obs-browser-player",
      createAudioUrl: (playbackId) => `https://api.example.test/music/playback/audio/${playbackId}`,
      playerKind: "browser-fallback"
    });
    const spoofedBrowser = service.getPlayerState({
      clientId: "local-agent-vlc",
      createAudioUrl: (playbackId) => `https://api.example.test/music/playback/audio/${playbackId}`,
      playerKind: "browser-fallback"
    });

    expect(browser.player.owned).toBe(true);
    expect(localAgent.player).toMatchObject({
      kind: "local-agent",
      owned: true,
      state: "pending"
    });
    expect(localAgent.playbackId).toBe(loaded.ok ? loaded.playbackId : null);
    expect(blockedBrowser).toMatchObject({
      status: "blocked",
      audioUrl: null,
      player: {
        authority: "local-agent",
        blockedReason: "music_local_agent_authoritative",
        owned: false
      }
    });
    expect(spoofedBrowser.player).toMatchObject({
      blockedReason: "music_local_agent_authoritative",
      owned: false,
      state: "blocked"
    });
    expect(historyService.appended).toHaveLength(0);
  });

  it("rejects an intervening browser event while Local Agent play readiness is pending, then allows fallback after explicit failure", async () => {
    const repository = new PlaybackRepository();
    repository.catalog = [createSelectableTrack("track")];
    const { historyService, service } = createPlayback(repository);

    const loaded = await service.control({ action: "play", authUserId: "owner" });
    expect(loaded.ok).toBe(true);
    const playbackId = loaded.ok ? loaded.playbackId! : "unexpected";
    const browser = service.getPlayerState({
      clientId: "obs-browser-player",
      createAudioUrl: (id) => `https://api.example.test/music/playback/audio/${id}`,
      playerKind: "browser-fallback"
    });
    expect(browser.player.owned).toBe(true);

    service.setAuthoritativePlayer({
      clientId: "local-agent-vlc",
      healthyUntil: "2026-08-20T12:00:30.000Z"
    });
    const interveningBrowserEvent = await service.recordPlayerEvent({
      clientId: "obs-browser-player",
      event: "started",
      playbackId,
      positionSeconds: 0
    });
    const localAgentPending = service.getPlayerState({
      clientId: "local-agent-vlc",
      createAudioUrl: (id) => `https://api.example.test/music/playback/audio/${id}`,
      playerKind: "local-agent"
    });

    expect(interveningBrowserEvent).toEqual({
      ok: false,
      reason: "music_player_lease_conflict"
    });
    expect(localAgentPending.player).toMatchObject({
      authority: "local-agent",
      owned: true,
      state: "pending"
    });
    expect(historyService.appended).toHaveLength(0);

    service.failAuthoritativePlayer("local-agent-vlc", "music_local_agent_play_failed");
    const fallback = service.getPlayerState({
      clientId: "obs-browser-player",
      createAudioUrl: (id) => `https://api.example.test/music/playback/audio/${id}`,
      playerKind: "browser-fallback"
    });
    const fallbackStarted = await service.recordPlayerEvent({
      clientId: "obs-browser-player",
      event: "started",
      playbackId,
      positionSeconds: 0
    });

    expect(fallback.player).toMatchObject({
      authority: "browser-fallback",
      owned: true,
      state: "fallback"
    });
    expect(fallbackStarted).toMatchObject({ ok: true, status: "playing" });
    expect(historyService.appended).toHaveLength(0);
  });

  it("allows truthful browser fallback after the Local Agent fails or its authority expires", async () => {
    const repository = new PlaybackRepository();
    repository.catalog = [createSelectableTrack("track")];
    let now = new Date("2026-08-20T12:00:00.000Z");
    const historyService = new PlaybackHistoryService();
    const service = new MusicPlaybackService(
      repository as unknown as MusicRepository,
      historyService,
      { getNow: () => now }
    );
    await service.control({ action: "play", authUserId: "owner" });
    service.setAuthoritativePlayer({
      clientId: "local-agent-vlc",
      healthyUntil: "2026-08-20T12:00:15.000Z"
    });

    const blocked = service.getPlayerState({
      clientId: "obs-browser-player",
      createAudioUrl: (playbackId) => `https://api.example.test/music/playback/audio/${playbackId}`,
      playerKind: "browser-fallback"
    });
    expect(blocked.player.blockedReason).toBe("music_local_agent_authoritative");

    service.failAuthoritativePlayer("local-agent-vlc", "music_local_agent_play_failed");
    const failedFallback = service.getPlayerState({
      clientId: "obs-browser-player",
      createAudioUrl: (playbackId) => `https://api.example.test/music/playback/audio/${playbackId}`,
      playerKind: "browser-fallback"
    });
    expect(failedFallback.player).toMatchObject({
      authority: "browser-fallback",
      kind: "browser-fallback",
      owned: true,
      state: "fallback"
    });
    expect(failedFallback.reason).toBe("music_local_agent_play_failed");

    service.releasePlayerLease("obs-browser-player");
    service.setAuthoritativePlayer({
      clientId: "local-agent-vlc",
      healthyUntil: "2026-08-20T12:00:15.000Z"
    });
    now = new Date("2026-08-20T12:00:16.000Z");
    const expiredFallback = service.getPlayerState({
      clientId: "obs-browser-player",
      createAudioUrl: (playbackId) => `https://api.example.test/music/playback/audio/${playbackId}`,
      playerKind: "browser-fallback"
    });
    expect(expiredFallback.player).toMatchObject({
      authority: "browser-fallback",
      owned: true,
      state: "fallback"
    });
    expect(expiredFallback.currentTrack?.trackId).toBe("track");
    expect(historyService.appended).toHaveLength(0);
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
