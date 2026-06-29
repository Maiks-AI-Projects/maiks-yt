import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";

import type {
  FakeLocalModerationActiveStateInput,
  FakeLocalModerationActor,
  FakeLocalModerationAuditEntry,
  FakeLocalModerationRepository
} from "./fake-local-moderation.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;
type AffectedRowsResult = {
  affectedRows?: number;
};

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

const getActiveStateTargetClause = (stateKind: FakeLocalModerationActiveStateInput["stateKind"]): string => {
  if (stateKind === "message_hidden") {
    return "target_message_id = ?";
  }

  return "LOWER(target_author_name) = LOWER(?)";
};

const getActiveStateTargetValue = (input: FakeLocalModerationActiveStateInput): string | null => {
  if (input.stateKind === "message_hidden") {
    return input.auditEntry.targetMessageId;
  }

  return input.auditEntry.targetAuthorName;
};

const updateActiveState = async (
  executor: QueryExecutor,
  input: FakeLocalModerationActiveStateInput
): Promise<number> => {
  const [result] = await executor.execute(
    `
      UPDATE moderation_active_states
      SET
        status = 'active',
        active_until = ?,
        duration_seconds = ?,
        reason = ?,
        note = ?,
        last_audit_log_id = ?,
        revoked_audit_log_id = NULL,
        revoked_at = NULL,
        revoked_by_user_id = NULL,
        revocation_reason = NULL,
        appeal_status = 'none',
        appeal_note = NULL,
        reviewed_by_user_id = NULL,
        reviewed_at = NULL,
        provider_action = false,
        provider_action_id = NULL,
        provider_state_id = NULL,
        is_test = true,
        is_simulated = true,
        test_resettable = true,
        updated_at = ?
      WHERE source = 'fake-local'
        AND state_kind = ?
        AND status = 'active'
        AND revoked_at IS NULL
        AND (active_until IS NULL OR active_until > NOW())
        AND ${getActiveStateTargetClause(input.stateKind)}
    `,
    [
      input.auditEntry.mutedUntil ? new Date(input.auditEntry.mutedUntil) : null,
      input.auditEntry.durationSeconds,
      input.auditEntry.reason,
      input.auditEntry.note,
      input.auditEntry.id,
      new Date(input.auditEntry.attemptedAt),
      input.stateKind,
      getActiveStateTargetValue(input)
    ]
  );

  return (result as AffectedRowsResult).affectedRows ?? 0;
};

const insertActiveState = async (
  executor: QueryExecutor,
  input: FakeLocalModerationActiveStateInput
): Promise<void> => {
  await executor.execute(
    `
      INSERT INTO moderation_active_states
        (
          id,
          source,
          state_kind,
          status,
          target_author_name,
          target_message_id,
          active_from,
          active_until,
          duration_seconds,
          reason,
          note,
          created_audit_log_id,
          last_audit_log_id,
          provider_action,
          is_test,
          is_simulated,
          test_resettable,
          created_at,
          updated_at
        )
      VALUES (?, 'fake-local', ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, false, true, true, true, ?, ?)
    `,
    [
      randomUUID(),
      input.stateKind,
      input.auditEntry.targetAuthorName,
      input.auditEntry.targetMessageId,
      new Date(input.auditEntry.attemptedAt),
      input.auditEntry.mutedUntil ? new Date(input.auditEntry.mutedUntil) : null,
      input.auditEntry.durationSeconds,
      input.auditEntry.reason,
      input.auditEntry.note,
      input.auditEntry.id,
      input.auditEntry.id,
      new Date(input.auditEntry.attemptedAt),
      new Date(input.auditEntry.attemptedAt)
    ]
  );
};

const upsertActiveState = async (
  executor: QueryExecutor,
  input: FakeLocalModerationActiveStateInput
): Promise<void> => {
  const targetValue = getActiveStateTargetValue(input);

  if (!targetValue) {
    return;
  }

  const affectedRows = await updateActiveState(executor, input);

  if (affectedRows === 0 && input.allowInsert) {
    await insertActiveState(executor, input);
  }
};

export const createFakeLocalModerationRepository = (
  pool: DatabasePool
): FakeLocalModerationRepository => ({
  async resolveActor(authUserId) {
    return await resolveActor(pool, authUserId);
  },

  async appendAudit(entry) {
    await appendAudit(pool, entry);
  },

  async upsertActiveState(input) {
    await upsertActiveState(pool, input);
  }
});
