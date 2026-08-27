import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "../dev-auth-token.js";
import { apiBaseUrl, createWebUrl } from "../runtime-config.service.js";

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

const readOverlayUrl = (): string => {
  const url = new URL(createWebUrl("/music/player"));

  url.searchParams.set("accessToken", "OVERLAY_ACCESS_TOKEN");

  return url.toString();
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
  const [message, setMessage] = useState<string>("Loading music playback");
  const [busyAction, setBusyAction] = useState<"play" | "pause" | "skip" | null>(null);
  const obsUrl = useMemo(readOverlayUrl, []);

  const loadState = async (): Promise<void> => {
    try {
      const payload = await requestPlayback<MusicPlaybackState | MusicPlaybackFailure>("/admin/music/play-control/state");

      if (!payload.ok) {
        setMessage(payload.reason);
        return;
      }

      setState(payload);
      setMessage(payload.reason ?? payload.status);
    } catch {
      setMessage("music_play_control_unavailable");
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
        setMessage(payload.reason);
        return;
      }

      setState(payload);
      setMessage(payload.reason ?? payload.status);
    } catch {
      setMessage("music_play_control_unavailable");
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
        <span className={`music-status-pill ${state?.status ?? "idle"}`}>{state?.status ?? "idle"}</span>
      </div>
      <div className="music-now-playing">
        <strong>{state?.currentTrack?.title ?? "No track loaded"}</strong>
        <span>{state?.currentTrack ? `${state.currentTrack.artist} - ${state.currentTrack.providerName}` : "Press play to load the next eligible track."}</span>
        {state?.currentTrack?.attributionText ? <small>{state.currentTrack.attributionText}</small> : null}
      </div>
      <div className="music-control-actions">
        <button type="button" disabled={busyAction !== null} onClick={() => void sendControl("play")}>Play</button>
        <button type="button" disabled={busyAction !== null || !state?.currentTrack} onClick={() => void sendControl("pause")}>Pause</button>
        <button type="button" disabled={busyAction !== null || !state?.currentTrack} onClick={() => void sendControl("skip")}>Skip</button>
      </div>
      <label className="music-obs-url">
        <span>OBS Browser Source URL</span>
        <input readOnly value={obsUrl} onFocus={(event) => event.currentTarget.select()} />
      </label>
    </section>
  );
};
