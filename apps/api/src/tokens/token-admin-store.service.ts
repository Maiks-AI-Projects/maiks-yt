import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import {
  getUrlAccessTokenAdminTargetDefinition,
  getUrlAccessTokenAdminTargetForRecord,
  type UrlAccessSurface
} from "@maiks-yt/domain/security";

import type {
  UrlAccessTokenAdminActor,
  UrlAccessTokenAdminInsertInput,
  UrlAccessTokenAdminListItem,
  UrlAccessTokenAdminRepository
} from "./token-admin.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;

type UrlAccessTokenAdminRow = {
  id: string;
  label: string;
  surface: UrlAccessSurface;
  scopes: unknown;
  requiresLogin: number | boolean;
  expiresAt?: Date | null;
  revokedAt?: Date | null;
  lastUsedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const parseJsonArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toNullableIsoString = (value?: Date | string | null): string | null =>
  value ? toIsoString(value) : null;

const mapToken = (row: UrlAccessTokenAdminRow): UrlAccessTokenAdminListItem => {
  const scopes = parseJsonArray(row.scopes).filter((scope): scope is string => typeof scope === "string");
  const target = getUrlAccessTokenAdminTargetForRecord({
    surface: row.surface,
    scopes
  });

  return {
    id: row.id,
    label: row.label,
    target,
    surface: row.surface,
    scopes,
    requiresLogin: Boolean(row.requiresLogin),
    devBaseUrl: target ? getUrlAccessTokenAdminTargetDefinition(target).devBaseUrl : null,
    expiresAt: toNullableIsoString(row.expiresAt),
    revokedAt: toNullableIsoString(row.revokedAt),
    lastUsedAt: toNullableIsoString(row.lastUsedAt),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt)
  };
};

const selectTokenFields = `
  id,
  label,
  surface,
  scopes,
  requires_login AS requiresLogin,
  expires_at AS expiresAt,
  revoked_at AS revokedAt,
  last_used_at AS lastUsedAt,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const readToken = async (
  executor: QueryExecutor,
  id: string
): Promise<UrlAccessTokenAdminListItem | null> => {
  const [rows] = await executor.execute(
    `
      SELECT ${selectTokenFields}
      FROM url_access_tokens
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return Array.isArray(rows) && rows.length > 0
    ? mapToken(rows[0] as UrlAccessTokenAdminRow)
    : null;
};

const resolveActor = async (
  executor: QueryExecutor,
  authUserId: string
): Promise<UrlAccessTokenAdminActor | null> => {
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

export const createUrlAccessTokenAdminRepository = (
  pool: DatabasePool
): UrlAccessTokenAdminRepository => ({
  async resolveActor(authUserId) {
    return await resolveActor(pool, authUserId);
  },

  async listTokens() {
    const [rows] = await pool.execute(
      `
        SELECT ${selectTokenFields}
        FROM url_access_tokens
        ORDER BY revoked_at IS NULL DESC, surface, label, created_at DESC
      `
    );

    return Array.isArray(rows)
      ? (rows as UrlAccessTokenAdminRow[]).map(mapToken)
      : [];
  },

  async getToken(id) {
    return await readToken(pool, id);
  },

  async createToken(input: UrlAccessTokenAdminInsertInput) {
    const id = randomUUID();
    await pool.execute(
      `
        INSERT INTO url_access_tokens
          (id, label, token_hash, surface, scopes, requires_login)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        input.label,
        input.tokenHash,
        input.surface,
        JSON.stringify(input.scopes),
        input.requiresLogin
      ]
    );

    const token = await readToken(pool, id);

    if (!token) {
      throw new Error("url_token_admin_mutation_reread_failed");
    }

    return token;
  },

  async rotateToken(id, tokenHash) {
    const [result] = await pool.execute(
      `
        UPDATE url_access_tokens
        SET token_hash = ?, revoked_at = NULL, last_used_at = NULL, updated_at = NOW()
        WHERE id = ?
      `,
      [tokenHash, id]
    );

    if (typeof result === "object"
      && result !== null
      && "affectedRows" in result
      && result.affectedRows === 0) {
      return "not-found";
    }

    const token = await readToken(pool, id);

    if (!token) {
      throw new Error("url_token_admin_mutation_reread_failed");
    }

    return token;
  },

  async revokeToken(id) {
    const [result] = await pool.execute(
      `
        UPDATE url_access_tokens
        SET revoked_at = COALESCE(revoked_at, NOW()), updated_at = NOW()
        WHERE id = ?
      `,
      [id]
    );

    if (typeof result === "object"
      && result !== null
      && "affectedRows" in result
      && result.affectedRows === 0) {
      return "not-found";
    }

    const token = await readToken(pool, id);

    if (!token) {
      throw new Error("url_token_admin_mutation_reread_failed");
    }

    return token;
  }
});
