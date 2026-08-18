import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";

import type { MusicActor, MusicAuthUser, MusicRepository } from "./music.types.js";
import type { QueryExecutor } from "./music-store-shared.service.js";

export const resolveActor = async (executor: QueryExecutor, authUserId: string): Promise<MusicActor | null> => {
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
      ORDER BY roles.\`key\`
    `,
    [authUserId]
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const actorRows = rows as Array<{ domainUserId: string; rolePermissions: unknown }>;
  const domainUserId = actorRows[0]?.domainUserId;

  return domainUserId
    ? { domainUserId, rolePermissionValues: actorRows.map((row) => row.rolePermissions) }
    : null;
};

export const resolveOrCreateDomainUser = async (
  executor: QueryExecutor,
  authUser: MusicAuthUser
): Promise<{ id: string; displayName: string }> => {
  const [rows] = await executor.execute(
    `
      SELECT users.id, users.display_name AS displayName
      FROM auth_user_links
      INNER JOIN users ON users.id = auth_user_links.user_id
      WHERE auth_user_links.auth_user_id = ?
        AND users.deleted_at IS NULL
      LIMIT 1
    `,
    [authUser.id]
  );
  const existing = Array.isArray(rows) ? rows[0] as { id: string; displayName: string } | undefined : undefined;

  if (existing) {
    return existing;
  }

  const userId = randomUUID();
  await executor.execute(
    "INSERT INTO users (id, display_name, profile_visibility, avatar_url) VALUES (?, ?, 'private', ?)",
    [userId, authUser.name?.trim() || "Maiks.yt member", authUser.image ?? null]
  );
  await executor.execute(
    "INSERT INTO auth_user_links (id, auth_user_id, user_id) VALUES (?, ?, ?)",
    [randomUUID(), authUser.id, userId]
  );

  return {
    id: userId,
    displayName: authUser.name?.trim() || "Maiks.yt member"
  };
};



export const createMusicActorRepository = (pool: DatabasePool): Pick<MusicRepository,
  | "resolveActor"
  | "resolveOrCreateDomainUser"
> => ({
  async resolveActor(authUserId) {
    return await resolveActor(pool, authUserId);
  },

  async resolveOrCreateDomainUser(authUser) {
    return await resolveOrCreateDomainUser(pool, authUser);
  }
});
