"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./music-player.module.css";

type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "blocked" | "error";

type PlaybackTrack = {
  readonly trackId: string;
  readonly sourceId: string;
  readonly title: string;
  readonly artist: string;
  readonly durationSeconds: number | null;
  readonly providerKey: string;
  readonly providerName: string;
  readonly sourceLabel: string;
  readonly attributionText: string | null;
  readonly licenseName: string;
  readonly licenseKind: string;
};

type PlaybackState = {
  readonly ok: true;
  readonly status: PlaybackStatus;
  readonly playbackId: string | null;
  readonly currentTrack: PlaybackTrack | null;
  readonly audioUrl: string | null;
  readonly startedAt: string | null;
  readonly updatedAt: string;
  readonly player: {
    readonly connected: boolean;
    readonly owned: boolean;
    readonly blockedReason: string | null;
  };
  readonly reason: string | null;
};

type ApiFailure = {
  readonly ok: false;
  readonly reason: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.maiks.yt";
const clientIdStorageKey = "maiks.yt.musicPlayer.sessionClientId";

const readAccessToken = (): string | null => {
  const token = new URL(window.location.href).searchParams.get("accessToken")?.trim() ?? "";
  return token.length > 0 ? token : null;
};

const getClientId = (): string => {
  const existing = window.sessionStorage.getItem(clientIdStorageKey);

  if (existing && existing.length >= 8) {
    return existing;
  }

  const next = window.crypto.randomUUID();
  window.sessionStorage.setItem(clientIdStorageKey, next);
  return next;
};

const postPlayerEvent = async (input: {
  accessToken: string;
  clientId: string;
  event: "started" | "ended" | "failed";
  playbackId: string;
  positionSeconds: number | null;
}): Promise<void> => {
  await fetch(`${apiBaseUrl}/music/playback/player-events`, {
    body: JSON.stringify(input),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
};

const MusicPlayerClient = (): React.ReactNode => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const clientIdRef = useRef<string | null>(null);
  const startedPlaybackIdRef = useRef<string | null>(null);
  const failedPlaybackIdRef = useRef<string | null>(null);
  const [state, setState] = useState<PlaybackState | null>(null);
  const [message, setMessage] = useState<string>("Waiting for playback");

  useEffect(() => {
    accessTokenRef.current = readAccessToken();
    clientIdRef.current = getClientId();

    if (!accessTokenRef.current) {
      setMessage("Missing OBS overlay access token");
      return;
    }

    let cancelled = false;

    const poll = async (): Promise<void> => {
      const accessToken = accessTokenRef.current;
      const clientId = clientIdRef.current;
      const audio = audioRef.current;

      if (!accessToken || !clientId) {
        return;
      }

      const query = new URLSearchParams({
        accessToken,
        clientId
      });

      if (audio && Number.isFinite(audio.currentTime) && audio.currentTime > 0) {
        query.set("positionSeconds", String(Math.max(0, Math.floor(audio.currentTime))));
      }

      try {
        const response = await fetch(`${apiBaseUrl}/music/playback/player-state?${query.toString()}`, {
          cache: "no-store"
        });
        const payload = await response.json() as PlaybackState | ApiFailure;

        if (cancelled) {
          return;
        }

        if (!payload.ok) {
          setMessage(payload.reason);
          return;
        }

        setState(payload);
        setMessage(payload.reason ?? (payload.currentTrack ? payload.status : "Waiting for playback"));
      } catch {
        if (!cancelled) {
          setMessage("music_player_state_unavailable");
        }
      }
    };

    void poll();
    const interval = window.setInterval(() => {
      void poll();
    }, 2_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !state) {
      return;
    }

    if (!state.currentTrack || !state.playbackId || state.status === "idle" || state.status === "blocked") {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      return;
    }

    if (state.audioUrl && audio.src !== state.audioUrl) {
      startedPlaybackIdRef.current = null;
      failedPlaybackIdRef.current = null;
      audio.src = state.audioUrl;
      audio.load();
    }

    if (state.status === "paused") {
      audio.pause();
      return;
    }

    if ((state.status === "loading" || state.status === "playing") && audio.src) {
      void audio.play().catch(() => {
        setMessage("music_autoplay_blocked");
        const accessToken = accessTokenRef.current;
        const clientId = clientIdRef.current;

        if (accessToken && clientId && state.playbackId && failedPlaybackIdRef.current !== state.playbackId) {
          failedPlaybackIdRef.current = state.playbackId;
          void postPlayerEvent({
            accessToken,
            clientId,
            event: "failed",
            playbackId: state.playbackId,
            positionSeconds: null
          });
        }
      });
    }
  }, [state]);

  const currentTrack = state?.currentTrack ?? null;
  const playbackId = state?.playbackId ?? null;

  return (
    <main className={styles.surface}>
      <audio
        ref={audioRef}
        onEnded={() => {
          const accessToken = accessTokenRef.current;
          const clientId = clientIdRef.current;
          const audio = audioRef.current;

          if (accessToken && clientId && playbackId) {
            void postPlayerEvent({
              accessToken,
              clientId,
              event: "ended",
              playbackId,
              positionSeconds: audio ? Math.max(0, Math.floor(audio.currentTime)) : null
            });
          }
        }}
        onError={() => {
          const accessToken = accessTokenRef.current;
          const clientId = clientIdRef.current;
          const audio = audioRef.current;

          if (accessToken && clientId && playbackId && failedPlaybackIdRef.current !== playbackId) {
            failedPlaybackIdRef.current = playbackId;
            void postPlayerEvent({
              accessToken,
              clientId,
              event: "failed",
              playbackId,
              positionSeconds: audio ? Math.max(0, Math.floor(audio.currentTime)) : null
            });
          }
        }}
        onPlaying={() => {
          const accessToken = accessTokenRef.current;
          const clientId = clientIdRef.current;
          const audio = audioRef.current;

          if (accessToken && clientId && playbackId && startedPlaybackIdRef.current !== playbackId) {
            startedPlaybackIdRef.current = playbackId;
            void postPlayerEvent({
              accessToken,
              clientId,
              event: "started",
              playbackId,
              positionSeconds: audio ? Math.max(0, Math.floor(audio.currentTime)) : null
            });
          }
        }}
      />
      <section className={styles.nowPlaying} aria-live="polite">
        <p>{state?.status ?? "idle"}</p>
        {currentTrack ? (
          <>
            <h1>{currentTrack.title}</h1>
            <h2>{currentTrack.artist}</h2>
            <span>{currentTrack.attributionText ?? `${currentTrack.providerName} - ${currentTrack.licenseName}`}</span>
          </>
        ) : (
          <h1>{message}</h1>
        )}
      </section>
    </main>
  );
};

export default MusicPlayerClient;
