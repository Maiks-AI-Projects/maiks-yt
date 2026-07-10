import type { DatabasePool } from "@maiks-yt/database";

import type {
  BackupKeyDataExportActor,
  BackupKeyDataExportRepository,
  BackupKeyDataExportRow,
  BackupKeyDataExportSection
} from "./backup-key-data-export.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;

type ExportSectionDefinition = {
  name: string;
  query: string;
};

const sectionDefinitions: readonly ExportSectionDefinition[] = [
  {
    name: "content_pages",
    query: `
      SELECT
        id, title, route_scope, normalized_path, status, visibility,
        seo_title, seo_description, body, created_by_user_id, updated_by_user_id,
        published_at, created_at, updated_at
      FROM content_pages
      ORDER BY updated_at DESC, id
    `
  },
  {
    name: "creator_links",
    query: `
      SELECT
        id, \`key\`, title, description, purpose, icon, availability, href,
        availability_note, is_primary, sort_order, is_published, created_at, updated_at
      FROM creator_links
      ORDER BY sort_order ASC, \`key\` ASC
    `
  },
  {
    name: "projects",
    query: `
      SELECT
        id, slug, title, summary, type, category, status, is_public,
        created_by_user_id, created_at, updated_at
      FROM projects
      ORDER BY updated_at DESC, slug ASC
    `
  },
  {
    name: "project_milestones",
    query: `
      SELECT
        id, project_id, title, description, status, sort_order,
        starts_at, completed_at, created_at, updated_at
      FROM project_milestones
      ORDER BY project_id ASC, sort_order ASC, created_at ASC
    `
  },
  {
    name: "project_items",
    query: `
      SELECT
        id, project_id, parent_item_id, title, description, kind, status,
        quantity, estimated_minor_amount, currency_code, sort_order, created_at, updated_at
      FROM project_items
      ORDER BY project_id ASC, sort_order ASC, created_at ASC
    `
  },
  {
    name: "project_item_links",
    query: `
      SELECT
        id, project_item_id, provider, url, label, relationship,
        last_seen_minor_amount, currency_code, checked_at, created_at, updated_at
      FROM project_item_links
      ORDER BY project_item_id ASC, created_at ASC
    `
  },
  {
    name: "project_updates",
    query: `
      SELECT
        id, project_id, title, summary, body, status, is_visible,
        published_at, is_pinned, sort_order, created_at, updated_at
      FROM project_updates
      ORDER BY project_id ASC, is_pinned DESC, sort_order ASC, created_at DESC
    `
  },
  {
    name: "stream_schedule_entries",
    query: `
      SELECT
        id, title, description, starts_at, ends_at, channel_key, topic_key, theme_key,
        project_id, focus_label, focus_note, visibility, status,
        cancellation_reason_code, cancellation_reason, created_by_user_id, created_at, updated_at
      FROM stream_schedule_entries
      ORDER BY starts_at DESC, id
    `
  },
  {
    name: "game_library_entries",
    query: `
      SELECT
        id, slug, title, platform_label, store_provider, store_url, ownership_status,
        interest_status, stream_fit_note, content_warnings, category_label, visibility,
        sort_order, created_by_user_id, updated_by_user_id, created_at, updated_at
      FROM game_library_entries
      ORDER BY sort_order ASC, title ASC
    `
  },
  {
    name: "game_suggestions",
    query: `
      SELECT
        id, title, platform_label, store_url, reason, tags, suggested_by_user_id,
        suggested_by_name, status, linked_game_id, reviewer_user_id, reviewer_note,
        reviewed_at, is_public, created_at, updated_at
      FROM game_suggestions
      ORDER BY created_at DESC, id
    `
  },
  {
    name: "game_schedule_links",
    query: `
      SELECT
        id, game_id, schedule_entry_id, relationship, public_note,
        sort_order, created_by_user_id, created_at, updated_at
      FROM game_schedule_links
      ORDER BY schedule_entry_id ASC, sort_order ASC, created_at ASC
    `
  },
  {
    name: "role_rank_paths",
    query: `
      SELECT id, \`key\`, name, description, sort_order, created_at, updated_at
      FROM role_rank_paths
      ORDER BY sort_order ASC, \`key\` ASC
    `
  },
  {
    name: "roles",
    query: `
      SELECT
        id, \`key\`, name, permissions, rank_path_id, rank_level, display_label,
        next_role_id, discord_role_id, is_owner_rank, is_system, created_at, updated_at
      FROM roles
      ORDER BY is_owner_rank DESC, rank_path_id ASC, rank_level ASC, \`key\` ASC
    `
  },
  {
    name: "user_roles",
    query: `
      SELECT
        id, user_id, role_id, trust_level, scope_kind, scope_id, availability,
        assigned_by_user_id, expires_at, revoked_at, revoked_by_user_id,
        revocation_reason, assigned_at
      FROM user_roles
      ORDER BY assigned_at DESC, id
    `
  },
  {
    name: "event_routing_rules",
    query: `
      SELECT
        id, event_kind, source_platform, destination, enabled, live_only, offline_only,
        approval_required, per_user_cooldown_seconds, global_cooldown_seconds,
        once_per_stream, template_key, theme_key, sound_key, notification_priority,
        created_by_user_id, updated_by_user_id, created_at, updated_at
      FROM event_routing_rules
      ORDER BY event_kind ASC, source_platform ASC
    `
  },
  {
    name: "event_user_opt_outs",
    query: `
      SELECT id, user_id, event_kind, opted_out, reason, created_at, updated_at
      FROM event_user_opt_outs
      ORDER BY user_id ASC, event_kind ASC
    `
  },
  {
    name: "provider_channel_identities",
    query: `
      SELECT
        id, owner_user_id, provider, provider_channel_id, display_name, handle,
        thumbnail_url, selected_for_live_chat, discovered_at, last_seen_at,
        selected_at, created_at, updated_at
      FROM provider_channel_identities
      ORDER BY provider ASC, selected_for_live_chat DESC, last_seen_at DESC
    `
  },
  {
    name: "system_notifications",
    query: `
      SELECT
        id, title, body, severity, source, status, action_url,
        created_by_user_id, read_at, archived_at, created_at, updated_at
      FROM system_notifications
      ORDER BY created_at DESC, id
    `
  },
  {
    name: "moderation_active_states",
    query: `
      SELECT
        id, source, state_kind, status, target_user_id, target_author_name,
        target_message_id, target_external_id, stream_session_id, active_from,
        active_until, duration_seconds, reason, note, created_audit_log_id,
        last_audit_log_id, revoked_audit_log_id, revoked_at, revoked_by_user_id,
        revocation_reason, appeal_status, appeal_note, reviewed_by_user_id,
        reviewed_at, provider_action, provider_action_id, provider_state_id,
        is_test, is_simulated, test_resettable, created_at, updated_at
      FROM moderation_active_states
      ORDER BY updated_at DESC, id
    `
  },
  {
    name: "money_ledger_transactions",
    query: `
      SELECT
        id, transaction_type, money_mode, source_kind, source_provider, source_id,
        source_event_id, posting_status, occurred_at, accounting_at,
        corrects_transaction_id, correction_reason, notes_private,
        created_by_user_id, created_at, updated_at
      FROM money_ledger_transactions
      ORDER BY accounting_at DESC, created_at DESC, id
    `
  },
  {
    name: "money_ledger_lines",
    query: `
      SELECT
        id, transaction_id, line_kind, direction, amount_minor, currency,
        value_source, is_estimate, category_key, project_id, project_item_id,
        rule_version_id, receipt_reference_id, notes_private, created_at
      FROM money_ledger_lines
      ORDER BY created_at DESC, id
    `
  },
  {
    name: "money_rule_versions",
    query: `
      SELECT
        id, rule_kind, provider, value_source, applies_to_date_basis,
        effective_from, effective_until, percentage_bps, fixed_amount_minor,
        fixed_currency, rule_payload, change_reason, supersedes_rule_id,
        created_by_user_id, created_at
      FROM money_rule_versions
      ORDER BY effective_from DESC, created_at DESC, id
    `
  },
  {
    name: "money_receipt_references",
    query: `
      SELECT
        id, reference_type, storage_kind, label, private_reference,
        created_by_user_id, created_at
      FROM money_receipt_references
      ORDER BY created_at DESC, id
    `
  },
  {
    name: "money_accounting_warnings",
    query: `
      SELECT
        id, target_kind, target_id, warning_kind, severity, status,
        resolved_by_user_id, created_at, resolved_at
      FROM money_accounting_warnings
      ORDER BY created_at DESC, id
    `
  }
];

const resolveActor = async (
  executor: QueryExecutor,
  authUserId: string
): Promise<BackupKeyDataExportActor | null> => {
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

const normalizeExportValue = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  return value;
};

const normalizeRows = (rows: unknown): BackupKeyDataExportRow[] => {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row) => {
    const output: BackupKeyDataExportRow = {};

    for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
      output[key] = normalizeExportValue(value);
    }

    return output;
  });
};

const buildExport = async (
  executor: QueryExecutor,
  rowLimitPerSection: number
): Promise<BackupKeyDataExportSection[]> => {
  const sections: BackupKeyDataExportSection[] = [];
  const limit = Math.max(1, Math.min(rowLimitPerSection + 1, 5_001));

  for (const definition of sectionDefinitions) {
    const [rawRows] = await executor.execute(`${definition.query}\nLIMIT ${limit}`);
    const rows = normalizeRows(rawRows);
    const truncated = rows.length > rowLimitPerSection;
    const visibleRows = truncated ? rows.slice(0, rowLimitPerSection) : rows;

    sections.push({
      name: definition.name,
      rowCount: visibleRows.length,
      truncated,
      rows: visibleRows
    });
  }

  return sections;
};

export const createBackupKeyDataExportRepository = (
  pool: QueryExecutor
): BackupKeyDataExportRepository => ({
  resolveActor: (authUserId) => resolveActor(pool, authUserId),
  buildExport: (rowLimitPerSection) => buildExport(pool, rowLimitPerSection)
});
