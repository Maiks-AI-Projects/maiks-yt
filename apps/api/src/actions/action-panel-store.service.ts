import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import type {
  ActionItemCategory,
  ActionItemDecision,
  ActionItemDecisionKind,
  ActionItemPriority,
  ActionItemStatus
} from "@maiks-yt/domain/actions";

import type {
  ActionItemHistoryEntry,
  ActionPanelActor,
  ActionPanelDecisionRecord,
  ActionPanelRepository,
  ActionPanelTransaction,
  PersistentActionItem
} from "./action-panel.types.js";

type ActionItemRow = {
  id: string;
  title: string;
  description: string;
  category: ActionItemCategory;
  decisionKind: ActionItemDecisionKind;
  priority: ActionItemPriority;
  status: ActionItemStatus;
  streamRelevant: number | boolean;
  liveSafe: number | boolean;
  dueAt?: Date | string | null;
  sourceType?: ActionItemCategory | null;
  sourceId?: string | null;
  sourceLabel?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type HistoryRow = {
  id: string;
  actionId: string;
  actionTitle: string;
  decision: ActionItemDecision;
  previousStatus: ActionItemStatus;
  newStatus: ActionItemStatus;
  actorUserId: string;
  actorDisplayName: string;
  note?: string | null;
  createdAt: Date | string;
};

type ActionPanelQueryExecutor = Pick<DatabasePool, "execute">;

const actionItemSelect = `
  SELECT
    id,
    title,
    description,
    category,
    decision_kind AS decisionKind,
    priority,
    status,
    stream_relevant AS streamRelevant,
    live_safe AS liveSafe,
    due_at AS dueAt,
    source_type AS sourceType,
    source_id AS sourceId,
    source_label AS sourceLabel,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM action_items
`;

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const mapActionItem = (row: ActionItemRow): PersistentActionItem => ({
  id: row.id,
  title: row.title,
  description: row.description,
  category: row.category,
  decisionKind: row.decisionKind,
  priority: row.priority,
  status: row.status,
  streamRelevant: Boolean(row.streamRelevant),
  liveSafe: Boolean(row.liveSafe),
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt),
  ...(row.dueAt ? { dueAt: toIsoString(row.dueAt) } : {}),
  ...(row.sourceType && row.sourceId && row.sourceLabel
    ? {
      source: {
        type: row.sourceType,
        id: row.sourceId,
        label: row.sourceLabel
      }
    }
    : {})
});

const mapHistory = (row: HistoryRow): ActionItemHistoryEntry => ({
  id: row.id,
  actionId: row.actionId,
  actionTitle: row.actionTitle,
  decision: row.decision,
  previousStatus: row.previousStatus,
  newStatus: row.newStatus,
  actor: {
    id: row.actorUserId,
    displayName: row.actorDisplayName
  },
  ...(row.note === null || row.note === undefined ? {} : { note: row.note }),
  createdAt: toIsoString(row.createdAt)
});

const firstRow = <Row>(rows: unknown): Row | null =>
  Array.isArray(rows) && rows.length > 0 ? rows[0] as Row : null;

const resolveActor = async (
  executor: ActionPanelQueryExecutor,
  authUserId: string
): Promise<ActionPanelActor | null> => {
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

const createTransaction = (
  connection: Awaited<ReturnType<DatabasePool["getConnection"]>>
): ActionPanelTransaction => ({
  async resolveActor(authUserId) {
    return await resolveActor(connection, authUserId);
  },

  async findActionForUpdate(id) {
    const [rows] = await connection.execute(
      `${actionItemSelect} WHERE id = ? LIMIT 1 FOR UPDATE`,
      [id]
    );
    const row = firstRow<ActionItemRow>(rows);

    return row ? mapActionItem(row) : null;
  },

  async updateActionStatus(input) {
    const [result] = await connection.execute(
      "UPDATE action_items SET status = ?, updated_at = NOW() WHERE id = ? AND status = ?",
      [input.newStatus, input.id, input.expectedStatus]
    );

    return typeof result === "object"
      && result !== null
      && "affectedRows" in result
      && result.affectedRows === 1;
  },

  async insertHistory(record: ActionPanelDecisionRecord) {
    await connection.execute(
      "INSERT INTO action_item_history (id, action_id, decision, previous_status, new_status, actor_user_id, note) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        randomUUID(),
        record.actionId,
        record.decision,
        record.previousStatus,
        record.newStatus,
        record.actorUserId,
        record.note ?? null
      ]
    );
  }
});

export const createActionPanelRepository = (
  pool: DatabasePool
): ActionPanelRepository => ({
  async resolveActor(authUserId) {
    return await resolveActor(pool, authUserId);
  },

  async listActiveItems() {
    const [rows] = await pool.execute(
      `${actionItemSelect} WHERE status IN ('open', 'deferred')`
    );

    return Array.isArray(rows)
      ? (rows as ActionItemRow[]).map(mapActionItem)
      : [];
  },

  async listRecentHistory(limit) {
    const [rows] = await pool.execute(
      `
        SELECT
          action_item_history.id,
          action_item_history.action_id AS actionId,
          action_items.title AS actionTitle,
          action_item_history.decision,
          action_item_history.previous_status AS previousStatus,
          action_item_history.new_status AS newStatus,
          action_item_history.actor_user_id AS actorUserId,
          users.display_name AS actorDisplayName,
          action_item_history.note,
          action_item_history.created_at AS createdAt
        FROM action_item_history
        INNER JOIN action_items ON action_items.id = action_item_history.action_id
        INNER JOIN users ON users.id = action_item_history.actor_user_id
        ORDER BY action_item_history.created_at DESC, action_item_history.id DESC
        LIMIT ?
      `,
      [limit]
    );

    return Array.isArray(rows)
      ? (rows as HistoryRow[]).map(mapHistory)
      : [];
  },

  async transaction(operation) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const result = await operation(createTransaction(connection));
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
});
