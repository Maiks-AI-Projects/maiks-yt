import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import type {
  GameInterestStatus,
  GameScheduleAssociationSummary,
  GameLibrarySource,
  GameOwnershipStatus,
  GameSuggestionSource,
  GameSuggestionStatus,
  GameVisibility
} from "@maiks-yt/domain/games";

import type {
  GameLibraryAdminActor,
  GameLibraryRepository,
  GameLibraryUpdateInput
} from "./game-library.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;
type SqlValue = string | number | boolean | null;

type GameLibraryRow = {
  id: string;
  slug: string;
  title: string;
  platformLabel?: string | null;
  storeProvider?: string | null;
  storeUrl?: string | null;
  ownershipStatus: GameOwnershipStatus;
  interestStatus: GameInterestStatus;
  streamFitNote?: string | null;
  contentWarnings?: string | null;
  categoryLabel?: string | null;
  visibility: GameVisibility;
  sortOrder: number;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type GameSuggestionRow = {
  id: string;
  title: string;
  platformLabel?: string | null;
  storeUrl?: string | null;
  reason?: string | null;
  tags?: unknown;
  suggestedByUserId?: string | null;
  suggestedByName?: string | null;
  status: GameSuggestionStatus;
  linkedGameId?: string | null;
  reviewerUserId?: string | null;
  reviewerNote?: string | null;
  reviewedAt?: Date | string | null;
  isPublic?: boolean | number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type GameScheduleAssociationRow = {
  gameId: string;
  scheduleEntryId: string;
  title: string;
  startsAt: Date | string;
  endsAt?: Date | string | null;
  channelKey: string;
  visibility: GameScheduleAssociationSummary["visibility"];
  status: GameScheduleAssociationSummary["status"];
  relationship: GameScheduleAssociationSummary["relationship"];
  publicNote?: string | null;
  sortOrder: number;
};

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const mapGame = (row: GameLibraryRow): GameLibrarySource => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  platformLabel: row.platformLabel ?? null,
  storeProvider: row.storeProvider ?? null,
  storeUrl: row.storeUrl ?? null,
  artworkUrl: null,
  popularityScore: null,
  ownershipStatus: row.ownershipStatus,
  interestStatus: row.interestStatus,
  streamFitNote: row.streamFitNote ?? null,
  contentWarnings: row.contentWarnings ?? null,
  categoryLabel: row.categoryLabel ?? null,
  visibility: row.visibility,
  sortOrder: row.sortOrder,
  createdByUserId: row.createdByUserId ?? null,
  updatedByUserId: row.updatedByUserId ?? null,
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt)
});

const parseTags = (value: unknown): readonly string[] => {
  if (Array.isArray(value)) {
    return value.filter((tag): tag is string => typeof tag === "string");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((tag): tag is string => typeof tag === "string")
        : [];
    } catch {
      return [];
    }
  }

  return [];
};

const mapSuggestion = (row: GameSuggestionRow): GameSuggestionSource => ({
  id: row.id,
  title: row.title,
  platformLabel: row.platformLabel ?? null,
  storeUrl: row.storeUrl ?? null,
  reason: row.reason ?? null,
  tags: parseTags(row.tags),
  suggestedByUserId: row.suggestedByUserId ?? null,
  suggestedByName: row.suggestedByName ?? null,
  status: row.status,
  linkedGameId: row.linkedGameId ?? null,
  reviewerUserId: row.reviewerUserId ?? null,
  reviewerNote: row.reviewerNote ?? null,
  reviewedAt: row.reviewedAt ? toIsoString(row.reviewedAt) : null,
  isPublic: row.isPublic === true || row.isPublic === 1,
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt)
});

const mapScheduleAssociation = (row: GameScheduleAssociationRow): GameScheduleAssociationSummary => ({
  scheduleEntryId: row.scheduleEntryId,
  title: row.title,
  startsAt: toIsoString(row.startsAt),
  endsAt: row.endsAt ? toIsoString(row.endsAt) : null,
  channelKey: row.channelKey,
  visibility: row.visibility,
  status: row.status,
  relationship: row.relationship,
  publicNote: row.publicNote ?? null,
  sortOrder: row.sortOrder
});

const selectGameFields = `
  id,
  slug,
  title,
  platform_label AS platformLabel,
  store_provider AS storeProvider,
  store_url AS storeUrl,
  ownership_status AS ownershipStatus,
  interest_status AS interestStatus,
  stream_fit_note AS streamFitNote,
  content_warnings AS contentWarnings,
  category_label AS categoryLabel,
  visibility,
  sort_order AS sortOrder,
  created_by_user_id AS createdByUserId,
  updated_by_user_id AS updatedByUserId,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const selectSuggestionFields = `
  id,
  title,
  platform_label AS platformLabel,
  store_url AS storeUrl,
  reason,
  tags,
  suggested_by_user_id AS suggestedByUserId,
  suggested_by_name AS suggestedByName,
  status,
  linked_game_id AS linkedGameId,
  reviewer_user_id AS reviewerUserId,
  reviewer_note AS reviewerNote,
  reviewed_at AS reviewedAt,
  is_public AS isPublic,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const firstGame = (rows: unknown): GameLibrarySource | null =>
  Array.isArray(rows) && rows.length > 0 ? mapGame(rows[0] as GameLibraryRow) : null;

const resolveActor = async (
  executor: QueryExecutor,
  authUserId: string
): Promise<GameLibraryAdminActor | null> => {
  const [rows] = await executor.execute(
    `
      SELECT
        users.id AS domainUserId,
        roles.permissions AS rolePermissions
      FROM auth_user_links
      INNER JOIN users ON users.id = auth_user_links.user_id
      LEFT JOIN user_roles ON user_roles.user_id = users.id
        AND user_roles.revoked_at IS NULL
        AND (user_roles.expires_at IS NULL OR user_roles.expires_at > NOW())
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

  const actorRows = rows as Array<{
    domainUserId: string;
    rolePermissions: unknown;
  }>;
  const domainUserId = actorRows[0]?.domainUserId;

  if (!domainUserId) {
    return null;
  }

  return {
    domainUserId,
    rolePermissionValues: actorRows.map((row) => row.rolePermissions)
  };
};

const readGame = async (
  executor: QueryExecutor,
  id: string
): Promise<GameLibrarySource | null> => {
  const [rows] = await executor.execute(
    `
      SELECT ${selectGameFields}
      FROM game_library_entries
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return firstGame(rows);
};

const assertReadGame = async (
  executor: QueryExecutor,
  id: string
): Promise<GameLibrarySource> => {
  const game = await readGame(executor, id);

  if (!game) {
    throw new Error("game_library_mutation_reread_failed");
  }

  return game;
};

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object"
  && error !== null
  && "code" in error
  && error.code === "ER_DUP_ENTRY";

const normalizedOptionalText = (value: string | null | undefined): string | null =>
  value?.trim() || null;

const updateGameFields = async (
  pool: DatabasePool,
  id: string,
  input: GameLibraryUpdateInput & {
    slug?: string;
    actorUserId: string;
  }
): Promise<GameLibrarySource | "not-found" | "slug-conflict"> => {
  const fields: string[] = [];
  const values: SqlValue[] = [];

  if (input.title !== undefined) {
    fields.push("title = ?");
    values.push(input.title.trim());
  }
  if (input.slug !== undefined) {
    fields.push("slug = ?");
    values.push(input.slug);
  }
  if (input.platformLabel !== undefined) {
    fields.push("platform_label = ?");
    values.push(normalizedOptionalText(input.platformLabel));
  }
  if (input.storeProvider !== undefined) {
    fields.push("store_provider = ?");
    values.push(normalizedOptionalText(input.storeProvider));
  }
  if (input.storeUrl !== undefined) {
    fields.push("store_url = ?");
    values.push(normalizedOptionalText(input.storeUrl));
  }
  if (input.ownershipStatus !== undefined) {
    fields.push("ownership_status = ?");
    values.push(input.ownershipStatus);
  }
  if (input.interestStatus !== undefined) {
    fields.push("interest_status = ?");
    values.push(input.interestStatus);
  }
  if (input.streamFitNote !== undefined) {
    fields.push("stream_fit_note = ?");
    values.push(normalizedOptionalText(input.streamFitNote));
  }
  if (input.contentWarnings !== undefined) {
    fields.push("content_warnings = ?");
    values.push(normalizedOptionalText(input.contentWarnings));
  }
  if (input.categoryLabel !== undefined) {
    fields.push("category_label = ?");
    values.push(normalizedOptionalText(input.categoryLabel));
  }
  if (input.visibility !== undefined) {
    fields.push("visibility = ?");
    values.push(input.visibility);
  }
  if (input.sortOrder !== undefined) {
    fields.push("sort_order = ?");
    values.push(input.sortOrder);
  }

  if (fields.length === 0) {
    return await assertReadGame(pool, id);
  }

  fields.push("updated_by_user_id = ?");
  values.push(input.actorUserId);

  try {
    const [result] = await pool.execute(
      `UPDATE game_library_entries SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ?`,
      [...values, id]
    );

    if (typeof result === "object"
      && result !== null
      && "affectedRows" in result
      && result.affectedRows === 0) {
      return "not-found";
    }
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return "slug-conflict";
    }

    throw error;
  }

  return await assertReadGame(pool, id);
};

export const createGameLibraryRepository = (
  pool: DatabasePool
): GameLibraryRepository => ({
  async resolveActor(authUserId) {
    return await resolveActor(pool, authUserId);
  },

  async listGames() {
    const [rows] = await pool.execute(
      `
        SELECT ${selectGameFields}
        FROM game_library_entries
        ORDER BY sort_order, title
      `
    );

    return Array.isArray(rows) ? (rows as GameLibraryRow[]).map(mapGame) : [];
  },

  async listGameScheduleAssociations(gameIds, now) {
    const uniqueGameIds = [...new Set(gameIds)].filter((id) => id.length > 0);
    const associationsByGameId = new Map<string, GameScheduleAssociationSummary[]>();

    if (uniqueGameIds.length === 0) {
      return associationsByGameId;
    }

    const placeholders = uniqueGameIds.map(() => "?").join(", ");
    const [rows] = await pool.execute(
      `
        SELECT
          game_schedule_links.game_id AS gameId,
          stream_schedule_entries.id AS scheduleEntryId,
          stream_schedule_entries.title,
          stream_schedule_entries.starts_at AS startsAt,
          stream_schedule_entries.ends_at AS endsAt,
          stream_schedule_entries.channel_key AS channelKey,
          stream_schedule_entries.visibility,
          stream_schedule_entries.status,
          game_schedule_links.relationship,
          game_schedule_links.public_note AS publicNote,
          game_schedule_links.sort_order AS sortOrder
        FROM game_schedule_links
        INNER JOIN stream_schedule_entries
          ON stream_schedule_entries.id = game_schedule_links.schedule_entry_id
        WHERE game_schedule_links.game_id IN (${placeholders})
          AND game_schedule_links.relationship IN ('planned', 'current')
          AND stream_schedule_entries.status IN ('planned', 'live')
          AND (
            stream_schedule_entries.status = 'live'
            OR stream_schedule_entries.starts_at >= ?
          )
        ORDER BY stream_schedule_entries.starts_at, game_schedule_links.sort_order, stream_schedule_entries.title
      `,
      [...uniqueGameIds, now]
    );

    if (!Array.isArray(rows)) {
      return associationsByGameId;
    }

    for (const row of rows as GameScheduleAssociationRow[]) {
      const currentAssociations = associationsByGameId.get(row.gameId) ?? [];
      currentAssociations.push(mapScheduleAssociation(row));
      associationsByGameId.set(row.gameId, currentAssociations);
    }

    return associationsByGameId;
  },

  async listSuggestions() {
    const [rows] = await pool.execute(
      `
        SELECT ${selectSuggestionFields}
        FROM game_suggestions
        ORDER BY
          CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
          created_at DESC
      `
    );

    return Array.isArray(rows) ? (rows as GameSuggestionRow[]).map(mapSuggestion) : [];
  },

  async getGame(id) {
    return await readGame(pool, id);
  },

  async createGame(input) {
    const id = randomUUID();

    try {
      await pool.execute(
        `
          INSERT INTO game_library_entries
            (id, slug, title, platform_label, store_provider, store_url, ownership_status, interest_status, stream_fit_note, content_warnings, category_label, visibility, sort_order, created_by_user_id, updated_by_user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          input.slug,
          input.title.trim(),
          normalizedOptionalText(input.platformLabel),
          normalizedOptionalText(input.storeProvider),
          normalizedOptionalText(input.storeUrl),
          input.ownershipStatus,
          input.interestStatus,
          normalizedOptionalText(input.streamFitNote),
          normalizedOptionalText(input.contentWarnings),
          normalizedOptionalText(input.categoryLabel),
          input.visibility,
          input.sortOrder ?? 0,
          input.actorUserId,
          input.actorUserId
        ]
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new Error("game_library_slug_conflict");
      }

      throw error;
    }

    return await assertReadGame(pool, id);
  },

  async updateGame(id, input) {
    return await updateGameFields(pool, id, input);
  },

  async listPublicGames() {
    const [rows] = await pool.execute(
      `
        SELECT ${selectGameFields}
        FROM game_library_entries
        WHERE visibility = 'public'
        ORDER BY sort_order, title
      `
    );

    return Array.isArray(rows) ? (rows as GameLibraryRow[]).map(mapGame) : [];
  },

  async createSuggestion(input) {
    const id = randomUUID();
    await pool.execute(
      `
        INSERT INTO game_suggestions
          (id, title, platform_label, store_url, reason, tags, suggested_by_name, status, is_public)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0)
      `,
      [
        id,
        input.title.trim(),
        normalizedOptionalText(input.platformLabel),
        normalizedOptionalText(input.storeUrl),
        normalizedOptionalText(input.reason),
        JSON.stringify(input.tags ?? []),
        normalizedOptionalText(input.suggestedByName)
      ]
    );

    const [rows] = await pool.execute(
      `
        SELECT ${selectSuggestionFields}
        FROM game_suggestions
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("game_suggestion_mutation_reread_failed");
    }

    return mapSuggestion(rows[0] as GameSuggestionRow);
  },

  async reviewSuggestion(id, input) {
    if (input.linkedGameId) {
      const [gameRows] = await pool.execute(
        "SELECT id FROM game_library_entries WHERE id = ? LIMIT 1",
        [input.linkedGameId]
      );

      if (!Array.isArray(gameRows) || gameRows.length === 0) {
        return "invalid-game";
      }
    }

    const [result] = await pool.execute(
      `
        UPDATE game_suggestions
        SET
          status = ?,
          linked_game_id = ?,
          reviewer_user_id = ?,
          reviewer_note = ?,
          reviewed_at = NOW(),
          is_public = 0,
          updated_at = NOW()
        WHERE id = ?
      `,
      [
        input.status,
        input.linkedGameId ?? null,
        input.reviewerUserId,
        normalizedOptionalText(input.reviewerNote),
        id
      ]
    );

    if (typeof result === "object"
      && result !== null
      && "affectedRows" in result
      && result.affectedRows === 0) {
      return "not-found";
    }

    const [rows] = await pool.execute(
      `
        SELECT ${selectSuggestionFields}
        FROM game_suggestions
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("game_suggestion_mutation_reread_failed");
    }

    return mapSuggestion(rows[0] as GameSuggestionRow);
  }
});
