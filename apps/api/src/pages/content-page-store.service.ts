import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import type {
  ContentPageRouteScope,
  ContentPageSource,
  ContentPageStatus,
  ContentPageVisibility
} from "@maiks-yt/domain/pages";

import type {
  ContentPageAdminActor,
  ContentPageRepository,
  ContentPageUpdateInput
} from "./content-page.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;
type SqlValue = string | boolean | null;

type ContentPageRow = {
  id: string;
  title: string;
  routeScope: ContentPageRouteScope;
  normalizedPath: string;
  status: ContentPageStatus;
  visibility: ContentPageVisibility;
  seoTitle?: string | null;
  seoDescription?: string | null;
  body: string;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  publishedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toNullableIsoString = (value: Date | string | null | undefined): string | null =>
  value === null || value === undefined ? null : toIsoString(value);

const mapContentPage = (row: ContentPageRow): ContentPageSource => ({
  id: row.id,
  title: row.title,
  routeScope: row.routeScope,
  normalizedPath: row.normalizedPath,
  status: row.status,
  visibility: row.visibility,
  seoTitle: row.seoTitle ?? null,
  seoDescription: row.seoDescription ?? null,
  body: row.body,
  createdByUserId: row.createdByUserId ?? null,
  updatedByUserId: row.updatedByUserId ?? null,
  publishedAt: toNullableIsoString(row.publishedAt),
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt)
});

const selectContentPageFields = `
  id,
  title,
  route_scope AS routeScope,
  normalized_path AS normalizedPath,
  status,
  visibility,
  seo_title AS seoTitle,
  seo_description AS seoDescription,
  body,
  created_by_user_id AS createdByUserId,
  updated_by_user_id AS updatedByUserId,
  published_at AS publishedAt,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const firstPage = (rows: unknown): ContentPageSource | null =>
  Array.isArray(rows) && rows.length > 0 ? mapContentPage(rows[0] as ContentPageRow) : null;

const resolveActor = async (
  executor: QueryExecutor,
  authUserId: string
): Promise<ContentPageAdminActor | null> => {
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

const readPage = async (
  executor: QueryExecutor,
  id: string
): Promise<ContentPageSource | null> => {
  const [rows] = await executor.execute(
    `
      SELECT ${selectContentPageFields}
      FROM content_pages
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return firstPage(rows);
};

const assertReadPage = async (
  executor: QueryExecutor,
  id: string
): Promise<ContentPageSource> => {
  const page = await readPage(executor, id);

  if (!page) {
    throw new Error("content_page_mutation_reread_failed");
  }

  return page;
};

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object"
  && error !== null
  && "code" in error
  && error.code === "ER_DUP_ENTRY";

const normalizedOptionalText = (value: string | null | undefined): string | null =>
  value?.trim() || null;

const updatePageFields = async (
  pool: DatabasePool,
  id: string,
  input: ContentPageUpdateInput & {
    normalizedPath?: string;
    actorUserId: string;
  }
): Promise<ContentPageSource | "not-found" | "path-conflict"> => {
  const fields: string[] = [];
  const values: SqlValue[] = [];

  if (input.title !== undefined) {
    fields.push("title = ?");
    values.push(input.title.trim());
  }
  if (input.normalizedPath !== undefined) {
    fields.push("normalized_path = ?");
    values.push(input.normalizedPath);
  }
  if (input.seoTitle !== undefined) {
    fields.push("seo_title = ?");
    values.push(normalizedOptionalText(input.seoTitle));
  }
  if (input.seoDescription !== undefined) {
    fields.push("seo_description = ?");
    values.push(normalizedOptionalText(input.seoDescription));
  }
  if (input.body !== undefined) {
    fields.push("body = ?");
    values.push(input.body.trim());
  }

  if (fields.length === 0) {
    return await assertReadPage(pool, id);
  }

  fields.push("updated_by_user_id = ?");
  values.push(input.actorUserId);

  try {
    const [result] = await pool.execute(
      `UPDATE content_pages SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ?`,
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
      return "path-conflict";
    }

    throw error;
  }

  return await assertReadPage(pool, id);
};

export const createContentPageRepository = (
  pool: DatabasePool
): ContentPageRepository => ({
  async resolveActor(authUserId) {
    return await resolveActor(pool, authUserId);
  },

  async listPages() {
    const [rows] = await pool.execute(
      `
        SELECT ${selectContentPageFields}
        FROM content_pages
        ORDER BY updated_at DESC, title
      `
    );

    return Array.isArray(rows) ? (rows as ContentPageRow[]).map(mapContentPage) : [];
  },

  async getPage(id) {
    return await readPage(pool, id);
  },

  async createPage(input) {
    const id = randomUUID();

    try {
      await pool.execute(
        `
          INSERT INTO content_pages
            (id, title, route_scope, normalized_path, status, visibility, seo_title, seo_description, body, created_by_user_id, updated_by_user_id)
          VALUES (?, ?, 'primary', ?, 'draft', 'hidden', ?, ?, ?, ?, ?)
        `,
        [
          id,
          input.title.trim(),
          input.normalizedPath,
          normalizedOptionalText(input.seoTitle),
          normalizedOptionalText(input.seoDescription),
          input.body.trim(),
          input.actorUserId,
          input.actorUserId
        ]
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new Error("content_page_path_conflict");
      }

      throw error;
    }

    return await assertReadPage(pool, id);
  },

  async updatePage(id, input) {
    return await updatePageFields(pool, id, input);
  },

  async publishPage(id, actorUserId) {
    const [result] = await pool.execute(
      `
        UPDATE content_pages
        SET status = 'published',
          visibility = 'public',
          published_at = COALESCE(published_at, NOW()),
          updated_by_user_id = ?,
          updated_at = NOW()
        WHERE id = ?
      `,
      [actorUserId, id]
    );

    if (typeof result === "object"
      && result !== null
      && "affectedRows" in result
      && result.affectedRows === 0) {
      return "not-found";
    }

    return await assertReadPage(pool, id);
  },

  async unpublishPage(id, actorUserId) {
    const [result] = await pool.execute(
      `
        UPDATE content_pages
        SET status = 'draft',
          visibility = 'hidden',
          published_at = NULL,
          updated_by_user_id = ?,
          updated_at = NOW()
        WHERE id = ?
      `,
      [actorUserId, id]
    );

    if (typeof result === "object"
      && result !== null
      && "affectedRows" in result
      && result.affectedRows === 0) {
      return "not-found";
    }

    return await assertReadPage(pool, id);
  },

  async findPublicPagesByPath(normalizedPath) {
    const [rows] = await pool.execute(
      `
        SELECT ${selectContentPageFields}
        FROM content_pages
        WHERE route_scope = 'primary'
          AND normalized_path = ?
          AND status = 'published'
          AND visibility = 'public'
        ORDER BY updated_at DESC
      `,
      [normalizedPath]
    );

    return Array.isArray(rows) ? (rows as ContentPageRow[]).map(mapContentPage) : [];
  }
});
