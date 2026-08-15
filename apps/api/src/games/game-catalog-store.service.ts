import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import {
  isGameCatalogResultStale,
  type GameCatalogCandidate,
  type GameCatalogMatchState,
  type GameCatalogProvider,
  type GameCatalogSearchResult
} from "@maiks-yt/domain/games";

import type { GameCatalogRepository } from "./game-catalog.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;

type CatalogRow = {
  catalogGameId: string;
  title: string;
  matchState: GameCatalogMatchState;
  provider: GameCatalogProvider;
  providerGameId: string;
  storeUrl?: string | null;
  artworkUrl?: string | null;
  lastRefreshedAt: Date | string;
};

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const normalizeLookupText = (value: string): string => value.trim().toLocaleLowerCase("en");

const mapCatalogRow = (row: CatalogRow): GameCatalogSearchResult => {
  const lastRefreshedAt = toIsoString(row.lastRefreshedAt);

  return {
    catalogGameId: row.catalogGameId,
    title: row.title,
    matchState: row.matchState,
    provider: row.provider,
    providerGameId: row.providerGameId,
    storeUrl: row.storeUrl ?? null,
    artworkUrl: row.artworkUrl ?? null,
    lastRefreshedAt,
    stale: isGameCatalogResultStale(lastRefreshedAt)
  };
};

const resolveActor = async (
  executor: QueryExecutor,
  authUserId: string
) => {
  const [rows] = await executor.execute(
    `
      SELECT
        users.id AS domainUserId,
        roles.permissions AS rolePermissions
      FROM auth_user_links
      INNER JOIN users ON users.id = auth_user_links.user_id
      LEFT JOIN user_roles ON user_roles.user_id = users.id
      LEFT JOIN roles ON roles.id = user_roles.role_id
      WHERE auth_user_links.auth_user_id = ?
        AND users.deleted_at IS NULL
      ORDER BY roles.key
    `,
    [authUserId]
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const actorRows = rows as Array<{ domainUserId: string; rolePermissions: unknown }>;
  const domainUserId = actorRows[0]?.domainUserId;

  return domainUserId
    ? {
      domainUserId,
      rolePermissionValues: actorRows.map((row) => row.rolePermissions)
    }
    : null;
};

const cacheCandidate = async (
  executor: QueryExecutor,
  candidate: GameCatalogCandidate
): Promise<void> => {
  const [rows] = await executor.execute(
    `
      SELECT
        game_catalog_entries.id AS catalogGameId,
        game_catalog_entries.match_state AS matchState
      FROM game_catalog_provider_identities
      INNER JOIN game_catalog_entries
        ON game_catalog_entries.id = game_catalog_provider_identities.catalog_game_id
      WHERE game_catalog_provider_identities.provider = ?
        AND game_catalog_provider_identities.provider_game_id = ?
      LIMIT 1
    `,
    [candidate.provider, candidate.providerGameId]
  );
  const existing = Array.isArray(rows) && rows.length > 0
    ? rows[0] as { catalogGameId: string; matchState: GameCatalogMatchState }
    : null;

  if (existing) {
    await executor.execute(
      `
        UPDATE game_catalog_entries
        SET
          canonical_title = CASE WHEN match_state = 'discovered' THEN ? ELSE canonical_title END,
          normalized_title = CASE WHEN match_state = 'discovered' THEN ? ELSE normalized_title END,
          last_seen_at = NOW(),
          updated_at = NOW()
        WHERE id = ?
      `,
      [candidate.title, normalizeLookupText(candidate.title), existing.catalogGameId]
    );
    await executor.execute(
      `
        UPDATE game_catalog_provider_identities
        SET
          provider_title = ?,
          store_url = ?,
          artwork_url = ?,
          last_seen_at = NOW(),
          last_refreshed_at = NOW(),
          updated_at = NOW()
        WHERE provider = ?
          AND provider_game_id = ?
      `,
      [
        candidate.title,
        candidate.storeUrl,
        candidate.artworkUrl,
        candidate.provider,
        candidate.providerGameId
      ]
    );
    return;
  }

  const catalogGameId = randomUUID();
  await executor.execute(
    `
      INSERT INTO game_catalog_entries
        (id, canonical_title, normalized_title, match_state)
      VALUES (?, ?, ?, 'discovered')
    `,
    [catalogGameId, candidate.title, normalizeLookupText(candidate.title)]
  );
  await executor.execute(
    `
      INSERT INTO game_catalog_provider_identities
        (id, catalog_game_id, provider, provider_game_id, provider_title, store_url, artwork_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      randomUUID(),
      catalogGameId,
      candidate.provider,
      candidate.providerGameId,
      candidate.title,
      candidate.storeUrl,
      candidate.artworkUrl
    ]
  );
};

export const createGameCatalogRepository = (
  pool: DatabasePool
): GameCatalogRepository => ({
  async resolveActor(authUserId) {
    return await resolveActor(pool, authUserId);
  },

  async searchCached(query) {
    const normalizedQuery = normalizeLookupText(query);
    const [rows] = await pool.execute(
      `
        SELECT
          game_catalog_entries.id AS catalogGameId,
          game_catalog_entries.canonical_title AS title,
          game_catalog_entries.match_state AS matchState,
          game_catalog_provider_identities.provider,
          game_catalog_provider_identities.provider_game_id AS providerGameId,
          game_catalog_provider_identities.store_url AS storeUrl,
          game_catalog_provider_identities.artwork_url AS artworkUrl,
          game_catalog_provider_identities.last_refreshed_at AS lastRefreshedAt
        FROM game_catalog_entries
        INNER JOIN game_catalog_provider_identities
          ON game_catalog_provider_identities.catalog_game_id = game_catalog_entries.id
        WHERE LOCATE(?, game_catalog_entries.normalized_title) > 0
          OR LOCATE(?, LOWER(game_catalog_provider_identities.provider_title)) > 0
        ORDER BY
          CASE
            WHEN game_catalog_entries.normalized_title = ? THEN 0
            WHEN LOCATE(?, game_catalog_entries.normalized_title) = 1 THEN 1
            ELSE 2
          END,
          game_catalog_entries.match_state DESC,
          game_catalog_entries.canonical_title
        LIMIT 20
      `,
      [normalizedQuery, normalizedQuery, normalizedQuery, normalizedQuery]
    );

    return Array.isArray(rows) ? (rows as CatalogRow[]).map(mapCatalogRow) : [];
  },

  async cacheCandidates(candidates) {
    if (candidates.length === 0) {
      return;
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      for (const candidate of candidates) {
        await cacheCandidate(connection, candidate);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
});
