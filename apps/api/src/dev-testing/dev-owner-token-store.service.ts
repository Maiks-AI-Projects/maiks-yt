import type { DatabasePool } from "@maiks-yt/database";

import { parseJsonArray } from "../account/index.js";
import type {
  DevOwnerTokenOwner,
  DevOwnerTokenRepository
} from "./dev-owner-token.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;

type OwnerCandidateRow = {
  authUserId: string;
  domainUserId: string;
  rolePermissions: unknown;
};

const hasOwnerWildcard = (rolePermissionValues: readonly unknown[]): boolean =>
  rolePermissionValues.some((value) =>
    parseJsonArray(value).some((permission) => permission === "*")
  );

const findOwnerAuthUser = async (executor: QueryExecutor): Promise<DevOwnerTokenOwner | null> => {
  const [rows] = await executor.execute(
    `
      SELECT
        auth_users.id AS authUserId,
        users.id AS domainUserId,
        roles.permissions AS rolePermissions
      FROM auth_users
      INNER JOIN auth_user_links ON auth_user_links.auth_user_id = auth_users.id
      INNER JOIN users ON users.id = auth_user_links.user_id
      INNER JOIN user_roles ON user_roles.user_id = users.id
        AND user_roles.revoked_at IS NULL
        AND (user_roles.expires_at IS NULL OR user_roles.expires_at > NOW())
      INNER JOIN roles ON roles.id = user_roles.role_id
      WHERE users.deleted_at IS NULL
      ORDER BY auth_users.created_at, roles.key
    `
  );
  const candidates = Array.isArray(rows) ? rows as OwnerCandidateRow[] : [];
  const grouped = new Map<string, {
    authUserId: string;
    domainUserId: string;
    rolePermissionValues: unknown[];
  }>();

  for (const row of candidates) {
    const existing = grouped.get(row.authUserId);

    if (existing) {
      existing.rolePermissionValues.push(row.rolePermissions);
      continue;
    }

    grouped.set(row.authUserId, {
      authUserId: row.authUserId,
      domainUserId: row.domainUserId,
      rolePermissionValues: [row.rolePermissions]
    });
  }

  for (const owner of grouped.values()) {
    if (hasOwnerWildcard(owner.rolePermissionValues)) {
      return {
        authUserId: owner.authUserId,
        domainUserId: owner.domainUserId
      };
    }
  }

  return null;
};

export const createDevOwnerTokenRepository = (
  pool: QueryExecutor
): DevOwnerTokenRepository => ({
  findOwnerAuthUser: () => findOwnerAuthUser(pool),
  async insertToken(input) {
    await pool.execute(
      `
        INSERT INTO dev_auth_tokens (
          id,
          label,
          token_hash,
          auth_user_id,
          expires_at,
          revoked_at,
          last_used_at,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, NULL, NULL, NOW(), NOW())
      `,
      [
        input.id,
        input.label,
        input.tokenHash,
        input.authUserId,
        input.expiresAt
      ]
    );
  }
});
