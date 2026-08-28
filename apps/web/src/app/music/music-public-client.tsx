"use client";

import { useEffect, useMemo, useState } from "react";

import { captureDevAuthTokenFromUrl } from "../dev-auth-token";
import { MusicSearchableSelect } from "./components";
import { createMusicRequest, fetchPublicMusicCatalog } from "./music-api.service";
import type { MusicPublicUiTrack } from "./music-api.types";
import { toPublicMusicSelectTrack } from "./music-track-mapping.service";
import styles from "./music.module.css";

type LoadState = "loading" | "ready" | "error";

const requestMessageForReason = (reason: string, status: number): string => {
  if (status === 429 || reason === "music_request_daily_limit") {
    return "Daily free request limit reached. Try again after the Amsterdam-day reset.";
  }

  if (reason === "music_track_not_selectable") {
    return "That track is no longer available for public requests.";
  }

  if (reason === "music_request_unavailable") {
    return "Music requests are temporarily unavailable.";
  }

  return `Request blocked: ${reason}`;
};

const MusicPublicClient = (): React.ReactNode => {
  const [catalog, setCatalog] = useState<readonly MusicPublicUiTrack[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [requestMessage, setRequestMessage] = useState("Signed-out free requests are limited to one accepted request per Amsterdam day.");
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
  }, []);

  useEffect(() => {
    let active = true;

    const loadCatalog = async (): Promise<void> => {
      setLoadState("loading");
      try {
        const response = await fetchPublicMusicCatalog({ context: "live", limit: 100 });

        if (!active) {
          return;
        }

        if (!response.payload.ok) {
          setCatalog([]);
          setLoadState("error");
          return;
        }

        setCatalog(response.payload.tracks.map(toPublicMusicSelectTrack));
        setLoadState("ready");
      } catch {
        if (active) {
          setCatalog([]);
          setLoadState("error");
        }
      }
    };

    void loadCatalog();

    return () => {
      active = false;
    };
  }, []);

  const selectedTrack = useMemo(
    () => catalog.find((track) => track.id === selectedTrackId) ?? null,
    [catalog, selectedTrackId]
  );

  const submitRequest = async (track: MusicPublicUiTrack): Promise<void> => {
    setRequestMessage("Sending request...");
    try {
      const response = await createMusicRequest({
        context: "live",
        requestText: null,
        selectionReference: track.selectionReference
      });

      if (!response.payload.ok) {
        setRequestMessage(requestMessageForReason(response.payload.reason, response.status));
        return;
      }

      setRequestMessage(`Request queued for ${track.title}. Michael still controls actual playback.`);
    } catch {
      setRequestMessage("Music requests are temporarily unavailable.");
    }
  };

  return (
    <section className={styles.surface} aria-labelledby="music-catalog-heading">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="music-catalog-heading">Eligible catalog</h2>
          <p>Only tracks returned by the live catalog API are shown here.</p>
        </div>
        <span className={styles.statusPill}>
          {loadState === "loading"
            ? "Loading"
            : loadState === "error"
              ? "Unavailable"
              : `${catalog.length} tracks`}
        </span>
      </div>

      <MusicSearchableSelect
        actionLabel="Request"
        emptyMessage="No eligible tracks match that search."
        errorMessage="The eligible music catalog is unavailable."
        label="Search music catalog"
        loadingMessage="Loading eligible tracks..."
        onAction={(track) => {
          void submitRequest(track as MusicPublicUiTrack);
        }}
        onSelectedTrackChange={(track) => setSelectedTrackId(track?.id ?? null)}
        safetyContext="live"
        selectedTrackId={selectedTrackId}
        state={loadState === "loading" ? "loading" : loadState === "error" ? "error" : "idle"}
        tracks={catalog}
      />

      <div className={styles.noticeRow}>
        <p>{requestMessage}</p>
        <p>
          {selectedTrack
            ? `${selectedTrack.provider} attribution cue: ${selectedTrack.attributionCue ?? "No extra cue supplied."}`
            : "Preview clips do not autoplay. Requests do not guarantee playback."}
        </p>
      </div>
    </section>
  );
};

export default MusicPublicClient;
