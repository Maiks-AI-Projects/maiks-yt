import { randomUUID } from "node:crypto";

import { decideMusicTrackSelection } from "@maiks-yt/domain/music";
import {
  DEFAULT_LOCAL_AGENT_AUDIO_ROUTE_ID,
  localAgentAudioRouteDefinitions,
  type LocalAgentAudioRouteId,
  type LocalAgentAudioRouteStatus
} from "@maiks-yt/events";

import { requireMusicPlayControlActor } from "./music-service-authorization.service.js";
import { safeHttpUrlOrNull } from "./music-service-catalog.service.js";
import type { MusicService } from "./music.service.js";
import type { MusicPlayHistoryRecord, MusicPlaylistRecord, MusicSelectableTrack } from "./music.types.js";
import type { MusicRepository } from "./music-repository.types.js";

export type MusicPlaybackStatus = "idle" | "loading" | "playing" | "paused" | "blocked" | "error";
export type MusicPlaybackControlAction =
  | "play"
  | "pause"
  | "resume"
  | "stop"
  | "next"
  | "skip"
  | "select"
  | "route.mute.set"
  | "route.select"
  | "route.volume.set";
export type MusicPlaybackPlayerEvent = "started" | "ended" | "failed";
export type MusicPlaybackPlayerKind = "browser-fallback" | "local-agent";
export type MusicPlaybackPlayerState = "idle" | "pending" | "active" | "blocked" | "fallback" | "error" | "unavailable";
export type MusicPlaybackCommandOutcome = {
  action: "track.play";
  acknowledgedAt: string | null;
  error: string | null;
  eventId: string | null;
  status: "pending" | "succeeded" | "failed" | "rejected" | "expired";
};
export type MusicPlaybackControlFailure = {
  ok: false;
  reason: "music_play_control_user_unlinked" | "music_play_control_forbidden" | "music_play_control_unavailable";
};

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
  audioRouteId: LocalAgentAudioRouteId;
  audioRoutes: readonly LocalAgentAudioRouteStatus[];
  playbackId: string | null;
  currentTrack: MusicPlaybackPublicTrack | null;
  audioUrl: string | null;
  startedAt: string | null;
  updatedAt: string;
  player: {
    authority: MusicPlaybackPlayerKind | "none";
    connected: boolean;
    kind: MusicPlaybackPlayerKind | null;
    lastCommand: MusicPlaybackCommandOutcome | null;
    owned: boolean;
    blockedReason: string | null;
    state: MusicPlaybackPlayerState;
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
  kind: MusicPlaybackPlayerKind;
};

type AuthoritativePlayer = {
  clientId: string;
  healthyUntil: Date;
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
  private authoritativePlayer: AuthoritativePlayer | null = null;
  private playerLease: PlayerLease | null = null;
  private reason: string | null = null;
  private audioRouteId: LocalAgentAudioRouteId = DEFAULT_LOCAL_AGENT_AUDIO_ROUTE_ID;

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
    audioRouteId?: LocalAgentAudioRouteId | undefined;
    authUserId: string;
    trackId?: string | undefined;
  }): Promise<MusicPlaybackSnapshot | MusicPlaybackControlFailure> {
    const actor = await requireMusicPlayControlActor(this.repository, input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (input.action === "route.volume.set" || input.action === "route.mute.set") {
      this.reason = "music_local_agent_unavailable";
      return this.snapshot({ clientId: null, audioUrl: null });
    }

    if (input.audioRouteId) {
      this.audioRouteId = input.audioRouteId;
    }

    if (input.action === "route.select") {
      this.reason = null;
      return this.snapshot({ clientId: null, audioUrl: null });
    }

    if (input.action === "pause") {
      if (this.current && (this.current.status === "playing" || this.current.status === "loading")) {
        this.current.status = "paused";
        this.current.reason = null;
      }

      return this.snapshot({ clientId: null, audioUrl: null });
    }

    if (input.action === "resume") {
      if (this.current?.status === "paused") {
        this.current.status = "playing";
        this.current.reason = null;
        this.reason = null;
      } else {
        this.reason = "music_resume_without_paused_track";
      }

      return this.snapshot({ clientId: null, audioUrl: null });
    }

    if (input.action === "stop") {
      await this.finishCurrent({
        outcome: "stopped",
        outcomeReason: "owner_stop",
        positionSeconds: this.current?.lastPositionSeconds ?? null
      });

      return this.snapshot({ clientId: null, audioUrl: null });
    }

    if (input.action === "next" || input.action === "skip") {
      const skippedTrackId = this.current?.track.trackId ?? null;
      await this.finishCurrent({
        outcome: "skipped",
        outcomeReason: "owner_skip",
        positionSeconds: this.current?.lastPositionSeconds ?? null
      });
      await this.startNext(input.authUserId, skippedTrackId ? new Set([skippedTrackId]) : new Set());

      return this.snapshot({ clientId: null, audioUrl: null });
    }

    if (input.action === "select") {
      if (!input.trackId) {
        this.reason = "music_track_selection_required";
        return this.snapshot({ clientId: null, audioUrl: null });
      }

      const selected = await this.selectTrack(input.trackId);
      if (!selected) {
        return this.snapshot({ clientId: null, audioUrl: null });
      }

      await this.finishCurrent({
        outcome: "skipped",
        outcomeReason: "owner_select",
        positionSeconds: this.current?.lastPositionSeconds ?? null
      });
      this.startPlayback(input.authUserId, selected);

      return this.snapshot({ clientId: null, audioUrl: null });
    }

    if (this.current?.status === "paused") {
      this.current.status = "playing";
      this.current.reason = null;
      this.reason = null;
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
    playerKind?: MusicPlaybackPlayerKind | undefined;
    positionSeconds?: number | null;
  }): MusicPlaybackSnapshot {
    const now = this.now();
    const playerKind = input.playerKind ?? "browser-fallback";

    if (!this.current) {
      this.playerLease = null;
      this.authoritativePlayer = null;
      return this.snapshot({ clientId: input.clientId, audioUrl: null, playerKind });
    }

    if (this.current && typeof input.positionSeconds === "number" && Number.isFinite(input.positionSeconds)) {
      this.current.lastPositionSeconds = Math.max(0, input.positionSeconds);
    }

    const authoritativePlayer = this.getHealthyAuthoritativePlayer(now);
    if (playerKind === "browser-fallback" && authoritativePlayer) {
      return {
        ...this.snapshot({ clientId: input.clientId, audioUrl: null, playerKind }),
        status: "blocked",
        player: {
          authority: "local-agent",
          connected: true,
          kind: playerKind,
          lastCommand: null,
          owned: false,
          blockedReason: "music_local_agent_authoritative",
          state: "blocked"
        }
      };
    }

    const localAgentCanPreempt = playerKind === "local-agent"
      && authoritativePlayer?.clientId === input.clientId;
    if (localAgentCanPreempt
      || !this.playerLease
      || this.playerLease.expiresAt <= now
      || this.playerLease.clientId === input.clientId) {
      this.playerLease = {
        clientId: input.clientId,
        expiresAt: new Date(now.getTime() + playerLeaseTtlMs),
        kind: playerKind
      };

      return this.snapshot({
        clientId: input.clientId,
        audioUrl: this.current ? input.createAudioUrl(this.current.playbackId, this.current.track) : null,
        playerKind
      });
    }

    return {
      ...this.snapshot({ clientId: input.clientId, audioUrl: null, playerKind }),
      status: "blocked",
      player: {
        authority: this.playerLease.kind,
        connected: true,
        kind: playerKind,
        lastCommand: null,
        owned: false,
        blockedReason: "music_player_already_connected",
        state: "blocked"
      }
    };
  }

  public setAuthoritativePlayer(input: {
    clientId: string;
    healthyUntil: string;
  }): void {
    const healthyUntil = new Date(input.healthyUntil);
    if (!Number.isFinite(healthyUntil.getTime()) || healthyUntil <= this.now()) {
      this.failAuthoritativePlayer(input.clientId, "music_local_agent_expired");
      return;
    }

    this.authoritativePlayer = {
      clientId: input.clientId,
      healthyUntil
    };
    if (this.playerLease?.kind === "browser-fallback") {
      this.playerLease = null;
    }
    if (this.reason?.startsWith("music_local_agent_")) {
      this.reason = null;
    }
  }

  public failAuthoritativePlayer(clientId: string, reason: string): void {
    if (this.authoritativePlayer?.clientId === clientId) {
      this.authoritativePlayer = null;
    }
    if (this.playerLease?.clientId === clientId) {
      this.playerLease = null;
    }
    this.reason = reason;
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

    const authoritativePlayer = this.getHealthyAuthoritativePlayer(this.now());
    if (authoritativePlayer && authoritativePlayer.clientId !== input.clientId) {
      return {
        ok: false,
        reason: "music_player_lease_conflict"
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

  public getInternalState(): MusicPlaybackSnapshot {
    return this.snapshot({ clientId: null, audioUrl: null });
  }

  public releasePlayerLease(clientId: string): void {
    if (this.playerLease?.clientId === clientId) {
      this.playerLease = null;
    }
  }

  private async startNext(authUserId: string, excludedTrackIds: ReadonlySet<string> = new Set()): Promise<void> {
    const selected = await this.selectNextTrack(excludedTrackIds);

    if (!selected) {
      this.current = null;
      this.reason = "music_no_playable_tracks";
      return;
    }

    this.startPlayback(authUserId, selected);
  }

  private startPlayback(authUserId: string, selected: {
    track: MusicSelectableTrack;
    playlistId: string | null;
  }): void {
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

  private async selectTrack(trackId: string): Promise<{
    track: MusicSelectableTrack;
    playlistId: string | null;
  } | null> {
    const [catalog, playlists] = await Promise.all([
      this.repository.listPlaybackCatalog({ context: "live", limit: playbackCatalogLimit }),
      this.repository.listPlaylists()
    ]);
    const track = catalog.find((candidate) => candidate.trackId === trackId);
    if (!track) {
      this.reason = "music_selected_track_not_found";
      return null;
    }
    if (!decideMusicTrackSelection(track, "live").ok || !isPlayableSource(track)) {
      this.reason = "music_selected_track_not_playable";
      return null;
    }
    const playlistEntry = sortPlaylistTracks(playlists).find((entry) => entry.trackId === track.trackId);

    return {
      track,
      playlistId: playlistEntry?.playlistId ?? null
    };
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
    outcome: "played-full" | "skipped" | "stopped" | "failed";
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
    this.playerLease = null;
    this.authoritativePlayer = null;

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
    playerKind?: MusicPlaybackPlayerKind | undefined;
  }): MusicPlaybackSnapshot {
    const now = this.now();
    const lease = this.playerLease && this.playerLease.expiresAt > now ? this.playerLease : null;
    const authoritativePlayer = this.getHealthyAuthoritativePlayer(now);
    const owned = Boolean(input.clientId && lease?.clientId === input.clientId);
    const kind = input.playerKind ?? lease?.kind ?? null;
    const authority = authoritativePlayer ? "local-agent" : lease?.kind ?? "none";
    const playerState: MusicPlaybackPlayerState = !this.current
      ? "idle"
      : lease?.kind === "browser-fallback"
        ? "fallback"
        : lease?.kind === "local-agent"
          ? this.current.status === "loading" ? "pending" : "active"
          : authoritativePlayer
            ? "pending"
            : "idle";

    return {
      ok: true,
      status: this.current?.status ?? "idle",
      audioRouteId: this.audioRouteId,
      audioRoutes: localAgentAudioRouteDefinitions.map((route) => ({
        ...route,
        controlState: "reconnecting" as const,
        state: "reconnecting" as const,
        detail: "Waiting for local-agent route status",
        muted: null,
        revision: 0,
        volumePercent: null
      })),
      playbackId: this.current?.playbackId ?? null,
      currentTrack: this.current ? toPublicTrack(this.current.track) : null,
      audioUrl: owned || !input.clientId ? input.audioUrl : null,
      startedAt: this.current?.startedAt?.toISOString() ?? null,
      updatedAt: this.now().toISOString(),
      player: {
        authority,
        connected: Boolean(lease || authoritativePlayer),
        kind,
        lastCommand: null,
        owned,
        blockedReason: null,
        state: playerState
      },
      reason: this.current?.reason ?? this.reason
    };
  }

  private now(): Date {
    return this.options.getNow?.() ?? new Date();
  }

  private getHealthyAuthoritativePlayer(now: Date): AuthoritativePlayer | null {
    if (this.authoritativePlayer && this.authoritativePlayer.healthyUntil <= now) {
      const clientId = this.authoritativePlayer.clientId;
      this.authoritativePlayer = null;
      if (this.playerLease?.clientId === clientId) {
        this.playerLease = null;
      }
      this.reason = "music_local_agent_expired";
    }

    return this.authoritativePlayer;
  }
}
