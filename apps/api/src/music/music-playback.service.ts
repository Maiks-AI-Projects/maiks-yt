import { randomUUID } from "node:crypto";

import { decideMusicTrackSelection } from "@maiks-yt/domain/music";

import { requireMusicPlayControlActor } from "./music-service-authorization.service.js";
import { safeHttpUrlOrNull } from "./music-service-catalog.service.js";
import type { MusicService } from "./music.service.js";
import type { MusicPlayHistoryRecord, MusicPlaylistRecord, MusicSelectableTrack } from "./music.types.js";
import type { MusicRepository } from "./music-repository.types.js";

export type MusicPlaybackStatus = "idle" | "loading" | "playing" | "paused" | "blocked" | "error";
export type MusicPlaybackControlAction = "play" | "pause" | "skip";
export type MusicPlaybackPlayerEvent = "started" | "ended" | "failed";

export type MusicPlaybackPublicTrack = {
  trackId: string;
  sourceId: string;
  title: string;
  artist: string;
  durationSeconds: number | null;
  providerKey: string;
  providerName: string;
  sourceLabel: string;
  attributionText: string | null;
  licenseName: string;
  licenseKind: string;
};

export type MusicPlaybackSnapshot = {
  ok: true;
  status: MusicPlaybackStatus;
  playbackId: string | null;
  currentTrack: MusicPlaybackPublicTrack | null;
  audioUrl: string | null;
  startedAt: string | null;
  updatedAt: string;
  player: {
    connected: boolean;
    owned: boolean;
    blockedReason: string | null;
  };
  reason: string | null;
};

type ActivePlayback = {
  playbackId: string;
  authUserId: string;
  track: MusicSelectableTrack;
  playlistId: string | null;
  requestId: string | null;
  streamSessionId: string | null;
  status: Exclude<MusicPlaybackStatus, "idle" | "blocked">;
  queuedAt: Date;
  startedAt: Date | null;
  lastPositionSeconds: number | null;
  reason: string | null;
};

type PlayerLease = {
  clientId: string;
  expiresAt: Date;
};

const playerLeaseTtlMs = 15_000;
const playbackCatalogLimit = 200;
const recentHistoryLimit = 50;

const toPublicTrack = (track: MusicSelectableTrack): MusicPlaybackPublicTrack => ({
  trackId: track.trackId,
  sourceId: track.sourceId,
  title: track.title,
  artist: track.artist,
  durationSeconds: track.durationSeconds,
  providerKey: track.providerKey,
  providerName: track.providerName,
  sourceLabel: track.sourceLabel,
  attributionText: track.attributionText,
  licenseName: track.licenseName,
  licenseKind: track.licenseKind
});

const isApprovedPlaylist = (playlist: MusicPlaylistRecord): boolean =>
  playlist.reviewState === "approved";

const isPlayableSource = (track: MusicSelectableTrack): boolean => {
  if (track.sourceType === "local_audio") {
    return Boolean(track.sourceStorageRef && track.sourceSha256);
  }

  return Boolean(safeHttpUrlOrNull(track.sourceUrl));
};

const durationFromPosition = (positionSeconds: number | null, startedAt: Date | null, endedAt: Date): number | null => {
  if (typeof positionSeconds === "number" && Number.isFinite(positionSeconds) && positionSeconds >= 0) {
    return Math.max(0, Math.round(positionSeconds));
  }

  if (!startedAt) {
    return null;
  }

  return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));
};

const sortPlaylistTracks = (playlists: readonly MusicPlaylistRecord[]): readonly {
  playlistId: string;
  sortOrder: number;
  trackId: string;
}[] => playlists
  .filter(isApprovedPlaylist)
  .sort((left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id))
  .flatMap((playlist) => [...playlist.tracks]
    .sort((left, right) => left.sortOrder - right.sortOrder || left.trackId.localeCompare(right.trackId))
    .map((track) => ({
      playlistId: playlist.id,
      sortOrder: track.sortOrder,
      trackId: track.trackId
    })));

export class MusicPlaybackService {
  private current: ActivePlayback | null = null;
  private playerLease: PlayerLease | null = null;
  private reason: string | null = null;

  public constructor(
    private readonly repository: MusicRepository,
    private readonly historyService: Pick<MusicService, "appendPlayHistory">,
    private readonly options: {
      getNow?: () => Date;
    } = {}
  ) {}

  public async getControlState(authUserId: string): Promise<MusicPlaybackSnapshot | {
    ok: false;
    reason: "music_play_control_user_unlinked" | "music_play_control_forbidden";
  }> {
    const actor = await requireMusicPlayControlActor(this.repository, authUserId);

    if (!actor.ok) {
      return actor;
    }

    return this.snapshot({ clientId: null, audioUrl: null });
  }

  public async control(input: {
    action: MusicPlaybackControlAction;
    authUserId: string;
  }): Promise<MusicPlaybackSnapshot | {
    ok: false;
    reason: "music_play_control_user_unlinked" | "music_play_control_forbidden" | "music_play_control_unavailable";
  }> {
    const actor = await requireMusicPlayControlActor(this.repository, input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (input.action === "pause") {
      if (this.current && (this.current.status === "playing" || this.current.status === "loading")) {
        this.current.status = "paused";
        this.current.reason = null;
      }

      return this.snapshot({ clientId: null, audioUrl: null });
    }

    if (input.action === "skip") {
      const skippedTrackId = this.current?.track.trackId ?? null;
      await this.finishCurrent({
        outcome: "skipped",
        outcomeReason: "owner_skip",
        positionSeconds: this.current?.lastPositionSeconds ?? null
      });
      await this.startNext(input.authUserId, skippedTrackId ? new Set([skippedTrackId]) : new Set());

      return this.snapshot({ clientId: null, audioUrl: null });
    }

    if (this.current?.status === "paused") {
      this.current.status = "playing";
      this.current.reason = null;
      return this.snapshot({ clientId: null, audioUrl: null });
    }

    if (!this.current || this.current.status === "error") {
      await this.startNext(input.authUserId);
    }

    return this.snapshot({ clientId: null, audioUrl: null });
  }

  public getPlayerState(input: {
    clientId: string;
    createAudioUrl: (playbackId: string, track: MusicSelectableTrack) => string | null;
    positionSeconds?: number | null;
  }): MusicPlaybackSnapshot {
    const now = this.now();

    if (this.current && typeof input.positionSeconds === "number" && Number.isFinite(input.positionSeconds)) {
      this.current.lastPositionSeconds = Math.max(0, input.positionSeconds);
    }

    if (!this.playerLease || this.playerLease.expiresAt <= now || this.playerLease.clientId === input.clientId) {
      this.playerLease = {
        clientId: input.clientId,
        expiresAt: new Date(now.getTime() + playerLeaseTtlMs)
      };

      return this.snapshot({
        clientId: input.clientId,
        audioUrl: this.current ? input.createAudioUrl(this.current.playbackId, this.current.track) : null
      });
    }

    return {
      ...this.snapshot({ clientId: input.clientId, audioUrl: null }),
      status: "blocked",
      player: {
        connected: true,
        owned: false,
        blockedReason: "music_player_already_connected"
      }
    };
  }

  public async recordPlayerEvent(input: {
    clientId: string;
    event: MusicPlaybackPlayerEvent;
    playbackId: string;
    positionSeconds: number | null;
  }): Promise<MusicPlaybackSnapshot | {
    ok: false;
    reason: "music_player_not_active" | "music_player_lease_conflict";
  }> {
    if (!this.current || this.current.playbackId !== input.playbackId) {
      return {
        ok: false,
        reason: "music_player_not_active"
      };
    }

    if (this.playerLease?.clientId !== input.clientId) {
      return {
        ok: false,
        reason: "music_player_lease_conflict"
      };
    }

    if (typeof input.positionSeconds === "number" && Number.isFinite(input.positionSeconds)) {
      this.current.lastPositionSeconds = Math.max(0, input.positionSeconds);
    }

    if (input.event === "started") {
      this.current.startedAt ??= this.now();
      this.current.status = "playing";
      this.current.reason = null;
      return this.snapshot({ clientId: input.clientId, audioUrl: null });
    }

    if (input.event === "failed") {
      await this.finishCurrent({
        outcome: "failed",
        outcomeReason: "audio_element_error",
        positionSeconds: input.positionSeconds
      });
      return this.snapshot({ clientId: input.clientId, audioUrl: null });
    }

    const authUserId = this.current.authUserId;
    await this.finishCurrent({
      outcome: "played-full",
      outcomeReason: null,
      positionSeconds: input.positionSeconds
    });
    await this.startNext(authUserId);

    return this.snapshot({ clientId: input.clientId, audioUrl: null });
  }

  public getCurrentAudioTrack(playbackId: string): MusicSelectableTrack | null {
    return this.current?.playbackId === playbackId ? this.current.track : null;
  }

  private async startNext(authUserId: string, excludedTrackIds: ReadonlySet<string> = new Set()): Promise<void> {
    const selected = await this.selectNextTrack(excludedTrackIds);

    if (!selected) {
      this.current = null;
      this.reason = "music_no_playable_tracks";
      return;
    }

    this.current = {
      playbackId: randomUUID(),
      authUserId,
      track: selected.track,
      playlistId: selected.playlistId,
      requestId: null,
      streamSessionId: null,
      status: "loading",
      queuedAt: this.now(),
      startedAt: null,
      lastPositionSeconds: null,
      reason: null
    };
    this.reason = null;
  }

  private async selectNextTrack(excludedTrackIds: ReadonlySet<string>): Promise<{
    track: MusicSelectableTrack;
    playlistId: string | null;
  } | null> {
    const [catalog, playlists, history] = await Promise.all([
      this.repository.listPlaybackCatalog({ context: "live", limit: playbackCatalogLimit }),
      this.repository.listPlaylists(),
      this.repository.listPlayHistory(recentHistoryLimit)
    ]);
    const candidates = catalog
      .filter((track) => decideMusicTrackSelection(track, "live").ok && isPlayableSource(track))
      .filter((track) => !excludedTrackIds.has(track.trackId));

    if (candidates.length === 0) {
      return null;
    }

    const recentTracks = new Set(history
      .map((record: MusicPlayHistoryRecord) => record.trackId)
      .filter((trackId): trackId is string => Boolean(trackId)));
    const playlistOrder = new Map<string, { playlistId: string; sortOrder: number; index: number }>();
    sortPlaylistTracks(playlists).forEach((entry, index) => {
      playlistOrder.set(entry.trackId, {
        playlistId: entry.playlistId,
        sortOrder: entry.sortOrder,
        index
      });
    });

    const sorted = [...candidates].sort((left, right) => {
      const leftPlaylist = playlistOrder.get(left.trackId);
      const rightPlaylist = playlistOrder.get(right.trackId);
      const leftRecent = recentTracks.has(left.trackId) ? 1 : 0;
      const rightRecent = recentTracks.has(right.trackId) ? 1 : 0;

      return leftRecent - rightRecent
        || (leftPlaylist ? 0 : 1) - (rightPlaylist ? 0 : 1)
        || (leftPlaylist?.sortOrder ?? Number.MAX_SAFE_INTEGER) - (rightPlaylist?.sortOrder ?? Number.MAX_SAFE_INTEGER)
        || (leftPlaylist?.index ?? Number.MAX_SAFE_INTEGER) - (rightPlaylist?.index ?? Number.MAX_SAFE_INTEGER)
        || left.title.localeCompare(right.title)
        || left.artist.localeCompare(right.artist)
        || left.sourceId.localeCompare(right.sourceId);
    });
    const track = sorted[0];

    return track
      ? {
        track,
        playlistId: playlistOrder.get(track.trackId)?.playlistId ?? null
      }
      : null;
  }

  private async finishCurrent(input: {
    outcome: "played-full" | "skipped" | "failed";
    outcomeReason: string | null;
    positionSeconds: number | null;
  }): Promise<void> {
    const current = this.current;

    if (!current) {
      return;
    }

    const endedAt = this.now();
    const startedAt = current.startedAt;

    this.current = null;

    if (!startedAt) {
      this.reason = input.outcome === "failed" ? "music_audio_failed_before_start" : null;
      return;
    }

    const result = await this.historyService.appendPlayHistory(current.authUserId, {
      trackId: current.track.trackId,
      sourceId: current.track.sourceId,
      requestId: current.requestId,
      playlistId: current.playlistId,
      streamSessionId: current.streamSessionId,
      startedAt,
      endedAt,
      outcome: input.outcome,
      outcomeReason: input.outcomeReason,
      durationPlayedSeconds: durationFromPosition(input.positionSeconds, startedAt, endedAt),
      publicVisible: true
    });

    if (!result.ok) {
      this.reason = "music_history_write_failed";
    }
  }

  private snapshot(input: {
    clientId: string | null;
    audioUrl: string | null;
  }): MusicPlaybackSnapshot {
    const owned = Boolean(input.clientId && this.playerLease?.clientId === input.clientId);

    return {
      ok: true,
      status: this.current?.status ?? "idle",
      playbackId: this.current?.playbackId ?? null,
      currentTrack: this.current ? toPublicTrack(this.current.track) : null,
      audioUrl: owned || !input.clientId ? input.audioUrl : null,
      startedAt: this.current?.startedAt?.toISOString() ?? null,
      updatedAt: this.now().toISOString(),
      player: {
        connected: Boolean(this.playerLease && this.playerLease.expiresAt > this.now()),
        owned,
        blockedReason: null
      },
      reason: this.current?.reason ?? this.reason
    };
  }

  private now(): Date {
    return this.options.getNow?.() ?? new Date();
  }
}
