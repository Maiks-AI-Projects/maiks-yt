import { useEffect, useState } from "react";
import {
  DEFAULT_LOCAL_AGENT_AUDIO_ROUTE_ID,
  localAgentAudioRouteDefinitions,
  type LocalAgentAudioRouteId,
  type LocalAgentAudioRouteStatus
} from "@maiks-yt/events";

import { apiFetch } from "../dev-auth-token.js";
import { apiBaseUrl } from "../runtime-config.service.js";

type MusicPlaybackStatus = "idle" | "loading" | "playing" | "paused" | "blocked" | "error";
type MusicPlaybackControlAction = "play" | "pause" | "resume" | "stop" | "next" | "select" | "route.select";

type MusicPlaybackTrack = {
  readonly trackId?: string;
  readonly title: string;
  readonly artist: string;
  readonly providerName: string;
  readonly attributionText: string | null;
  readonly licenseName: string;
};

type MusicPlaybackState = {
  readonly ok: true;
  readonly status: MusicPlaybackStatus;
  readonly audioRouteId: LocalAgentAudioRouteId;
  readonly audioRoutes: readonly LocalAgentAudioRouteStatus[];
  readonly playbackId: string | null;
  readonly currentTrack: MusicPlaybackTrack | null;
  readonly reason: string | null;
  readonly player: {
    readonly connected: boolean;
    readonly owned: boolean;
    readonly blockedReason: string | null;
  };
};

type MusicPlaybackFailure = {
  readonly ok: false;
  readonly reason: string;
};

type MusicCatalogTrack = {
  readonly trackId: string;
  readonly title: string;
  readonly artist: string;
  readonly providerName: string;
};

type MusicCatalogResponse = {
  readonly ok: true;
  readonly tracks: readonly MusicCatalogTrack[];
} | MusicPlaybackFailure;

const playbackStatusLabels: Record<MusicPlaybackStatus, string> = {
  blocked: "Blocked",
  error: "Needs attention",
  idle: "Idle",
  loading: "Starting",
  paused: "Paused",
  playing: "Playing"
};

const playbackReasonLabels: Readonly<Record<string, string>> = {
  music_audio_failed_before_start: "The selected track could not start.",
  music_history_write_failed: "Playback history could not be saved.",
  music_no_playable_tracks: "No eligible playable tracks are available.",
  music_play_control_forbidden: "Your account cannot control music.",
  music_play_control_unavailable: "Music control is temporarily unavailable.",
  music_play_control_user_unlinked: "Link your Maiks.yt account before controlling music.",
  music_resume_without_paused_track: "Nothing paused to resume.",
  music_selected_track_not_found: "The selected track is not in the playable catalog.",
  music_selected_track_not_playable: "The selected track is not playable for live music.",
  music_track_selection_required: "Pick a track before selecting it.",
  music_local_agent_transition_pending: "Waiting for the VLC agent to confirm the change."
};

const readPlaybackMessage = (state: MusicPlaybackState | null, fallback: string): string => {
  if (state?.reason) {
    return playbackReasonLabels[state.reason] ?? "Music needs attention.";
  }

  if (!state) {
    return fallback;
  }

  if (state.status === "idle") {
    return "Ready to select the next eligible track.";
  }

  return playbackStatusLabels[state.status];
};

const requestPlayback = async <TResult,>(
  path: string,
  init: RequestInit = {}
): Promise<TResult> => {
  const response = await apiFetch(`${apiBaseUrl}${path}`, {
    cache: "no-store",
    ...init,
  });

  return await response.json() as TResult;
};

export const MusicControlPanel = (): React.ReactNode => {
  const [state, setState] = useState<MusicPlaybackState | null>(null);
  const [catalogTracks, setCatalogTracks] = useState<readonly MusicCatalogTrack[]>([]);
  const [message, setMessage] = useState<string>("Loading music playback.");
  const [busyAction, setBusyAction] = useState<MusicPlaybackControlAction | null>(null);
  const [selectedAudioRouteId, setSelectedAudioRouteId] = useState<LocalAgentAudioRouteId>(DEFAULT_LOCAL_AGENT_AUDIO_ROUTE_ID);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");

  const loadState = async (): Promise<void> => {
    try {
      const payload = await requestPlayback<MusicPlaybackState | MusicPlaybackFailure>("/admin/music/play-control/state");

      if (!payload.ok) {
        setMessage(playbackReasonLabels[payload.reason] ?? "Music control is unavailable.");
        return;
      }

      setState(payload);
      setSelectedAudioRouteId(payload.audioRouteId);
      const currentTrackId = payload.currentTrack?.trackId;
      if (currentTrackId) {
        setSelectedTrackId(currentTrackId);
      }
      setMessage(readPlaybackMessage(payload, "Music control is ready."));
    } catch {
      setMessage("Music control is temporarily unavailable.");
    }
  };

  const loadCatalog = async (): Promise<void> => {
    try {
      const payload = await requestPlayback<MusicCatalogResponse>("/admin/music/catalog");
      if (!payload.ok) {
        return;
      }

      setCatalogTracks(payload.tracks);
      setSelectedTrackId((current) => current || (payload.tracks[0]?.trackId ?? ""));
    } catch {
      // Playback controls remain usable without the optional catalog selector.
    }
  };

  useEffect(() => {
    void loadState();
    void loadCatalog();
    const interval = window.setInterval(() => {
      void loadState();
    }, 3_000);

    return () => window.clearInterval(interval);
  }, []);

  const sendControl = async (
    action: MusicPlaybackControlAction,
    audioRouteId: LocalAgentAudioRouteId = selectedAudioRouteId,
    trackId?: string
  ): Promise<void> => {
    if (action === "select" && !trackId) {
      setMessage(playbackReasonLabels.music_track_selection_required ?? "Pick a track before selecting it.");
      return;
    }
    setBusyAction(action);

    try {
      const payload = await requestPlayback<MusicPlaybackState | MusicPlaybackFailure>("/admin/music/play-control/control", {
        body: JSON.stringify({
          action,
          audioRouteId,
          ...(trackId ? { trackId } : {})
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!payload.ok) {
        setMessage(playbackReasonLabels[payload.reason] ?? "Music control is unavailable.");
        return;
      }

      setState(payload);
      setSelectedAudioRouteId(payload.audioRouteId);
      setMessage(readPlaybackMessage(payload, "Music control is ready."));
    } catch {
      setMessage("Music control is temporarily unavailable.");
    } finally {
      setBusyAction(null);
    }
  };
  const routeStatus = new Map((state?.audioRoutes ?? localAgentAudioRouteDefinitions.map((route) => ({
    ...route,
    state: "reconnecting" as const,
    detail: "Waiting for local-agent route status"
  }))).map((route) => [route.id, route]));
  const selectedRoute = routeStatus.get(selectedAudioRouteId);

  return (
    <section className="music-control-panel" aria-label="Music playback">
      <div className="music-control-header">
        <div>
          <h2>Music</h2>
          <p>{message}</p>
        </div>
        <span className={`music-status-pill ${state?.status ?? "idle"}`}>
          {playbackStatusLabels[state?.status ?? "idle"]}
        </span>
      </div>
      <div className="music-now-playing">
        <strong>{state?.currentTrack?.title ?? "No track loaded"}</strong>
        <span>{state?.currentTrack ? `${state.currentTrack.artist} - ${state.currentTrack.providerName}` : "Press play to load the next eligible track."}</span>
        {state?.currentTrack?.attributionText ? <small>{state.currentTrack.attributionText}</small> : null}
      </div>
      <div className={`music-output-state ${state?.player.connected ? "connected" : "disconnected"}`}>
        <span aria-hidden="true" />
        <strong>Playback output</strong>
        <small>{state?.player.connected ? "Connected" : "Waiting for the VLC agent or browser player"}</small>
      </div>
      <label className="music-route-selector">
        <span>Audio route</span>
        <select
          disabled={busyAction !== null}
          onChange={(event) => {
            const audioRouteId = event.currentTarget.value as LocalAgentAudioRouteId;
            setSelectedAudioRouteId(audioRouteId);
            void sendControl("route.select", audioRouteId);
          }}
          value={selectedAudioRouteId}
        >
          {localAgentAudioRouteDefinitions.map((route) => {
            const status = routeStatus.get(route.id);

            return (
              <option key={route.id} value={route.id}>
                {route.label} / {route.pipeWireSink} / {status?.state ?? "reconnecting"}
              </option>
            );
          })}
        </select>
        <small>{selectedRoute ? `${selectedRoute.label} maps to ${selectedRoute.pipeWireSink}. ${selectedRoute.state}` : "Waiting for route state."}</small>
      </label>
      <label className="music-track-selector">
        <span>Track</span>
        <select
          disabled={busyAction !== null || catalogTracks.length === 0}
          onChange={(event) => setSelectedTrackId(event.currentTarget.value)}
          value={selectedTrackId}
        >
          {catalogTracks.map((track) => (
            <option key={track.trackId} value={track.trackId}>
              {track.title} / {track.artist} / {track.providerName}
            </option>
          ))}
        </select>
      </label>
      <div className="music-control-actions">
        <button type="button" disabled={busyAction !== null} onClick={() => void sendControl(state?.status === "paused" ? "resume" : "play")}>
          {state?.status === "paused" ? "Resume" : "Play"}
        </button>
        <button
          type="button"
          disabled={busyAction !== null || (state?.status !== "playing" && state?.status !== "loading")}
          onClick={() => void sendControl("pause")}
        >
          Pause
        </button>
        <button type="button" disabled={busyAction !== null || !state?.currentTrack} onClick={() => void sendControl("next")}>Next</button>
        <button
          type="button"
          disabled={busyAction !== null || !selectedTrackId}
          onClick={() => void sendControl("select", selectedAudioRouteId, selectedTrackId)}
        >
          Select
        </button>
        <button type="button" disabled={busyAction !== null || !state?.currentTrack} onClick={() => void sendControl("stop")}>Stop</button>
      </div>
    </section>
  );
};
