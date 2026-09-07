import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import type {
  PublicUpdateKind,
  PublicUpdateSource,
  PublicUpdateStatus,
  PublicUpdateVisibility
} from "@maiks-yt/domain/updates";

import type {
  PublicUpdateAdminActor,
  PublicUpdateAdminRepository
} from "./public-update-admin.types.js";
import { createPublicUpdateAdminRevision } from "./public-update-admin-revision.service.js";

type QueryExecutor = Pick<DatabasePool, "execute">;
type SqlValue = string | boolean | Date | null;

type PublicUpdateAdminRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  kind: PublicUpdateKind;
  status: PublicUpdateStatus;
  visibility: PublicUpdateVisibility;
  publishedAt: Date | string | null;
  isPinned: boolean | number;
  isExample: boolean | number;
  updatedAt: Date | string;
};

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const mapUpdate = (row: PublicUpdateAdminRow): PublicUpdateSource => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  summary: row.summary,
  body: row.body,
  kind: row.kind,
  status: row.status,
  visibility: row.visibility,
  publishedAt: row.publishedAt ? toIsoString(row.publishedAt) : null,
  isPinned: row.isPinned === true || row.isPinned === 1,
  isExample: row.isExample === true || row.isExample === 1,
  updatedAt: toIsoString(row.updatedAt)
});

const selectFields = `
  id,
  slug,
  title,
  summary,
  body,
  kind,
  status,
  visibility,
  published_at AS publishedAt,
  is_pinned AS isPinned,
  is_example AS isExample,
  updated_at AS updatedAt
`;

const firstUpdate = (rows: unknown): PublicUpdateSource | null =>
  Array.isArray(rows) && rows.length > 0
    ? mapUpdate(rows[0] as PublicUpdateAdminRow)
    : null;

const readUpdate = async (
  executor: QueryExecutor,
  id: string
): Promise<PublicUpdateSource | null> => {
  const [rows] = await executor.execute(
    `SELECT ${selectFields} FROM public_updates WHERE id = ? LIMIT 1`,
    [id]
  );

  return firstUpdate(rows);
};

const assertReadUpdate = async (
  executor: QueryExecutor,
  id: string
): Promise<PublicUpdateSource> => {
  const update = await readUpdate(executor, id);

  if (!update) {
    throw new Error("public_update_mutation_reread_failed");
  }

  return update;
};

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object"
  && error !== null
  && "code" in error
  && error.code === "ER_DUP_ENTRY";

const resolveActor = async (
  executor: QueryExecutor,
  authUserId: string
): Promise<PublicUpdateAdminActor | null> => {
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

  const actorRows = rows as Array<{ domainUserId: string; rolePermissions: unknown }>;
  const domainUserId = actorRows[0]?.domainUserId;

  return domainUserId
    ? {
      domainUserId,
      rolePermissionValues: actorRows.map((row) => row.rolePermissions)
    }
    : null;
};

export const createPublicUpdateAdminRepository = (
  pool: DatabasePool
): PublicUpdateAdminRepository => ({
  async resolveActor(authUserId) {
    return await resolveActor(pool, authUserId);
  },

  async listUpdates() {
    const [rows] = await pool.execute(
      `SELECT ${selectFields} FROM public_updates ORDER BY updated_at DESC, title ASC`
    );

    return Array.isArray(rows)
      ? (rows as PublicUpdateAdminRow[]).map(mapUpdate)
      : [];
  },

  async getUpdate(id) {
    return await readUpdate(pool, id);
  },

  async createUpdate(input) {
    const id = randomUUID();

    try {
      await pool.execute(
        `
          INSERT INTO public_updates
            (id, slug, title, summary, body, kind, status, visibility, published_at, is_pinned, is_example, created_by_user_id, updated_by_user_id)
          VALUES (?, ?, ?, ?, ?, ?, 'draft', 'hidden', NULL, ?, false, ?, ?)
        `,
        [
          id,
          input.slug,
          input.title,
          input.summary,
          input.body,
          input.kind,
          input.isPinned,
          input.actorUserId,
          input.actorUserId
        ]
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return "slug-conflict";
      }

      throw error;
    }

    return await assertReadUpdate(pool, id);
  },

  async updateUpdate(id, input) {
    const fields: string[] = [];
    const values: SqlValue[] = [];

    for (const [field, column] of [
      ["slug", "slug"],
      ["title", "title"],
      ["summary", "summary"],
      ["body", "body"],
      ["kind", "kind"],
      ["isPinned", "is_pinned"]
    ] as const) {
      const value = input[field];

      if (value !== undefined) {
        fields.push(`${column} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return await assertReadUpdate(pool, id);
    }

    fields.push("updated_by_user_id = ?");
    values.push(input.actorUserId);

    try {
      const [result] = await pool.execute(
        `UPDATE public_updates SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ? AND is_example = false AND status = 'draft' AND visibility = 'hidden'`,
        [...values, id]
      );

      if (typeof result === "object" && result !== null && "affectedRows" in result && result.affectedRows === 0) {
        return "not-found";
      }
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return "slug-conflict";
      }

      throw error;
    }

    return await assertReadUpdate(pool, id);
  },

  async publishUpdate(id, actorUserId, expectedUpdate) {
    const [result] = await pool.execute(
      `
        UPDATE public_updates
        SET status = 'published', visibility = 'public', published_at = COALESCE(published_at, NOW()), updated_by_user_id = ?, updated_at = NOW()
        WHERE id = ?
          AND BINARY slug = BINARY ?
          AND BINARY title = BINARY ?
          AND BINARY summary = BINARY ?
          AND BINARY body = BINARY ?
          AND BINARY kind = BINARY ?
          AND is_pinned = ?
          AND is_example = ?
          AND BINARY status = BINARY ?
          AND BINARY visibility = BINARY ?
          AND published_at <=> ?
          AND updated_at = ?
      `,
      [
        actorUserId,
        id,
        expectedUpdate.slug,
        expectedUpdate.title,
        expectedUpdate.summary,
        expectedUpdate.body,
        expectedUpdate.kind,
        expectedUpdate.isPinned,
        expectedUpdate.isExample,
        expectedUpdate.status,
        expectedUpdate.visibility,
        expectedUpdate.publishedAt ? new Date(expectedUpdate.publishedAt) : null,
        new Date(expectedUpdate.updatedAt)
      ]
    );

    if (typeof result === "object" && result !== null && "affectedRows" in result && result.affectedRows === 0) {
      const current = await readUpdate(pool, id);

      if (!current) {
        return "not-found";
      }

      if (!current.isExample
        && current.status === "published"
        && current.visibility === "public"
        && current.publishedAt !== null) {
        return current;
      }

      return createPublicUpdateAdminRevision(current) === createPublicUpdateAdminRevision(expectedUpdate)
        ? "state-conflict"
        : "revision-conflict";
    }

    return await assertReadUpdate(pool, id);
  },

  async unpublishUpdate(id, actorUserId) {
    const [result] = await pool.execute(
      `
        UPDATE public_updates
        SET status = 'draft', visibility = 'hidden', published_at = NULL, updated_by_user_id = ?, updated_at = NOW()
        WHERE id = ?
          AND (status <> 'draft' OR visibility <> 'hidden' OR published_at IS NOT NULL)
      `,
      [actorUserId, id]
    );

    if (typeof result === "object" && result !== null && "affectedRows" in result && result.affectedRows === 0) {
      return await readUpdate(pool, id) ?? "not-found";
    }

    return await assertReadUpdate(pool, id);
  }
});
