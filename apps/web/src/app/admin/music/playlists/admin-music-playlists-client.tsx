"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { FiArrowDown, FiArrowUp, FiSave, FiTrash2 } from "react-icons/fi";

import { captureDevAuthTokenFromUrl } from "../../../dev-auth-token";
import { MusicSearchableSelect } from "../../../music/components";
import {
  createAdminMusicRecord,
  updateAdminMusicRecord
} from "../../../music/music-api.service";
import type { MusicAdminOverview, MusicPlaylistRecord, MusicUiTrack } from "../../../music/music-api.types";
import {
  adminTrackToMusicSelectTrack,
  formatMusicDuration
} from "../../../music/music-track-mapping.service";
import styles from "../../../music/music.module.css";
import {
  emptyMusicAdminOverview,
  loadMusicAdminOverview,
  nullableStringValue,
  stringValue,
  type MusicAdminLoadState
} from "../admin-music-data.service";
import {
  CompactRows,
  MusicAdminHeader,
  MusicAdminStatus,
  SelectField,
  TextField
} from "../admin-music-shared";

const visibilityOptions = ["private", "unlisted", "public"] as const;
const reviewStateOptions = ["draft", "review", "approved", "restricted", "archived"] as const;

const AdminMusicPlaylistsClient = (): React.ReactNode => {
  const [loadState, setLoadState] = useState<MusicAdminLoadState>("loading");
  const [message, setMessage] = useState("Create or edit playlist records from live catalog data.");
  const [overview, setOverview] = useState<MusicAdminOverview>(emptyMusicAdminOverview);
  const [playlistTrackIds, setPlaylistTrackIds] = useState<readonly string[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  const selectedPlaylist = useMemo(
    () => overview.playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? null,
    [overview.playlists, selectedPlaylistId]
  );
  const selectableTracks = useMemo(() => overview.tracks.map(adminTrackToMusicSelectTrack), [overview.tracks]);
  const catalogByTrackId = useMemo(
    () => new Map(selectableTracks.map((track) => [track.trackId, track])),
    [selectableTracks]
  );

  const refresh = async (): Promise<void> => {
    setLoadState("loading");
    const result = await loadMusicAdminOverview();
    setLoadState(result.loadState);
    setOverview(result.overview);
  };

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void refresh();
  }, []);

  useEffect(() => {
    setPlaylistTrackIds(
      [...(selectedPlaylist?.tracks ?? [])]
        .sort((first, second) => first.sortOrder - second.sortOrder)
        .map((track) => track.trackId)
    );
  }, [selectedPlaylist]);

  const submitPlaylist = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setMessage("Saving playlist...");
    const data = new FormData(event.currentTarget);
    const body = {
      description: nullableStringValue(data, "description"),
      reviewState: stringValue(data, "reviewState"),
      slug: stringValue(data, "slug"),
      title: stringValue(data, "title"),
      visibility: stringValue(data, "visibility")
    };

    try {
      const response = selectedPlaylist
        ? await updateAdminMusicRecord(`/admin/music/playlists/${encodeURIComponent(selectedPlaylist.id)}`, body)
        : await createAdminMusicRecord("/admin/music/playlists", body);

      if (!response.payload.ok) {
        setMessage(`Playlist save blocked: ${response.payload.reason}`);
        return;
      }

      setMessage(selectedPlaylist ? "Playlist updated." : "Playlist saved.");
      await refresh();
    } catch {
      setMessage("Playlist save failed.");
    }
  };

  const addTrack = (track: MusicUiTrack): void => {
    if (playlistTrackIds.includes(track.trackId)) {
      setMessage(`${track.title} is already in this playlist.`);
      return;
    }

    setPlaylistTrackIds((current) => [...current, track.trackId]);
    setMessage(`${track.title} added. Save track order to update membership.`);
  };

  const moveTrack = (trackId: string, direction: -1 | 1): void => {
    setPlaylistTrackIds((current) => {
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
    setPlaylistTrackIds((current) => current.filter((currentTrackId) => currentTrackId !== trackId));
  };

  const savePlaylistTracks = async (): Promise<void> => {
    if (!selectedPlaylist) {
      setMessage("Select a playlist before saving track membership.");
      return;
    }

    setMessage("Saving playlist tracks...");
    try {
      const response = await updateAdminMusicRecord(`/admin/music/playlists/${encodeURIComponent(selectedPlaylist.id)}/tracks`, {
        tracks: playlistTrackIds.map((trackId, index) => ({
          sortOrder: index,
          trackId
        }))
      });

      if (!response.payload.ok) {
        setMessage(`Playlist track save blocked: ${response.payload.reason}`);
        return;
      }

      setMessage("Playlist track order saved.");
      await refresh();
    } catch {
      setMessage("Playlist track save failed.");
    }
  };

  return (
    <>
      <MusicAdminHeader
        description="Create, edit, and order music playlist records."
        title="Music Playlists"
      />
      <MusicAdminStatus
        countLabel={`${overview.playlists.length} playlists`}
        loadState={loadState}
        message={message}
        onRefresh={() => void refresh()}
      />
      <section className={styles.adminSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Playlist Entry</h2>
            <p>{selectedPlaylist ? `Editing ${selectedPlaylist.title}` : "Create a new playlist."}</p>
          </div>
          {selectedPlaylist ? (
            <button className={styles.textButton} onClick={() => setSelectedPlaylistId(null)} type="button">New playlist</button>
          ) : null}
        </div>
        <PlaylistSelector
          onSelectedPlaylistIdChange={setSelectedPlaylistId}
          playlists={overview.playlists}
          selectedPlaylistId={selectedPlaylistId}
        />
        <PlaylistForm
          key={selectedPlaylist?.id ?? "new-playlist"}
          onSubmit={submitPlaylist}
          playlist={selectedPlaylist}
        />
        <CompactRows
          emptyLabel="No playlists returned."
          rows={overview.playlists.map((playlist) => ({
            action: `${playlist.tracks.length} tracks`,
            meta: playlist.slug,
            state: `${playlist.visibility} / ${playlist.reviewState}`,
            title: playlist.title
          }))}
        />
      </section>

      <section className={styles.adminSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Track Membership</h2>
            <p>{selectedPlaylist ? `${playlistTrackIds.length} ordered tracks selected.` : "Select a playlist to edit track membership."}</p>
          </div>
          <button
            className={styles.primaryButton}
            disabled={!selectedPlaylist}
            onClick={() => {
              void savePlaylistTracks();
            }}
            type="button"
          >
            <FiSave aria-hidden="true" />
            Save order
          </button>
        </div>
        <MusicSearchableSelect
          actionLabel="Add"
          disabled={!selectedPlaylist}
          label="Search catalog tracks"
          onAction={(track) => addTrack(track as MusicUiTrack)}
          onSelectedTrackChange={(track) => setSelectedTrackId(track?.id ?? null)}
          safetyContext="none"
          selectedTrackId={selectedTrackId}
          tracks={selectableTracks}
        />
        {playlistTrackIds.length === 0 ? (
          <p className={styles.emptyState}>No playlist tracks selected.</p>
        ) : (
          <div>
            {playlistTrackIds.map((trackId, index) => {
              const track = catalogByTrackId.get(trackId);

              return (
                <div className={styles.rankRow} key={trackId}>
                  <span className={styles.rankNumber}>{index + 1}</span>
                  <span className={styles.rowTitle}>
                    <strong>{track?.title ?? trackId}</strong>
                    <span>{track ? `${track.artist} / ${track.provider} / ${formatMusicDuration(track.durationSeconds ?? null)}` : trackId}</span>
                  </span>
                  <span className={styles.rowActions}>
                    <button
                      aria-label={`Move ${track?.title ?? trackId} up`}
                      className={styles.iconButton}
                      disabled={index === 0}
                      onClick={() => moveTrack(trackId, -1)}
                      type="button"
                    >
                      <FiArrowUp aria-hidden="true" />
                    </button>
                    <button
                      aria-label={`Move ${track?.title ?? trackId} down`}
                      className={styles.iconButton}
                      disabled={index === playlistTrackIds.length - 1}
                      onClick={() => moveTrack(trackId, 1)}
                      type="button"
                    >
                      <FiArrowDown aria-hidden="true" />
                    </button>
                    <button
                      aria-label={`Remove ${track?.title ?? trackId}`}
                      className={styles.iconButton}
                      onClick={() => removeTrack(trackId)}
                      type="button"
                    >
                      <FiTrash2 aria-hidden="true" />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
};

const PlaylistSelector = ({ onSelectedPlaylistIdChange, playlists, selectedPlaylistId }: {
  readonly onSelectedPlaylistIdChange: (playlistId: string | null) => void;
  readonly playlists: readonly MusicPlaylistRecord[];
  readonly selectedPlaylistId: string | null;
}): React.ReactNode => (
  <label className={styles.compactSelect}>
    <span>Existing playlist</span>
    <select
      onChange={(event) => onSelectedPlaylistIdChange(event.currentTarget.value || null)}
      value={selectedPlaylistId ?? ""}
    >
      <option value="">New playlist</option>
      {playlists.map((playlist) => (
        <option key={playlist.id} value={playlist.id}>{playlist.title} / {playlist.slug}</option>
      ))}
    </select>
  </label>
);

const PlaylistForm = ({ onSubmit, playlist }: {
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly playlist: MusicPlaylistRecord | null;
}): React.ReactNode => (
  <form className={styles.formGrid} onSubmit={(event) => void onSubmit(event)}>
    <TextField defaultValue={playlist?.slug} name="slug" label="Slug" required />
    <TextField defaultValue={playlist?.title} name="title" label="Title" required />
    <SelectField defaultValue={playlist?.visibility} name="visibility" label="Visibility" options={visibilityOptions} />
    <SelectField defaultValue={playlist?.reviewState} name="reviewState" label="Review" options={reviewStateOptions} />
    <TextField defaultValue={playlist?.description ?? ""} name="description" label="Description" />
    <button className={styles.primaryButton} type="submit">{playlist ? "Update playlist" : "Save playlist"}</button>
  </form>
);

export default AdminMusicPlaylistsClient;
