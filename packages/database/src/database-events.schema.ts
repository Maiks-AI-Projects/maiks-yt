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

export const eventReplaySessions = mysqlTable("event_replay_sessions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  title: varchar("title", { length: 191 }).notNull(),
  description: text("description"),
  source: mysqlEnum("source", ["manual", "recorded", "fixture"]).notNull().default("manual"),
  sanitized: boolean("sanitized").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
});

export const eventReplayEvents = mysqlTable(
  "event_replay_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    replaySessionId: varchar("replay_session_id", { length: 36 }).notNull(),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    offsetMs: int("offset_ms").notNull().default(0),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    sortOrder: int("sort_order").notNull().default(0)
  },
  (table) => [
    index("event_replay_events_replay_session_id_idx").on(table.replaySessionId),
    index("event_replay_events_event_type_idx").on(table.eventType)
  ]
);

const eventActualSourcePlatformValues = ["twitch", "youtube", "discord", "website", "test/system"] as const;
const eventSourcePlatformValues = ["any", ...eventActualSourcePlatformValues] as const;

const eventKindValues = [
  "chat",
  "website.signup",
  "website.username-change",
  "website.profile-image-update",
  "website.project-update-published",
  "website.schedule-changed",
  "website.schedule-cancelled",
  "website.action-panel-item",
  "website.free-tts-request",
  "website.account-security-change",
  "website.provider-token-change",
  "twitch.follow",
  "twitch.sub",
  "twitch.bits",
  "twitch.raid",
  "twitch.redeem",
  "youtube.subscriber",
  "youtube.member",
  "youtube.super-chat",
  "youtube.super-sticker",
  "discord.message",
  "discord.join",
  "discord.role",
  "discord.boost",
  "simulated.support-money"
] as const;

const eventRoutingDestinationValues = [
  "ignore",
  "internal_audit",
  "control_panel",
  "top_notification",
  "center_notification",
  "streamer_feed",
  "streamer_chat",
  "approval_queue"
] as const;

export const eventRoutingRules = mysqlTable(
  "event_routing_rules",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    eventKind: mysqlEnum("event_kind", eventKindValues).notNull(),
    sourcePlatform: mysqlEnum("source_platform", eventSourcePlatformValues).notNull().default("any"),
    destination: mysqlEnum("destination", eventRoutingDestinationValues).notNull().default("internal_audit"),
    enabled: boolean("enabled").notNull().default(false),
    liveOnly: boolean("live_only").notNull().default(false),
    offlineOnly: boolean("offline_only").notNull().default(false),
    approvalRequired: boolean("approval_required").notNull().default(true),
    perUserCooldownSeconds: int("per_user_cooldown_seconds"),
    globalCooldownSeconds: int("global_cooldown_seconds"),
    oncePerStream: boolean("once_per_stream").notNull().default(false),
    templateKey: varchar("template_key", { length: 80 }),
    themeKey: varchar("theme_key", { length: 80 }),
    soundKey: varchar("sound_key", { length: 80 }),
    notificationPriority: mysqlEnum("notification_priority", ["low", "normal", "high", "urgent"]).notNull().default("normal"),
    createdByUserId: varchar("created_by_user_id", { length: 36 }),
    updatedByUserId: varchar("updated_by_user_id", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    uniqueIndex("event_routing_rules_kind_source_uidx").on(table.eventKind, table.sourcePlatform),
    index("event_routing_rules_destination_idx").on(table.destination),
    index("event_routing_rules_enabled_idx").on(table.enabled),
    check(
      "event_routing_rules_live_window_check",
      sql`not (${table.liveOnly} = true and ${table.offlineOnly} = true)`
    ),
    check(
      "event_routing_rules_per_user_cooldown_check",
      sql`${table.perUserCooldownSeconds} is null or ${table.perUserCooldownSeconds} >= 0`
    ),
    check(
      "event_routing_rules_global_cooldown_check",
      sql`${table.globalCooldownSeconds} is null or ${table.globalCooldownSeconds} >= 0`
    ),
    check(
      "event_routing_rules_internal_only_destination_check",
      sql`(
        ${table.eventKind} not in (
          'website.account-security-change',
          'website.provider-token-change',
          'website.action-panel-item',
          'discord.role'
        )
        or ${table.destination} in ('ignore', 'internal_audit', 'control_panel')
      )`
    )
  ]
);

export const eventUserOptOuts = mysqlTable(
  "event_user_opt_outs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    eventKind: mysqlEnum("event_kind", [
      "all_stream_visible_website_events",
      "website.signup",
      "website.username-change",
      "website.profile-image-update",
      "website.free-tts-request"
    ])
      .notNull()
      .default("all_stream_visible_website_events"),
    optedOut: boolean("opted_out").notNull().default(true),
    reason: varchar("reason", { length: 191 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    uniqueIndex("event_user_opt_outs_user_kind_uidx").on(table.userId, table.eventKind),
    index("event_user_opt_outs_user_id_idx").on(table.userId),
    index("event_user_opt_outs_event_kind_idx").on(table.eventKind)
  ]
);

export const eventHistory = mysqlTable(
  "event_history",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sourcePlatform: mysqlEnum("source_platform", eventActualSourcePlatformValues).notNull(),
    eventKind: mysqlEnum("event_kind", eventKindValues).notNull(),
    sourceEventId: varchar("source_event_id", { length: 191 }),
    routingRuleId: varchar("routing_rule_id", { length: 36 }),
    routingOutcome: mysqlEnum("routing_outcome", [
      "ignored",
      "stored_internal",
      "routed",
      "queued_for_approval",
      "blocked_opt_out",
      "blocked_cooldown",
      "blocked_safety",
      "failed"
    ])
      .notNull()
      .default("stored_internal"),
    destination: mysqlEnum("destination", eventRoutingDestinationValues),
    actorUserId: varchar("actor_user_id", { length: 36 }),
    actorExternalId: varchar("actor_external_id", { length: 191 }),
    actorDisplayName: varchar("actor_display_name", { length: 191 }),
    userId: varchar("user_id", { length: 36 }),
    streamSessionId: varchar("stream_session_id", { length: 36 }),
    streamScheduleEntryId: varchar("stream_schedule_entry_id", { length: 36 }),
    sessionId: varchar("session_id", { length: 191 }),
    isTest: boolean("is_test").notNull().default(false),
    isSimulated: boolean("is_simulated").notNull().default(false),
    isRealMoney: boolean("is_real_money").notNull().default(false),
    testResettable: boolean("test_resettable").notNull().default(false),
    redactedPayload: json("redacted_payload").$type<Record<string, unknown>>().notNull(),
    occurredAt: timestamp("occurred_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow()
  },
  (table) => [
    index("event_history_source_kind_created_idx").on(table.sourcePlatform, table.eventKind, table.createdAt),
    index("event_history_actor_user_idx").on(table.actorUserId),
    index("event_history_user_idx").on(table.userId),
    index("event_history_stream_session_idx").on(table.streamSessionId),
    index("event_history_stream_schedule_entry_idx").on(table.streamScheduleEntryId),
    index("event_history_routing_rule_idx").on(table.routingRuleId),
    index("event_history_test_resettable_idx").on(table.testResettable, table.createdAt),
    check(
      "event_history_destination_outcome_check",
      sql`(
        (
          ${table.routingOutcome} in ('ignored', 'blocked_opt_out', 'blocked_cooldown', 'blocked_safety', 'failed')
          and ${table.destination} is null
        )
        or
        (
          ${table.routingOutcome} in ('stored_internal', 'routed', 'queued_for_approval')
          and ${table.destination} is not null
        )
      )`
    ),
    check(
      "event_history_simulated_money_check",
      sql`not (${table.isRealMoney} = true and (${table.isTest} = true or ${table.isSimulated} = true))`
    ),
    check(
      "event_history_test_reset_boundary_check",
      sql`(
        ${table.testResettable} = false
        or (
          (${table.isTest} = true or ${table.isSimulated} = true)
          and ${table.isRealMoney} = false
        )
      )`
    )
  ]
);

export const eventApprovalQueue = mysqlTable(
  "event_approval_queue",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    eventHistoryId: varchar("event_history_id", { length: 36 }).notNull(),
    routingRuleId: varchar("routing_rule_id", { length: 36 }),
    destination: mysqlEnum("destination", eventRoutingDestinationValues).notNull(),
    status: mysqlEnum("status", ["pending", "approved", "rejected", "expired", "cancelled"]).notNull().default("pending"),
    reviewerUserId: varchar("reviewer_user_id", { length: 36 }),
    reviewedAt: timestamp("reviewed_at"),
    reviewNote: varchar("review_note", { length: 1000 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    uniqueIndex("event_approval_queue_history_uidx").on(table.eventHistoryId),
    index("event_approval_queue_status_created_idx").on(table.status, table.createdAt),
    index("event_approval_queue_reviewer_idx").on(table.reviewerUserId),
    index("event_approval_queue_rule_idx").on(table.routingRuleId),
    check(
      "event_approval_queue_review_state_check",
      sql`(
        (
          ${table.status} = 'pending'
          and ${table.reviewerUserId} is null
          and ${table.reviewedAt} is null
          and ${table.reviewNote} is null
        )
        or
        (
          ${table.status} <> 'pending'
          and ${table.reviewedAt} is not null
        )
      )`
    )
  ]
);

export const eventCooldownState = mysqlTable(
  "event_cooldown_state",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    routingRuleId: varchar("routing_rule_id", { length: 36 }).notNull(),
    eventKind: mysqlEnum("event_kind", eventKindValues).notNull(),
    sourcePlatform: mysqlEnum("source_platform", eventActualSourcePlatformValues).notNull(),
    scope: mysqlEnum("scope", ["global", "user", "stream", "user_stream"]).notNull(),
    cooldownKey: varchar("cooldown_key", { length: 191 }).notNull(),
    actorUserId: varchar("actor_user_id", { length: 36 }),
    actorExternalId: varchar("actor_external_id", { length: 191 }),
    streamSessionId: varchar("stream_session_id", { length: 36 }),
    streamScheduleEntryId: varchar("stream_schedule_entry_id", { length: 36 }),
    windowStartedAt: timestamp("window_started_at").notNull(),
    windowEndsAt: timestamp("window_ends_at").notNull(),
    hitCount: int("hit_count").notNull().default(0),
    lastEventHistoryId: varchar("last_event_history_id", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    uniqueIndex("event_cooldown_state_rule_key_uidx").on(table.routingRuleId, table.cooldownKey),
    index("event_cooldown_state_window_idx").on(table.windowEndsAt),
    index("event_cooldown_state_event_kind_idx").on(table.eventKind),
    index("event_cooldown_state_actor_user_idx").on(table.actorUserId),
    index("event_cooldown_state_stream_session_idx").on(table.streamSessionId),
    check(
      "event_cooldown_state_window_check",
      sql`${table.windowEndsAt} > ${table.windowStartedAt}`
    ),
    check(
      "event_cooldown_state_hit_count_check",
      sql`${table.hitCount} >= 0`
    )
  ]
);
