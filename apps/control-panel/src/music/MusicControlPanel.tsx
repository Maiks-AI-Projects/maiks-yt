import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_LOCAL_AGENT_AUDIO_ROUTE_ID,
  localAgentAudioRouteDefinitions,
  type LocalAgentAudioRouteId,
  type LocalAgentAudioRouteStatus
} from "@maiks-yt/events";

import { apiFetch } from "../dev-auth-token.js";
import { apiBaseUrl } from "../runtime-config.service.js";

type MusicPlaybackStatus = "idle" | "loading" | "playing" | "paused" | "blocked" | "error";
type MusicPlaybackControlAction =
  | "play"
  | "pause"
  | "resume"
  | "stop"
  | "next"
  | "select"
  | "route.select"
  | "route.volume.set"
  | "route.mute.set";

type MusicPlaybackTrack = {
  readonly trackId?: string;
  readonly title: string;
  readonly artist: string;
  readonly providerName: string;
  readonly attributionText: string | null;
  readonly licenseName: string;
};

export type MusicPlaybackState = {
  readonly ok: true;
  readonly status: MusicPlaybackStatus;
  readonly audioRouteId: LocalAgentAudioRouteId;
  readonly audioRoutes: readonly LocalAgentAudioRouteStatus[];
  readonly playbackId: string | null;
  readonly currentTrack: MusicPlaybackTrack | null;
  readonly reason: string | null;
  readonly player: {
    readonly authority: "browser-fallback" | "local-agent" | "none";
    readonly connected: boolean;
    readonly kind: "browser-fallback" | "local-agent" | null;
    readonly lastCommand: {
      readonly action: "track.play";
      readonly acknowledgedAt: string | null;
      readonly error: string | null;
      readonly eventId: string | null;
      readonly status: "pending" | "succeeded" | "failed" | "rejected" | "expired";
    } | null;
    readonly owned: boolean;
    readonly blockedReason: string | null;
    readonly state: "idle" | "pending" | "active" | "blocked" | "fallback" | "error" | "unavailable";
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

type MusicPlaybackRequestResult<TResult> = {
  readonly payload: TResult;
  readonly status: number;
};

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
  music_local_agent_transition_pending: "Waiting for the VLC agent to confirm the change.",
  music_local_agent_lease_unavailable: "The VLC agent could not claim playback. Browser fallback is available.",
  music_local_agent_play_failed: "VLC playback failed. Browser fallback is available.",
  music_local_agent_unavailable: "The Local Agent is unavailable.",
  music_audio_route_command_unavailable: "The route command could not be sent.",
  music_audio_route_unavailable: "That audio route is unavailable."
};

const routeControlRank: Readonly<Record<LocalAgentAudioRouteStatus["controlState"], number>> = {
  reconnecting: 0,
  unavailable: 1,
  pending: 2,
  error: 3,
  acknowledged: 4
};

export const createUnavailableMusicPlaybackState = (
  reason: "not_authenticated" | "music_play_control_forbidden" | "music_play_control_user_unlinked"
): MusicPlaybackState => ({
  ok: true,
  status: "blocked",
  audioRouteId: DEFAULT_LOCAL_AGENT_AUDIO_ROUTE_ID,
  audioRoutes: localAgentAudioRouteDefinitions.map((route) => ({
    ...route,
    controlState: "unavailable",
    detail: reason,
    muted: null,
    revision: 0,
    state: "unavailable",
    volumePercent: null
  })),
  playbackId: null,
  currentTrack: null,
  reason,
  player: {
    authority: "none",
    blockedReason: reason,
    connected: false,
    kind: null,
    lastCommand: null,
    owned: false,
    state: "unavailable"
  }
});

export const shouldClearMusicPlaybackState = (
  status: number,
  payload: { readonly ok: true } | MusicPlaybackFailure
): payload is MusicPlaybackFailure & {
  reason: "not_authenticated" | "music_play_control_forbidden" | "music_play_control_user_unlinked";
} =>
  status === 401
  || (status === 403 && payload.ok === false && (
    payload.reason === "music_play_control_forbidden"
    || payload.reason === "music_play_control_user_unlinked"
  ))
  || (payload.ok === false && payload.reason === "not_authenticated");

export const mergeMusicPlaybackState = (
  current: MusicPlaybackState | null,
  incoming: MusicPlaybackState
): MusicPlaybackState => {
  if (!current) {
    return incoming;
  }
  const currentRoutes = new Map(current.audioRoutes.map((route) => [route.id, route]));
  return {
    ...incoming,
    audioRoutes: incoming.audioRoutes.map((route) => {
      const previous = currentRoutes.get(route.id);
      if (!previous || route.revision > previous.revision) {
        return route;
      }
      if (route.revision < previous.revision) {
        return previous;
      }
      return routeControlRank[route.controlState] >= routeControlRank[previous.controlState]
        ? route
        : previous;
    })
  };
};

export const createRouteControlPayload = (input: {
  audioRouteId: LocalAgentAudioRouteId;
  muted: boolean;
} | {
  audioRouteId: LocalAgentAudioRouteId;
  volumePercent: number;
}): Readonly<Record<string, boolean | number | string>> => "volumePercent" in input
  ? {
      action: "route.volume.set",
      audioRouteId: input.audioRouteId,
      volumePercent: input.volumePercent
    }
  : {
      action: "route.mute.set",
      audioRouteId: input.audioRouteId,
      muted: input.muted
    };

export const readRouteControlMessage = (route: LocalAgentAudioRouteStatus): string => {
  if (route.controlState === "pending") {
    return `Pending revision ${route.revision}`;
  }
  if (route.controlState === "error") {
    return route.lastError ? `Error: ${route.lastError}` : "Route control failed";
  }
  if (route.state !== "available" || route.volumePercent === null || route.muted === null) {
    return route.state === "reconnecting" ? "Reconnecting" : "Unavailable";
  }
  return `${route.volumePercent}% / ${route.muted ? "Muted" : "Unmuted"} / revision ${route.revision}`;
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
): Promise<MusicPlaybackRequestResult<TResult>> => {
  const response = await apiFetch(`${apiBaseUrl}${path}`, {
    cache: "no-store",
    ...init,
  });

  return {
    payload: await response.json() as TResult,
    status: response.status
  };
};

export const MusicControlPanel = (): React.ReactNode => {
  const authRequestEpochRef = useRef(0);
  const [state, setState] = useState<MusicPlaybackState | null>(null);
  const [catalogTracks, setCatalogTracks] = useState<readonly MusicCatalogTrack[]>([]);
  const [message, setMessage] = useState<string>("Loading music playback.");
  const [busyAction, setBusyAction] = useState<MusicPlaybackControlAction | null>(null);
  const [selectedAudioRouteId, setSelectedAudioRouteId] = useState<LocalAgentAudioRouteId>(DEFAULT_LOCAL_AGENT_AUDIO_ROUTE_ID);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");

  const isCurrentAuthRequestEpoch = (requestEpoch: number): boolean =>
    requestEpoch === authRequestEpochRef.current;

  const clearAuthenticatedMusicState = (
    reason: "not_authenticated" | "music_play_control_forbidden" | "music_play_control_user_unlinked"
  ): void => {
    authRequestEpochRef.current += 1;
    setState(createUnavailableMusicPlaybackState(reason));
    setCatalogTracks([]);
    setBusyAction(null);
    setSelectedAudioRouteId(DEFAULT_LOCAL_AGENT_AUDIO_ROUTE_ID);
    setSelectedTrackId("");
    setMessage(playbackReasonLabels[reason] ?? "Your sign-in needs to be renewed.");
  };

  const loadState = async (): Promise<void> => {
    const requestEpoch = authRequestEpochRef.current;
    try {
      const { payload, status } = await requestPlayback<MusicPlaybackState | MusicPlaybackFailure>("/admin/music/play-control/state");
      if (!isCurrentAuthRequestEpoch(requestEpoch)) {
        return;
      }

      if (shouldClearMusicPlaybackState(status, payload)) {
        clearAuthenticatedMusicState(payload.reason);
        return;
      }

      if (!payload.ok) {
        setMessage(playbackReasonLabels[payload.reason] ?? "Music control is unavailable.");
        return;
      }

      setState((current) => mergeMusicPlaybackState(current, payload));
      setSelectedAudioRouteId(payload.audioRouteId);
      const currentTrackId = payload.currentTrack?.trackId;
      if (currentTrackId) {
        setSelectedTrackId(currentTrackId);
      }
      setMessage(readPlaybackMessage(payload, "Music control is ready."));
    } catch {
      if (!isCurrentAuthRequestEpoch(requestEpoch)) {
        return;
      }
      setMessage("Music control is temporarily unavailable.");
    }
  };

  const loadCatalog = async (): Promise<void> => {
    const requestEpoch = authRequestEpochRef.current;
    try {
      const { payload, status } = await requestPlayback<MusicCatalogResponse>("/admin/music/catalog");
      if (!isCurrentAuthRequestEpoch(requestEpoch)) {
        return;
      }
      if (shouldClearMusicPlaybackState(status, payload)) {
        clearAuthenticatedMusicState(payload.reason);
        return;
      }
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
    trackId?: string,
    routeValue?: { muted?: boolean | undefined; volumePercent?: number | undefined }
  ): Promise<void> => {
    if (action === "select" && !trackId) {
      setMessage(playbackReasonLabels.music_track_selection_required ?? "Pick a track before selecting it.");
      return;
    }
    const requestEpoch = authRequestEpochRef.current;
    setBusyAction(action);

    try {
      const requestBody = action === "route.volume.set" && routeValue?.volumePercent !== undefined
        ? createRouteControlPayload({ audioRouteId, volumePercent: routeValue.volumePercent })
        : action === "route.mute.set" && routeValue?.muted !== undefined
          ? createRouteControlPayload({ audioRouteId, muted: routeValue.muted })
          : {
              action,
              audioRouteId,
              ...(trackId ? { trackId } : {})
            };
      const { payload, status } = await requestPlayback<MusicPlaybackState | MusicPlaybackFailure>("/admin/music/play-control/control", {
        body: JSON.stringify(requestBody),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      if (!isCurrentAuthRequestEpoch(requestEpoch)) {
        return;
      }

      if (shouldClearMusicPlaybackState(status, payload)) {
        clearAuthenticatedMusicState(payload.reason);
        return;
      }

      if (!payload.ok) {
        setMessage(playbackReasonLabels[payload.reason] ?? "Music control is unavailable.");
        return;
      }

      setState((current) => mergeMusicPlaybackState(current, payload));
      setSelectedAudioRouteId(payload.audioRouteId);
      setMessage(readPlaybackMessage(payload, "Music control is ready."));
    } catch {
      if (!isCurrentAuthRequestEpoch(requestEpoch)) {
        return;
      }
      setMessage("Music control is temporarily unavailable.");
    } finally {
      if (isCurrentAuthRequestEpoch(requestEpoch)) {
        setBusyAction(null);
      }
    }
  };
  const routeStatus = new Map((state?.audioRoutes ?? localAgentAudioRouteDefinitions.map((route) => ({
    ...route,
    controlState: "reconnecting" as const,
    state: "reconnecting" as const,
    detail: "Waiting for local-agent route status",
    muted: null,
    revision: 0,
    volumePercent: null
  }))).map((route) => [route.id, route]));
  const selectedRoute = routeStatus.get(selectedAudioRouteId);
  const selectedRouteCanCarryPlayback = selectedRoute?.state === "available";
  const hasCurrentPlayback = Boolean(state?.playbackId || state?.currentTrack);
  const playbackActionUnavailable = busyAction !== null
    || !state
    || state.status === "blocked"
    || !selectedRouteCanCarryPlayback;
  const displayedMessage = state && state.status !== "blocked" && !state.reason && !selectedRouteCanCarryPlayback
    ? "Music route is unavailable; stop remains available."
    : message;

  return (
    <section className="music-control-panel" aria-label="Music playback">
      <div className="music-control-header">
        <div>
          <h2>Music</h2>
          <p>{displayedMessage}</p>
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
        <small>{state?.player.state === "fallback"
          ? "Browser fallback active"
          : state?.player.state === "pending"
            ? "Waiting for VLC acknowledgement"
            : state?.player.state === "error"
              ? "VLC failed, browser fallback available"
              : state?.player.connected
                ? `${state.player.authority === "local-agent" ? "VLC" : "Browser"} connected`
                : "Waiting for the VLC agent or browser player"}</small>
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
      <div className="music-route-gain-grid" aria-label="Channel gain and mute">
        {localAgentAudioRouteDefinitions.map((definition) => {
          const route = routeStatus.get(definition.id)!;
          const unavailable = route.state !== "available"
            || route.volumePercent === null
            || route.muted === null;
          const pending = route.controlState === "pending";

          return (
            <section className={`music-route-gain ${route.controlState}`} key={route.id} aria-label={`${route.label} gain`}>
              <div className="music-route-gain-heading">
                <strong>{route.label}</strong>
                <span>{route.volumePercent === null ? "--" : `${route.volumePercent}%`}</span>
              </div>
              <input
                aria-label={`${route.label} volume`}
                defaultValue={route.volumePercent ?? 0}
                disabled={busyAction !== null || unavailable || pending}
                key={`${route.id}:${route.revision}:${route.volumePercent ?? "unavailable"}`}
                max="100"
                min="0"
                onKeyUp={(event) => {
                  if (["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", "End", "Home", "PageDown", "PageUp"]
                    .includes(event.key)) {
                    void sendControl(
                      "route.volume.set",
                      route.id,
                      undefined,
                      { volumePercent: Number(event.currentTarget.value) }
                    );
                  }
                }}
                onPointerUp={(event) => void sendControl(
                  "route.volume.set",
                  route.id,
                  undefined,
                  { volumePercent: Number(event.currentTarget.value) }
                )}
                step="1"
                type="range"
              />
              <button
                aria-pressed={route.muted ?? false}
                disabled={busyAction !== null || unavailable || pending}
                onClick={() => void sendControl(
                  "route.mute.set",
                  route.id,
                  undefined,
                  { muted: !(route.muted ?? false) }
                )}
                type="button"
              >
                {route.muted ? "Unmute" : "Mute"}
              </button>
              <small>{readRouteControlMessage(route)}</small>
            </section>
          );
        })}
      </div>
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
        <button type="button" disabled={playbackActionUnavailable} onClick={() => void sendControl(state?.status === "paused" ? "resume" : "play")}>
          {state?.status === "paused" ? "Resume" : "Play"}
        </button>
        <button
          type="button"
          disabled={playbackActionUnavailable || (state?.status !== "playing" && state?.status !== "loading")}
          onClick={() => void sendControl("pause")}
        >
          Pause
        </button>
        <button type="button" disabled={playbackActionUnavailable || !state?.currentTrack} onClick={() => void sendControl("next")}>Next</button>
        <button
          type="button"
          disabled={playbackActionUnavailable || !selectedTrackId}
          onClick={() => void sendControl("select", selectedAudioRouteId, selectedTrackId)}
        >
          Select
        </button>
        <button type="button" disabled={busyAction !== null || !hasCurrentPlayback} onClick={() => void sendControl("stop")}>Stop</button>
      </div>
    </section>
  );
};
