import { useEffect, useState } from "react";

import { apiFetch } from "../dev-auth-token.js";
import { apiBaseUrl } from "../runtime-config.service.js";

type MusicPlaybackStatus = "idle" | "loading" | "playing" | "paused" | "blocked" | "error";

type MusicPlaybackTrack = {
  readonly title: string;
  readonly artist: string;
  readonly providerName: string;
  readonly attributionText: string | null;
  readonly licenseName: string;
};

type MusicPlaybackState = {
  readonly ok: true;
  readonly status: MusicPlaybackStatus;
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
  music_play_control_user_unlinked: "Link your Maiks.yt account before controlling music."
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
  const [message, setMessage] = useState<string>("Loading music playback.");
  const [busyAction, setBusyAction] = useState<"play" | "pause" | "skip" | null>(null);

  const loadState = async (): Promise<void> => {
    try {
      const payload = await requestPlayback<MusicPlaybackState | MusicPlaybackFailure>("/admin/music/play-control/state");

      if (!payload.ok) {
        setMessage(playbackReasonLabels[payload.reason] ?? "Music control is unavailable.");
        return;
      }

      setState(payload);
      setMessage(readPlaybackMessage(payload, "Music control is ready."));
    } catch {
      setMessage("Music control is temporarily unavailable.");
    }
  };

  useEffect(() => {
    void loadState();
    const interval = window.setInterval(() => {
      void loadState();
    }, 3_000);

    return () => window.clearInterval(interval);
  }, []);

  const sendControl = async (action: "play" | "pause" | "skip"): Promise<void> => {
    setBusyAction(action);

    try {
      const payload = await requestPlayback<MusicPlaybackState | MusicPlaybackFailure>("/admin/music/play-control/control", {
        body: JSON.stringify({ action }),
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
      setMessage(readPlaybackMessage(payload, "Music control is ready."));
    } catch {
      setMessage("Music control is temporarily unavailable.");
    } finally {
      setBusyAction(null);
    }
  };

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
      <div className="music-control-actions">
        <button type="button" disabled={busyAction !== null} onClick={() => void sendControl("play")}>
          {state?.status === "paused" ? "Resume" : "Play"}
        </button>
        <button
          type="button"
          disabled={busyAction !== null || (state?.status !== "playing" && state?.status !== "loading")}
          onClick={() => void sendControl("pause")}
        >
          Pause
        </button>
        <button type="button" disabled={busyAction !== null || !state?.currentTrack} onClick={() => void sendControl("skip")}>Skip</button>
      </div>
    </section>
  );
};
