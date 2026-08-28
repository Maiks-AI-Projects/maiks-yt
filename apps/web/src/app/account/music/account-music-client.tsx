"use client";

import { useEffect, useMemo, useState } from "react";
import { FiArrowDown, FiArrowUp, FiSave, FiTrash2 } from "react-icons/fi";

import { captureDevAuthTokenFromUrl } from "../../dev-auth-token";
import { MusicSearchableSelect } from "../../music/components";
import {
  fetchAccountMusicCatalog,
  fetchMusicTopTracks,
  saveMusicTopTracks
} from "../../music/music-api.service";
import type { MusicTopTrackPick, MusicUiTrack } from "../../music/music-api.types";
import {
  formatMusicDuration,
  toMusicSelectTrack,
  topTrackPickToMusicTrack
} from "../../music/music-track-mapping.service";
import styles from "../../music/music.module.css";

type LoadState = "loading" | "ready" | "signed-out" | "error";

const AccountMusicClient = (): React.ReactNode => {
  const [catalog, setCatalog] = useState<readonly MusicUiTrack[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("Choose up to ten live-safe catalog tracks.");
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [topPicks, setTopPicks] = useState<readonly MusicTopTrackPick[]>([]);
  const [rankedTrackIds, setRankedTrackIds] = useState<readonly string[]>([]);
  const [topTrackLimit, setTopTrackLimit] = useState(10);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
  }, []);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      setLoadState("loading");
      try {
        const [catalogResponse, topTracksResponse] = await Promise.all([
          fetchAccountMusicCatalog({ context: "live", limit: 100 }),
          fetchMusicTopTracks()
        ]);

        if (!active) {
          return;
        }

        if (!topTracksResponse.payload.ok) {
          setCatalog(catalogResponse.payload.ok ? catalogResponse.payload.tracks.map(toMusicSelectTrack) : []);
          setLoadState(topTracksResponse.status === 401 || topTracksResponse.payload.reason === "not_authenticated" ? "signed-out" : "error");
          return;
        }

        setCatalog(catalogResponse.payload.ok ? catalogResponse.payload.tracks.map(toMusicSelectTrack) : []);
        setTopPicks([...topTracksResponse.payload.tracks].sort((first, second) => first.rank - second.rank));
        setRankedTrackIds([...topTracksResponse.payload.tracks]
          .sort((first, second) => first.rank - second.rank)
          .map((track) => track.trackId));
        setTopTrackLimit(Math.min(topTracksResponse.payload.limit, 10));
        setLoadState("ready");
      } catch {
        if (active) {
          setCatalog([]);
          setLoadState("error");
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const catalogByTrackId = useMemo(
    () => {
      const tracksById = new Map<string, MusicUiTrack>();

      for (const track of catalog) {
        if (!tracksById.has(track.trackId)) {
          tracksById.set(track.trackId, track);
        }
      }

      return tracksById;
    },
    [catalog]
  );
  const pickByTrackId = useMemo(
    () => new Map(topPicks.map((pick) => [pick.trackId, pick])),
    [topPicks]
  );
  const rankedRows = useMemo(() => rankedTrackIds.flatMap((trackId) => {
    const catalogTrack = catalogByTrackId.get(trackId);

    if (catalogTrack) {
      return [catalogTrack];
    }

    const pick = pickByTrackId.get(trackId);

    return pick ? [topTrackPickToMusicTrack(pick)] : [];
  }), [catalogByTrackId, pickByTrackId, rankedTrackIds]);
  const canSave = loadState === "ready";

  const addSelectedTrack = (track: MusicUiTrack): void => {
    if (rankedTrackIds.includes(track.trackId)) {
      setMessage(`${track.title} is already in your Top 10.`);
      return;
    }

    if (rankedTrackIds.length >= topTrackLimit) {
      setMessage(`Your Top ${topTrackLimit} is full. Remove a track before adding another.`);
      return;
    }

    setRankedTrackIds((current) => [...current, track.trackId]);
    setMessage(`${track.title} added. Save to publish this ranking to your account.`);
  };

  const moveTrack = (trackId: string, direction: -1 | 1): void => {
    setRankedTrackIds((current) => {
      const index = current.indexOf(trackId);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [track] = next.splice(index, 1);

      if (!track) {
        return current;
      }

      next.splice(nextIndex, 0, track);
      return next;
    });
  };

  const removeTrack = (trackId: string): void => {
    setRankedTrackIds((current) => current.filter((currentTrackId) => currentTrackId !== trackId));
  };

  const saveTopTracks = async (): Promise<void> => {
    setMessage("Saving Top 10...");
    try {
      const response = await saveMusicTopTracks(rankedTrackIds.map((trackId, index) => ({
        rank: index + 1,
        trackId
      })));

      if (!response.payload.ok) {
        setMessage(`Save blocked: ${response.payload.reason}`);
        return;
      }

      const nextTracks = [...response.payload.tracks].sort((first, second) => first.rank - second.rank);
      setTopPicks(nextTracks);
      setRankedTrackIds(nextTracks.map((track) => track.trackId));
      setTopTrackLimit(Math.min(response.payload.limit, 10));
      setMessage("Top 10 saved.");
    } catch {
      setMessage("Top 10 could not be saved right now.");
    }
  };

  return (
    <main className="account-page-panel">
      <header className="account-page-header">
        <div>
          <p className={styles.eyebrow}>Music</p>
          <h1>Top 10</h1>
          <p>Build a ranked list from the live music catalog. Playback still stays under Michael's control.</p>
        </div>
      </header>

      <section className="account-section" aria-labelledby="account-music-picker-heading">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="account-music-picker-heading">Add catalog track</h2>
            <p>Search, preview, then add a track to the ranked list.</p>
          </div>
          <span className={styles.statusPill}>{rankedTrackIds.length}/{topTrackLimit}</span>
        </div>

        <MusicSearchableSelect
          actionLabel="Add"
          disabled={loadState !== "ready"}
          emptyMessage="No live-safe tracks match that search."
          errorMessage={loadState === "signed-out" ? "Sign in to edit your music Top 10." : "Music catalog is unavailable."}
          label="Catalog search"
          loadingMessage="Loading your music list..."
          onAction={(track) => addSelectedTrack(track as MusicUiTrack)}
          onSelectedTrackChange={(track) => setSelectedTrackId(track?.id ?? null)}
          safetyContext="live"
          selectedTrackId={selectedTrackId}
          state={loadState === "loading" ? "loading" : loadState === "error" || loadState === "signed-out" ? "error" : "idle"}
          tracks={catalog}
        />
      </section>

      <section className="account-section" aria-labelledby="account-music-rank-heading">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="account-music-rank-heading">Ranked tracks</h2>
            <p>{message}</p>
          </div>
          <button
            className={styles.primaryButton}
            disabled={!canSave}
            onClick={() => {
              void saveTopTracks();
            }}
            type="button"
          >
            <FiSave aria-hidden="true" />
            Save
          </button>
        </div>

        {rankedRows.length === 0 ? (
          <p className={styles.emptyState}>No ranked tracks yet.</p>
        ) : (
          <div>
            {rankedRows.map((track, index) => (
              <div className={styles.rankRow} key={track.trackId}>
                <span className={styles.rankNumber}>{index + 1}</span>
                <span className={styles.rowTitle}>
                  <strong>{track.title}</strong>
                  <span>{track.artist} / {track.provider} / {formatMusicDuration(catalogByTrackId.get(track.trackId)?.durationSeconds ?? track.durationSeconds)}</span>
                </span>
                <span className={styles.rowActions}>
                  <button
                    aria-label={`Move ${track.title} up`}
                    className={styles.iconButton}
                    disabled={index === 0}
                    onClick={() => moveTrack(track.trackId, -1)}
                    type="button"
                  >
                    <FiArrowUp aria-hidden="true" />
                  </button>
                  <button
                    aria-label={`Move ${track.title} down`}
                    className={styles.iconButton}
                    disabled={index === rankedRows.length - 1}
                    onClick={() => moveTrack(track.trackId, 1)}
                    type="button"
                  >
                    <FiArrowDown aria-hidden="true" />
                  </button>
                  <button
                    aria-label={`Remove ${track.title}`}
                    className={styles.iconButton}
                    onClick={() => removeTrack(track.trackId)}
                    type="button"
                  >
                    <FiTrash2 aria-hidden="true" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default AccountMusicClient;
