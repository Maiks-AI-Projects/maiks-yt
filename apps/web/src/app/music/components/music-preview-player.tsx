"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiPause, FiPlay, FiVolume2, FiVolumeX } from "react-icons/fi";

import {
  canSeekMusicPreview,
  formatMusicPreviewTime,
  normalizeMusicPreviewUrl,
  shouldResetMusicPreviewForSourceChange
} from "./music-preview.service";
import type { MusicCatalogTrack } from "./music-track.types";
import styles from "./music-searchable-select.module.css";

export const MusicPreviewPlayer = ({
  showVolume,
  track,
  unavailableReason
}: {
  readonly showVolume: boolean;
  readonly track: MusicCatalogTrack | null;
  readonly unavailableReason: string | null;
}): React.ReactNode => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousTrackIdRef = useRef<string | null>(null);
  const previousPreviewUrlRef = useRef<string | null>(null);
  const previewUrl = normalizeMusicPreviewUrl(track?.previewUrl);
  const trackId = track?.id ?? null;
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.8);
  const canPreview = Boolean(track && previewUrl && !unavailableReason);
  const canSeek = canSeekMusicPreview(duration);

  const resetAudio = useCallback(() => {
    const audio = audioRef.current;

    if (audio) {
      audio.pause();
      if (canSeekMusicPreview(audio.duration)) {
        audio.currentTime = 0;
      }
      audio.load();
    }

    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setPlaybackError(null);
  }, []);

  useEffect(() => {
    const previousUrl = previousPreviewUrlRef.current;
    const previousTrackId = previousTrackIdRef.current;

    if (previousTrackId !== trackId || shouldResetMusicPreviewForSourceChange(previousUrl, previewUrl)) {
      resetAudio();
    }

    previousTrackIdRef.current = trackId;
    previousPreviewUrlRef.current = previewUrl;
  }, [previewUrl, resetAudio, trackId]);

  useEffect(() => () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      if (canSeekMusicPreview(audio.duration)) {
        audio.currentTime = 0;
      }
    }
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlayback = async (): Promise<void> => {
    const audio = audioRef.current;

    if (!audio || !canPreview) {
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      setPlaybackError(null);
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
      setPlaybackError("Preview playback failed.");
    }
  };

  const handleSeek = (nextTime: number): void => {
    const audio = audioRef.current;

    if (!audio || !canSeekMusicPreview(audio.duration)) {
      return;
    }

    audio.currentTime = Math.min(Math.max(nextTime, 0), audio.duration);
    setCurrentTime(audio.currentTime);
  };

  return (
    <div className={styles.previewPanel} aria-label="Selected track preview">
      <audio
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onError={() => {
          setIsPlaying(false);
          setPlaybackError("Preview audio is unavailable.");
        }}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        preload="metadata"
        ref={audioRef}
      >
        {previewUrl ? (
          <source
            key={previewUrl}
            src={previewUrl}
            type={track?.previewMimeType ?? undefined}
          />
        ) : null}
      </audio>
      <button
        aria-label={isPlaying ? "Pause preview" : "Play preview"}
        className={styles.iconButton}
        disabled={!canPreview}
        onClick={() => {
          void togglePlayback();
        }}
        title={isPlaying ? "Pause preview" : "Play preview"}
        type="button"
      >
        {isPlaying ? <FiPause aria-hidden="true" /> : <FiPlay aria-hidden="true" />}
      </button>
      <div className={styles.previewTimeline}>
        <input
          aria-label="Preview position"
          disabled={!canPreview || !canSeek}
          max={canSeek ? duration : 0}
          min={0}
          onChange={(event) => handleSeek(event.currentTarget.valueAsNumber)}
          step={0.1}
          type="range"
          value={canSeek ? Math.min(currentTime, duration) : 0}
        />
        <span>{formatMusicPreviewTime(currentTime)} / {formatMusicPreviewTime(duration)}</span>
      </div>
      {showVolume ? (
        <label className={styles.volumeControl}>
          {volume === 0 ? <FiVolumeX aria-hidden="true" /> : <FiVolume2 aria-hidden="true" />}
          <span>Volume</span>
          <input
            aria-label="Preview volume"
            max={1}
            min={0}
            onChange={(event) => setVolume(event.currentTarget.valueAsNumber)}
            step={0.05}
            type="range"
            value={volume}
          />
        </label>
      ) : null}
      <span className={styles.previewStatus}>
        {track
          ? unavailableReason ?? playbackError ?? (previewUrl ? "Preview ready" : "No preview")
          : "Select a track"}
      </span>
    </div>
  );
};
