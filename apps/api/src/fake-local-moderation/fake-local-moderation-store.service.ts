import type { DatabasePool } from "@maiks-yt/database";

import type {
  FakeLocalModerationActor,
  FakeLocalModerationAuditEntry,
  FakeLocalModerationRepository
} from "./fake-local-moderation.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;

const resolveActor = async (
  executor: QueryExecutor,
  authUserId: string
): Promise<FakeLocalModerationActor | null> => {
  const [rows] = await executor.execute(
    `
      SELECT
        users.id AS domainUserId,
        users.display_name AS displayName,
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

  const actorRows = rows as Array<{
    domainUserId: string;
    displayName: string;
    rolePermissions: unknown;
  }>;
  const firstRow = actorRows[0];

  if (!firstRow?.domainUserId) {
    return null;
  }

  return {
    domainUserId: firstRow.domainUserId,
    displayName: firstRow.displayName,
    rolePermissionValues: actorRows.map((row) => row.rolePermissions)
  };
};

const appendAudit = async (
  executor: QueryExecutor,
  entry: FakeLocalModerationAuditEntry
): Promise<void> => {
  await executor.execute(
    `
      INSERT INTO moderation_audit_logs
        (
          id,
          source,
          action,
          outcome,
          actor_user_id,
          actor_display_name,
          target_author_name,
          target_message_id,
          duration_seconds,
          active_until,
          reason,
          note,
          provider_action,
          is_test,
          is_simulated,
          test_resettable,
          redacted_context,
          created_at
        )
      VALUES (?, 'fake-local', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, true, true, true, ?, ?)
    `,
    [
      entry.id,
      entry.action,
      entry.outcome,
      entry.actorUserId,
      entry.actorDisplayName,
      entry.targetAuthorName,
      entry.targetMessageId,
      entry.durationSeconds,
      entry.mutedUntil ? new Date(entry.mutedUntil) : null,
      entry.reason,
      entry.note,
      JSON.stringify({
        source: "fake-local",
        providerAction: false
      }),
      new Date(entry.attemptedAt)
    ]
  );
};

export const createFakeLocalModerationRepository = (
  pool: DatabasePool
): FakeLocalModerationRepository => ({
  async resolveActor(authUserId) {
    return await resolveActor(pool, authUserId);
  },

  async appendAudit(entry) {
    await appendAudit(pool, entry);
  }
});
