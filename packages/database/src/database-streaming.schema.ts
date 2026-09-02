import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core";

import { users } from "./database-core.schema.js";

export const valueSources = mysqlTable(
  "value_sources",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    key: varchar("key", { length: 80 }).notNull().unique(),
    label: varchar("label", { length: 191 }).notNull(),
    provider: varchar("provider", { length: 80 }).notNull(),
    sourceType: mysqlEnum("source_type", ["direct", "platform", "manual", "affiliate", "sponsor", "internal"]).notNull(),
    valueKind: mysqlEnum("value_kind", ["money", "restricted-credit", "non-monetary"]).notNull(),
    currencyCode: varchar("currency_code", { length: 3 }),
    payoutEligible: boolean("payout_eligible").notNull().default(false),
    enabled: boolean("enabled").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [index("value_sources_provider_idx").on(table.provider), index("value_sources_source_type_idx").on(table.sourceType)]
);

export const streamSessions = mysqlTable(
  "stream_sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    title: varchar("title", { length: 191 }).notNull(),
    channelKey: varchar("channel_key", { length: 80 }).notNull(),
    hobbyKey: varchar("hobby_key", { length: 80 }),
    status: mysqlEnum("status", ["draft", "scheduled", "live", "completed", "cancelled"]).notNull().default("draft"),
    activeProjectId: varchar("active_project_id", { length: 36 }),
    scheduledStartAt: timestamp("scheduled_start_at"),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    cancellationReason: text("cancellation_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [index("stream_sessions_status_idx").on(table.status), index("stream_sessions_channel_key_idx").on(table.channelKey)]
);

export const streamScheduleEntries = mysqlTable(
  "stream_schedule_entries",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    title: varchar("title", { length: 191 }).notNull(),
    description: text("description"),
    startsAt: timestamp("starts_at").notNull(),
    endsAt: timestamp("ends_at"),
    channelKey: varchar("channel_key", { length: 80 }).notNull(),
    topicKey: varchar("topic_key", { length: 80 }),
    themeKey: varchar("theme_key", { length: 80 }),
    projectId: varchar("project_id", { length: 36 }),
    focusLabel: varchar("focus_label", { length: 120 }),
    focusNote: varchar("focus_note", { length: 280 }),
    visibility: mysqlEnum("visibility", ["draft", "public", "private"]).notNull().default("draft"),
    status: mysqlEnum("status", ["planned", "live", "completed", "cancelled"]).notNull().default("planned"),
    cancellationReasonCode: mysqlEnum("cancellation_reason_code", [
      "health",
      "family",
      "energy",
      "technical",
      "schedule-conflict",
      "other"
    ]),
    cancellationReason: varchar("cancellation_reason", { length: 500 }),
    createdByUserId: varchar("created_by_user_id", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("stream_schedule_public_starts_idx").on(table.visibility, table.startsAt),
    index("stream_schedule_status_idx").on(table.status),
    index("stream_schedule_channel_idx").on(table.channelKey),
    index("stream_schedule_project_id_idx").on(table.projectId),
    check(
      "stream_schedule_time_window_check",
      sql`${table.endsAt} is null or ${table.endsAt} > ${table.startsAt}`
    ),
    check(
      "stream_schedule_cancellation_check",
      sql`(
        (
          ${table.status} = 'cancelled'
          and ${table.cancellationReasonCode} is not null
          and ${table.cancellationReason} is not null
          and trim(${table.cancellationReason}) <> ''
        )
        or
        (
          ${table.status} <> 'cancelled'
          and ${table.cancellationReasonCode} is null
          and ${table.cancellationReason} is null
        )
      )`
    )
  ]
);

export const streamScheduleChannelTargets = mysqlTable(
  "stream_schedule_channel_targets",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    scheduleEntryId: varchar("schedule_entry_id", { length: 36 }).notNull()
      .references(() => streamScheduleEntries.id, { onDelete: "cascade" }),
    channelRef: varchar("channel_ref", { length: 36 }).notNull(),
    provider: mysqlEnum("provider", ["youtube", "twitch"]).notNull(),
    providerChannelIdSnapshot: varchar("provider_channel_id_snapshot", { length: 191 }).notNull(),
    displayNameSnapshot: varchar("display_name_snapshot", { length: 191 }).notNull(),
    handleSnapshot: varchar("handle_snapshot", { length: 191 }),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    uniqueIndex("stream_schedule_channel_target_uidx").on(table.scheduleEntryId, table.channelRef),
    index("stream_schedule_channel_schedule_idx").on(table.scheduleEntryId, table.sortOrder),
    index("stream_schedule_channel_ref_idx").on(table.channelRef)
  ]
);

export const overlayStates = mysqlTable(
  "overlay_states",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    streamSessionId: varchar("stream_session_id", { length: 36 }),
    overlayKey: varchar("overlay_key", { length: 80 }).notNull(),
    scene: varchar("scene", { length: 80 }).notNull(),
    layout: varchar("layout", { length: 80 }).notNull(),
    theme: varchar("theme", { length: 80 }).notNull(),
    mode: mysqlEnum("mode", ["live", "clean", "static"]).notNull().default("live"),
    state: json("state").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    uniqueIndex("overlay_states_overlay_key_uidx").on(table.overlayKey),
    index("overlay_states_stream_session_id_idx").on(table.streamSessionId)
  ]
);

export const overlayEvents = mysqlTable(
  "overlay_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    streamSessionId: varchar("stream_session_id", { length: 36 }),
    type: varchar("type", { length: 120 }).notNull(),
    priority: mysqlEnum("priority", ["normal", "important", "urgent"]).notNull().default("normal"),
    zone: mysqlEnum("zone", ["top", "center"]),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow()
  },
  (table) => [index("overlay_events_stream_session_id_idx").on(table.streamSessionId), index("overlay_events_type_idx").on(table.type)]
);

export const actionItems = mysqlTable(
  "action_items",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    title: varchar("title", { length: 191 }).notNull(),
    description: text("description").notNull(),
    category: mysqlEnum("category", [
      "ai",
      "donation",
      "moderation",
      "overlay",
      "project",
      "schedule",
      "stream",
      "sponsor",
      "system"
    ]).notNull(),
    decisionKind: mysqlEnum("decision_kind", [
      "approve",
      "approve-or-reject",
      "review",
      "defer",
      "acknowledge"
    ]).notNull(),
    priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).notNull().default("normal"),
    status: mysqlEnum("status", ["open", "approved", "rejected", "deferred", "completed"]).notNull().default("open"),
    streamRelevant: boolean("stream_relevant").notNull().default(false),
    liveSafe: boolean("live_safe").notNull().default(false),
    dueAt: timestamp("due_at"),
    sourceType: mysqlEnum("source_type", [
      "ai",
      "donation",
      "moderation",
      "overlay",
      "project",
      "schedule",
      "stream",
      "sponsor",
      "system"
    ]),
    sourceId: varchar("source_id", { length: 191 }),
    sourceLabel: varchar("source_label", { length: 191 }),
    legacyPayload: json("payload").$type<Record<string, unknown>>(),
    legacyCreatedByUserId: varchar("created_by_user_id", { length: 36 }),
    legacyResolvedByUserId: varchar("resolved_by_user_id", { length: 36 }),
    legacyResolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("action_items_status_priority_due_at_idx").on(table.status, table.priority, table.dueAt),
    index("action_items_category_idx").on(table.category),
    check(
      "action_items_source_fields_check",
      sql`(
        (${table.sourceType} is null and ${table.sourceId} is null and ${table.sourceLabel} is null)
        or
        (${table.sourceType} is not null and ${table.sourceId} is not null and ${table.sourceLabel} is not null)
      )`
    )
  ]
);

export const actionItemHistory = mysqlTable(
  "action_item_history",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    actionId: varchar("action_id", { length: 36 }).notNull().references(() => actionItems.id),
    decision: mysqlEnum("decision", ["approve", "reject", "defer"]).notNull(),
    previousStatus: mysqlEnum("previous_status", ["open", "approved", "rejected", "deferred", "completed"]).notNull(),
    newStatus: mysqlEnum("new_status", ["open", "approved", "rejected", "deferred", "completed"]).notNull(),
    actorUserId: varchar("actor_user_id", { length: 36 }).notNull().references(() => users.id),
    note: varchar("note", { length: 1000 }),
    createdAt: timestamp("created_at").notNull().defaultNow()
  },
  (table) => [
    index("action_item_history_action_created_at_idx").on(table.actionId, table.createdAt),
    index("action_item_history_created_at_idx").on(table.createdAt),
    index("action_item_history_actor_user_id_idx").on(table.actorUserId),
    check(
      "action_item_history_transition_check",
      sql`(
        (
          ${table.decision} = 'approve'
          and ${table.previousStatus} in ('open', 'deferred')
          and ${table.newStatus} = 'approved'
        )
        or
        (
          ${table.decision} = 'reject'
          and ${table.previousStatus} in ('open', 'deferred')
          and ${table.newStatus} = 'rejected'
        )
        or
        (
          ${table.decision} = 'defer'
          and ${table.previousStatus} = 'open'
          and ${table.newStatus} = 'deferred'
        )
      )`
    )
  ]
);
