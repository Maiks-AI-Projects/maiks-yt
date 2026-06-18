import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import type {
  CreatorLinkAvailability,
  CreatorLinkIcon,
  CreatorLinkPurpose,
  CreatorLinkSource
} from "@maiks-yt/domain";

import type {
  CreatorLinkAdminActor,
  CreatorLinkAdminInput,
  CreatorLinkAdminRepository,
  CreatorLinkAdminReorderInput
} from "./creator-link-admin.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;

type CreatorLinkRow = {
  key: string;
  title: string;
  description: string;
  purpose: CreatorLinkPurpose;
  icon: CreatorLinkIcon;
  availability: CreatorLinkAvailability;
  href?: string | null;
  availabilityNote?: string | null;
  isPrimary: number | boolean;
  sortOrder: number;
  isPublished: number | boolean;
};

const mapCreatorLink = (row: CreatorLinkRow): CreatorLinkSource => ({
  key: row.key,
  title: row.title,
  description: row.description,
  purpose: row.purpose,
  icon: row.icon,
  availability: row.availability,
  href: row.href ?? null,
  availabilityNote: row.availabilityNote ?? null,
  isPrimary: Boolean(row.isPrimary),
  sortOrder: row.sortOrder,
  isPublished: Boolean(row.isPublished)
});

const listLinks = async (executor: QueryExecutor): Promise<readonly CreatorLinkSource[]> => {
  const [rows] = await executor.execute(
    `
      SELECT
        \`key\`,
        title,
        description,
        purpose,
        icon,
        availability,
        href,
        availability_note AS availabilityNote,
        is_primary AS isPrimary,
        sort_order AS sortOrder,
        is_published AS isPublished
      FROM creator_links
      ORDER BY sort_order, title, \`key\`
    `
  );

  return Array.isArray(rows)
    ? (rows as CreatorLinkRow[]).map(mapCreatorLink)
    : [];
};

const readLink = async (
  executor: QueryExecutor,
  key: string
): Promise<CreatorLinkSource | null> => {
  const [rows] = await executor.execute(
    `
      SELECT
        \`key\`,
        title,
        description,
        purpose,
        icon,
        availability,
        href,
        availability_note AS availabilityNote,
        is_primary AS isPrimary,
        sort_order AS sortOrder,
        is_published AS isPublished
      FROM creator_links
      WHERE \`key\` = ?
      LIMIT 1
    `,
    [key]
  );

  return Array.isArray(rows) && rows.length > 0
    ? mapCreatorLink(rows[0] as CreatorLinkRow)
    : null;
};

const resolveActor = async (
  executor: QueryExecutor,
  authUserId: string
): Promise<CreatorLinkAdminActor | null> => {
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

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object"
  && error !== null
  && "code" in error
  && error.code === "ER_DUP_ENTRY";

const writeValues = (input: CreatorLinkAdminInput) => [
  input.key,
  input.title.trim(),
  input.description.trim(),
  input.purpose,
  input.icon,
  input.availability,
  input.href?.trim() || null,
  input.availabilityNote?.trim() || null,
  input.isPrimary,
  input.sortOrder,
  input.isPublished
];

export const createCreatorLinkAdminRepository = (
  pool: DatabasePool
): CreatorLinkAdminRepository => ({
  async resolveActor(authUserId) {
    return await resolveActor(pool, authUserId);
  },

  async listLinks() {
    return await listLinks(pool);
  },

  async createLink(input) {
    try {
      await pool.execute(
        `
          INSERT INTO creator_links
            (id, \`key\`, title, description, purpose, icon, availability, href, availability_note, is_primary, sort_order, is_published)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [randomUUID(), ...writeValues(input)]
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new Error("creator_link_key_conflict");
      }

      throw error;
    }

    const link = await readLink(pool, input.key);

    if (!link) {
      throw new Error("creator_link_admin_mutation_reread_failed");
    }

    return link;
  },

  async updateLink(key, input) {
    try {
      const [result] = await pool.execute(
        `
          UPDATE creator_links
          SET
            \`key\` = ?,
            title = ?,
            description = ?,
            purpose = ?,
            icon = ?,
            availability = ?,
            href = ?,
            availability_note = ?,
            is_primary = ?,
            sort_order = ?,
            is_published = ?,
            updated_at = NOW()
          WHERE \`key\` = ?
        `,
        [...writeValues(input), key]
      );

      if (typeof result === "object"
        && result !== null
        && "affectedRows" in result
        && result.affectedRows === 0) {
        return "not-found";
      }
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return "key-conflict";
      }

      throw error;
    }

    const link = await readLink(pool, input.key);

    if (!link) {
      throw new Error("creator_link_admin_mutation_reread_failed");
    }

    return link;
  },

  async reorderLinks(input: CreatorLinkAdminReorderInput) {
    for (const [index, key] of input.orderedKeys.entries()) {
      const [result] = await pool.execute(
        "UPDATE creator_links SET sort_order = ?, updated_at = NOW() WHERE `key` = ?",
        [index + 1, key]
      );

      if (typeof result === "object"
        && result !== null
        && "affectedRows" in result
        && result.affectedRows === 0) {
        return "not-found";
      }
    }

    return await listLinks(pool);
  }
});
