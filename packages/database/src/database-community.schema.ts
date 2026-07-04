import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core";

export const roleRankPaths = mysqlTable(
  "role_rank_paths",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    key: varchar("key", { length: 80 }).notNull().unique(),
    name: varchar("name", { length: 191 }).notNull(),
    description: varchar("description", { length: 280 }),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("role_rank_paths_sort_idx").on(table.sortOrder, table.key),
    check("role_rank_paths_key_check", sql`trim(${table.key}) <> ''`),
    check("role_rank_paths_sort_order_check", sql`${table.sortOrder} >= 0`)
  ]
);

export const roles = mysqlTable(
  "roles",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    key: varchar("key", { length: 80 }).notNull().unique(),
    name: varchar("name", { length: 191 }).notNull(),
    permissions: json("permissions").$type<string[]>().notNull(),
    rankPathId: varchar("rank_path_id", { length: 36 }),
    rankLevel: int("rank_level"),
    displayLabel: varchar("display_label", { length: 191 }),
    nextRoleId: varchar("next_role_id", { length: 36 }),
    discordRoleId: varchar("discord_role_id", { length: 80 }),
    isOwnerRank: boolean("is_owner_rank").notNull().default(false),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("roles_rank_path_level_idx").on(table.rankPathId, table.rankLevel),
    index("roles_next_role_idx").on(table.nextRoleId),
    index("roles_discord_role_idx").on(table.discordRoleId),
    check("roles_rank_level_check", sql`${table.rankLevel} is null or ${table.rankLevel} > 0`),
    check(
      "roles_rank_path_level_pair_check",
      sql`(
        (${table.rankPathId} is null and ${table.rankLevel} is null)
        or
        (${table.rankPathId} is not null and ${table.rankLevel} is not null)
      )`
    )
  ]
);

export const userRoles = mysqlTable(
  "user_roles",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    roleId: varchar("role_id", { length: 36 }).notNull(),
    trustLevel: mysqlEnum("trust_level", [
      "observer",
      "helper",
      "moderator",
      "senior_moderator",
      "trusted_operator",
      "owner"
    ]).notNull().default("helper"),
    scopeKind: mysqlEnum("scope_kind", [
      "global",
      "chat",
      "event_routing",
      "content",
      "project",
      "stream_operations"
    ]).notNull().default("global"),
    scopeId: varchar("scope_id", { length: 191 }),
    availability: mysqlEnum("availability", ["always", "live_only", "offline_only"]).notNull().default("always"),
    assignedByUserId: varchar("assigned_by_user_id", { length: 36 }),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    revokedByUserId: varchar("revoked_by_user_id", { length: 36 }),
    revocationReason: varchar("revocation_reason", { length: 280 }),
    assignedAt: timestamp("assigned_at").notNull().defaultNow()
  },
  (table) => [
    index("user_roles_user_id_idx").on(table.userId),
    index("user_roles_scope_idx").on(table.scopeKind, table.scopeId),
    index("user_roles_expires_at_idx").on(table.expiresAt),
    index("user_roles_revoked_at_idx").on(table.revokedAt),
    index("user_roles_assigned_by_user_idx").on(table.assignedByUserId),
    uniqueIndex("user_roles_user_role_uidx").on(table.userId, table.roleId),
    check(
      "user_roles_scope_id_check",
      sql`(
        (${table.scopeKind} = 'global' and ${table.scopeId} is null)
        or
        (${table.scopeKind} <> 'global' and ${table.scopeId} is not null and trim(${table.scopeId}) <> '')
      )`
    ),
    check(
      "user_roles_revocation_check",
      sql`(
        (${table.revokedAt} is null and ${table.revokedByUserId} is null and ${table.revocationReason} is null)
        or
        (${table.revokedAt} is not null and ${table.revokedByUserId} is not null)
      )`
    )
  ]
);

export const roleGrantAuditLogs = mysqlTable(
  "role_grant_audit_logs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    targetUserId: varchar("target_user_id", { length: 36 }).notNull(),
    roleId: varchar("role_id", { length: 36 }).notNull(),
    actorUserId: varchar("actor_user_id", { length: 36 }),
    action: mysqlEnum("action", ["grant", "update", "revoke", "expire"]).notNull(),
    previousValue: json("previous_value").$type<Record<string, unknown> | null>(),
    nextValue: json("next_value").$type<Record<string, unknown> | null>(),
    reason: varchar("reason", { length: 280 }),
    createdAt: timestamp("created_at").notNull().defaultNow()
  },
  (table) => [
    index("role_grant_audit_target_created_idx").on(table.targetUserId, table.createdAt),
    index("role_grant_audit_actor_created_idx").on(table.actorUserId, table.createdAt),
    index("role_grant_audit_role_created_idx").on(table.roleId, table.createdAt),
    check(
      "role_grant_audit_value_check",
      sql`(
        (${table.action} = 'grant' and ${table.previousValue} is null and ${table.nextValue} is not null)
        or
        (${table.action} = 'update' and ${table.previousValue} is not null and ${table.nextValue} is not null)
        or
        (${table.action} in ('revoke', 'expire') and ${table.previousValue} is not null)
      )`
    )
  ]
);

export const moderationAuditLogs = mysqlTable(
  "moderation_audit_logs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    source: mysqlEnum("source", ["fake-local", "website", "twitch", "youtube", "discord", "system"]).notNull(),
    action: mysqlEnum("action", [
      "warn_author",
      "hide_message",
      "temporary_mute_author",
      "note_author",
      "noop",
      "ban_author",
      "unban_author",
      "delete_message",
      "restrict_user",
      "rank_status_change"
    ]).notNull(),
    outcome: mysqlEnum("outcome", [
      "applied",
      "denied",
      "invalid",
      "not_found",
      "no_op",
      "provider_queued",
      "provider_failed",
      "reverted"
    ]).notNull(),
    actorUserId: varchar("actor_user_id", { length: 36 }),
    actorDisplayName: varchar("actor_display_name", { length: 191 }),
    targetUserId: varchar("target_user_id", { length: 36 }),
    targetAuthorName: varchar("target_author_name", { length: 191 }),
    targetMessageId: varchar("target_message_id", { length: 191 }),
    targetExternalId: varchar("target_external_id", { length: 191 }),
    eventHistoryId: varchar("event_history_id", { length: 36 }),
    streamSessionId: varchar("stream_session_id", { length: 36 }),
    durationSeconds: int("duration_seconds"),
    activeUntil: timestamp("active_until"),
    reason: varchar("reason", { length: 280 }),
    note: varchar("note", { length: 280 }),
    providerAction: boolean("provider_action").notNull().default(false),
    providerActionId: varchar("provider_action_id", { length: 191 }),
    isTest: boolean("is_test").notNull().default(false),
    isSimulated: boolean("is_simulated").notNull().default(false),
    testResettable: boolean("test_resettable").notNull().default(false),
    redactedContext: json("redacted_context").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at").notNull().defaultNow()
  },
  (table) => [
    index("moderation_audit_source_created_idx").on(table.source, table.createdAt),
    index("moderation_audit_actor_created_idx").on(table.actorUserId, table.createdAt),
    index("moderation_audit_target_user_created_idx").on(table.targetUserId, table.createdAt),
    index("moderation_audit_target_author_created_idx").on(table.targetAuthorName, table.createdAt),
    index("moderation_audit_message_idx").on(table.targetMessageId),
    index("moderation_audit_event_history_idx").on(table.eventHistoryId),
    index("moderation_audit_stream_session_idx").on(table.streamSessionId),
    index("moderation_audit_test_resettable_idx").on(table.testResettable, table.createdAt),
    check(
      "moderation_audit_duration_check",
      sql`${table.durationSeconds} is null or ${table.durationSeconds} >= 0`
    ),
    check(
      "moderation_audit_temporary_mute_check",
      sql`(
        ${table.action} <> 'temporary_mute_author'
        or (${table.durationSeconds} is not null and ${table.activeUntil} is not null)
      )`
    ),
    check(
      "moderation_audit_provider_outcome_check",
      sql`${table.outcome} not in ('provider_queued', 'provider_failed') or ${table.providerAction} = true`
    ),
    check(
      "moderation_audit_provider_action_check",
      sql`(
        (${table.providerAction} = true and ${table.providerActionId} is not null and ${table.source} in ('twitch', 'youtube', 'discord', 'website'))
        or
        (${table.providerAction} = false and ${table.providerActionId} is null)
      )`
    ),
    check(
      "moderation_audit_fake_local_boundary_check",
      sql`${table.source} <> 'fake-local' or (${table.providerAction} = false and ${table.isTest} = true and ${table.isSimulated} = true)`
    ),
    check(
      "moderation_audit_test_reset_boundary_check",
      sql`(
        ${table.testResettable} = false
        or (
          (${table.isTest} = true or ${table.isSimulated} = true)
          and ${table.providerAction} = false
        )
      )`
    )
  ]
);

export const moderationActiveStates = mysqlTable(
  "moderation_active_states",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    source: mysqlEnum("source", ["fake-local", "website", "twitch", "youtube", "discord", "system"]).notNull(),
    stateKind: mysqlEnum("state_kind", [
      "message_hidden",
      "author_muted",
      "user_restricted",
      "user_banned"
    ]).notNull(),
    status: mysqlEnum("status", ["active", "expired", "revoked", "appealed", "reviewed"]).notNull().default("active"),
    targetUserId: varchar("target_user_id", { length: 36 }),
    targetAuthorName: varchar("target_author_name", { length: 191 }),
    targetMessageId: varchar("target_message_id", { length: 191 }),
    targetExternalId: varchar("target_external_id", { length: 191 }),
    streamSessionId: varchar("stream_session_id", { length: 36 }),
    activeFrom: timestamp("active_from").notNull().defaultNow(),
    activeUntil: timestamp("active_until"),
    durationSeconds: int("duration_seconds"),
    reason: varchar("reason", { length: 280 }),
    note: varchar("note", { length: 280 }),
    createdAuditLogId: varchar("created_audit_log_id", { length: 36 }).notNull(),
    lastAuditLogId: varchar("last_audit_log_id", { length: 36 }).notNull(),
    revokedAuditLogId: varchar("revoked_audit_log_id", { length: 36 }),
    revokedAt: timestamp("revoked_at"),
    revokedByUserId: varchar("revoked_by_user_id", { length: 36 }),
    revocationReason: varchar("revocation_reason", { length: 280 }),
    appealStatus: mysqlEnum("appeal_status", ["none", "pending", "accepted", "rejected", "withdrawn"])
      .notNull()
      .default("none"),
    appealNote: varchar("appeal_note", { length: 280 }),
    reviewedByUserId: varchar("reviewed_by_user_id", { length: 36 }),
    reviewedAt: timestamp("reviewed_at"),
    providerAction: boolean("provider_action").notNull().default(false),
    providerActionId: varchar("provider_action_id", { length: 191 }),
    providerStateId: varchar("provider_state_id", { length: 191 }),
    isTest: boolean("is_test").notNull().default(false),
    isSimulated: boolean("is_simulated").notNull().default(false),
    testResettable: boolean("test_resettable").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("moderation_active_source_status_until_idx").on(table.source, table.status, table.activeUntil),
    index("moderation_active_target_user_idx").on(table.targetUserId, table.source, table.status),
    index("moderation_active_target_author_idx").on(table.targetAuthorName, table.source, table.status),
    index("moderation_active_message_idx").on(table.targetMessageId),
    index("moderation_active_external_idx").on(table.targetExternalId),
    index("moderation_active_stream_status_idx").on(table.streamSessionId, table.status),
    index("moderation_active_test_resettable_idx").on(table.testResettable, table.createdAt),
    index("moderation_active_created_audit_idx").on(table.createdAuditLogId),
    index("moderation_active_last_audit_idx").on(table.lastAuditLogId),
    index("moderation_active_revoked_audit_idx").on(table.revokedAuditLogId),
    check(
      "moderation_active_duration_check",
      sql`${table.durationSeconds} is null or ${table.durationSeconds} >= 0`
    ),
    check(
      "moderation_active_until_check",
      sql`${table.activeUntil} is null or ${table.activeUntil} >= ${table.activeFrom}`
    ),
    check(
      "moderation_active_temporary_state_check",
      sql`(
        ${table.stateKind} not in ('author_muted', 'user_restricted')
        or (${table.durationSeconds} is not null and ${table.activeUntil} is not null)
      )`
    ),
    check(
      "moderation_active_fake_local_boundary_check",
      sql`${table.source} <> 'fake-local' or (${table.providerAction} = false and ${table.isTest} = true and ${table.isSimulated} = true and ${table.testResettable} = true)`
    ),
    check(
      "moderation_active_test_reset_boundary_check",
      sql`(
        ${table.testResettable} = false
        or (
          (${table.isTest} = true or ${table.isSimulated} = true)
          and ${table.providerAction} = false
        )
      )`
    ),
    check(
      "moderation_active_provider_action_check",
      sql`(
        (${table.providerAction} = false and ${table.providerActionId} is null and ${table.providerStateId} is null)
        or
        (${table.providerAction} = true and ${table.source} in ('website', 'twitch', 'youtube', 'discord'))
      )`
    ),
    check(
      "moderation_active_revocation_metadata_check",
      sql`(
        (${table.revokedAt} is null and ${table.revokedByUserId} is null and ${table.revokedAuditLogId} is null and ${table.revocationReason} is null)
        or
        (${table.revokedAt} is not null and ${table.revokedByUserId} is not null and ${table.revokedAuditLogId} is not null)
      )`
    ),
    check(
      "moderation_active_status_revocation_check",
      sql`(
        (${table.status} = 'active' and ${table.revokedAt} is null)
        or
        (${table.status} = 'revoked' and ${table.revokedAt} is not null)
        or
        (${table.status} not in ('active', 'revoked'))
      )`
    ),
    check(
      "moderation_active_appeal_check",
      sql`(
        (${table.appealStatus} = 'none' and ${table.appealNote} is null and ${table.status} <> 'appealed')
        or
        (${table.appealStatus} <> 'none')
      )`
    ),
    check(
      "moderation_active_review_check",
      sql`(
        (${table.reviewedAt} is null and ${table.reviewedByUserId} is null and ${table.status} <> 'reviewed')
        or
        (${table.reviewedAt} is not null and ${table.reviewedByUserId} is not null)
      )`
    )
  ]
);
