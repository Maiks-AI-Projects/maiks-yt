import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";

import type { MusicPlaylistRecord, MusicRepository } from "./music.types.js";
import { mapRows, optionalText, toIso, type QueryExecutor } from "./music-store-shared.service.js";

type PlaylistRow = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  visibility: string;
  reviewState: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export const readPlaylist = async (executor: QueryExecutor, id: string): Promise<MusicPlaylistRecord | null> => {
  const [rows] = await executor.execute(
    `
      SELECT
        id, slug, title, description, visibility, review_state AS reviewState,
        created_at AS createdAt, updated_at AS updatedAt
      FROM music_playlists
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );
  const row = Array.isArray(rows) ? rows[0] as PlaylistRow | undefined : undefined;

  if (!row) {
    return null;
  }

  const [trackRows] = await executor.execute(
    `
      SELECT track_id AS trackId, sort_order AS sortOrder
      FROM music_playlist_tracks
      WHERE playlist_id = ?
      ORDER BY sort_order, added_at
    `,
    [id]
  );

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? null,
    visibility: row.visibility,
    reviewState: row.reviewState,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    tracks: Array.isArray(trackRows)
      ? (trackRows as Array<{ trackId: string; sortOrder: number }>).map((track) => ({
        trackId: track.trackId,
        sortOrder: track.sortOrder
      }))
      : []
  };
};



export const createMusicPlaylistRepository = (pool: DatabasePool): Pick<MusicRepository,
  | "listPlaylists"
  | "createPlaylist"
  | "updatePlaylist"
  | "replacePlaylistTracks"
> => ({
  async listPlaylists() {
    const [rows] = await pool.execute(
      `
        SELECT id, slug, title, description, visibility, review_state AS reviewState,
          created_at AS createdAt, updated_at AS updatedAt
        FROM music_playlists
        ORDER BY updated_at DESC, title
        LIMIT 100
      `
    );
    const playlists = mapRows<PlaylistRow, MusicPlaylistRecord>(rows, (row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description ?? null,
      visibility: row.visibility,
      reviewState: row.reviewState,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
      tracks: []
    }));

    return await Promise.all(playlists.map((playlist) => readPlaylist(pool, playlist.id))).then((items) =>
      items.filter((item): item is MusicPlaylistRecord => item !== null)
    );
  },

  async createPlaylist(input) {
    const id = randomUUID();
    await pool.execute(
      `
        INSERT INTO music_playlists
          (id, slug, title, description, visibility, review_state, created_by_user_id, updated_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        input.slug.trim(),
        input.title.trim(),
        optionalText(input.description),
        input.visibility ?? "private",
        input.reviewState ?? "draft",
        input.actorUserId,
        input.actorUserId
      ]
    );
    const playlist = await readPlaylist(pool, id);

    if (!playlist) {
      throw new Error("music_playlist_reread_failed");
    }

    return playlist;
  },

  async updatePlaylist(input) {
    const existing = await readPlaylist(pool, input.id);

    if (!existing) {
      return null;
    }

    await pool.execute(
      `
        UPDATE music_playlists
        SET slug = ?, title = ?, description = ?, visibility = ?, review_state = ?,
          updated_by_user_id = ?, updated_at = NOW()
        WHERE id = ?
      `,
      [
        input.slug.trim(),
        input.title.trim(),
        optionalText(input.description),
        input.visibility ?? existing.visibility,
        input.reviewState ?? existing.reviewState,
        input.actorUserId,
        input.id
      ]
    );

    return await readPlaylist(pool, input.id);
  },

  async replacePlaylistTracks(input) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const existing = await readPlaylist(connection, input.playlistId);

      if (!existing) {
        await connection.rollback();
        return null;
      }

      await connection.execute("DELETE FROM music_playlist_tracks WHERE playlist_id = ?", [input.playlistId]);

      for (const track of input.tracks) {
        await connection.execute(
          `
            INSERT INTO music_playlist_tracks
              (id, playlist_id, track_id, sort_order, added_by_user_id)
            VALUES (?, ?, ?, ?, ?)
          `,
          [randomUUID(), input.playlistId, track.trackId, track.sortOrder, input.actorUserId]
        );
      }

      await connection.commit();
      return await readPlaylist(pool, input.playlistId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
});
