import {
  boolean,
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

export const appMetadata = mysqlTable("app_metadata", {
  key: varchar("key", { length: 191 }).primaryKey(),
  value: varchar("value", { length: 1024 }).notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
});

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  displayName: varchar("display_name", { length: 191 }).notNull(),
  profileVisibility: mysqlEnum("profile_visibility", ["private", "minimal", "public"]).notNull().default("private"),
  avatarUrl: varchar("avatar_url", { length: 1024 }),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
});

export const linkedAccounts = mysqlTable(
  "linked_accounts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    provider: varchar("provider", { length: 80 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 191 }).notNull(),
    displayName: varchar("display_name", { length: 191 }).notNull(),
    allowLogin: boolean("allow_login").notNull().default(true),
    capabilities: json("capabilities").$type<string[]>().notNull(),
    verifiedAt: timestamp("verified_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("linked_accounts_user_id_idx").on(table.userId),
    uniqueIndex("linked_accounts_provider_account_uidx").on(table.provider, table.providerAccountId)
  ]
);

export const roles = mysqlTable("roles", {
  id: varchar("id", { length: 36 }).primaryKey(),
  key: varchar("key", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 191 }).notNull(),
  permissions: json("permissions").$type<string[]>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
});

export const userRoles = mysqlTable(
  "user_roles",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    roleId: varchar("role_id", { length: 36 }).notNull(),
    assignedAt: timestamp("assigned_at").notNull().defaultNow()
  },
  (table) => [
    index("user_roles_user_id_idx").on(table.userId),
    uniqueIndex("user_roles_user_role_uidx").on(table.userId, table.roleId)
  ]
);

export const projects = mysqlTable(
  "projects",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    slug: varchar("slug", { length: 191 }).notNull().unique(),
    title: varchar("title", { length: 191 }).notNull(),
    summary: text("summary"),
    type: mysqlEnum("type", [
      "one-time-purchase",
      "multi-item-build",
      "ongoing-cost",
      "subscription",
      "stream-work-project",
      "milestone-only"
    ]).notNull(),
    category: mysqlEnum("category", [
      "personal",
      "family",
      "content-improvement",
      "stream-infrastructure",
      "software-project",
      "hobby",
      "community",
      "health-accessibility",
      "experiment",
      "ongoing-cost"
    ]).notNull(),
    status: mysqlEnum("status", ["planning", "active", "completed", "mothballed", "cancelled"]).notNull().default("planning"),
    isPublic: boolean("is_public").notNull().default(false),
    createdByUserId: varchar("created_by_user_id", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [index("projects_status_idx").on(table.status), index("projects_category_idx").on(table.category)]
);

export const projectMilestones = mysqlTable(
  "project_milestones",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: varchar("project_id", { length: 36 }).notNull(),
    title: varchar("title", { length: 191 }).notNull(),
    description: text("description"),
    status: mysqlEnum("status", ["planned", "active", "completed", "cancelled"]).notNull().default("planned"),
    sortOrder: int("sort_order").notNull().default(0),
    startsAt: timestamp("starts_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [index("project_milestones_project_id_idx").on(table.projectId)]
);

export const projectItems = mysqlTable(
  "project_items",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: varchar("project_id", { length: 36 }).notNull(),
    parentItemId: varchar("parent_item_id", { length: 36 }),
    title: varchar("title", { length: 191 }).notNull(),
    description: text("description"),
    kind: mysqlEnum("kind", ["product", "service", "subscription", "task", "wishlist", "other"]).notNull(),
    status: mysqlEnum("status", ["planned", "active", "acquired", "completed", "removed"]).notNull().default("planned"),
    quantity: int("quantity").notNull().default(1),
    estimatedMinorAmount: int("estimated_minor_amount"),
    currencyCode: varchar("currency_code", { length: 3 }),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("project_items_project_id_idx").on(table.projectId),
    index("project_items_parent_item_id_idx").on(table.parentItemId),
    index("project_items_status_idx").on(table.status)
  ]
);

export const projectItemLinks = mysqlTable(
  "project_item_links",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectItemId: varchar("project_item_id", { length: 36 }).notNull(),
    provider: varchar("provider", { length: 80 }).notNull(),
    url: varchar("url", { length: 1024 }).notNull(),
    label: varchar("label", { length: 191 }).notNull(),
    relationship: mysqlEnum("relationship", ["store-product", "wishlist-entry", "reference", "receipt"]).notNull(),
    lastSeenMinorAmount: int("last_seen_minor_amount"),
    currencyCode: varchar("currency_code", { length: 3 }),
    checkedAt: timestamp("checked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("project_item_links_project_item_id_idx").on(table.projectItemId),
    index("project_item_links_provider_idx").on(table.provider)
  ]
);

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
    description: text("description"),
    status: mysqlEnum("status", ["open", "approved", "rejected", "deferred", "resolved"]).notNull().default("open"),
    urgency: mysqlEnum("urgency", ["low", "normal", "high", "critical"]).notNull().default("normal"),
    category: varchar("category", { length: 80 }).notNull(),
    liveSafe: boolean("live_safe").notNull().default(false),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdByUserId: varchar("created_by_user_id", { length: 36 }),
    resolvedByUserId: varchar("resolved_by_user_id", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [index("action_items_status_idx").on(table.status), index("action_items_urgency_idx").on(table.urgency)]
);

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
