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

export const authUsers = mysqlTable(
  "auth_users",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 191 }).notNull(),
    email: varchar("email", { length: 191 }).notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: varchar("image", { length: 1024 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [uniqueIndex("auth_users_email_uidx").on(table.email)]
);

export const authSessions = mysqlTable(
  "auth_sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    token: varchar("token", { length: 191 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    ipAddress: varchar("ip_address", { length: 191 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    uniqueIndex("auth_sessions_token_uidx").on(table.token),
    index("auth_sessions_user_id_idx").on(table.userId),
    index("auth_sessions_expires_at_idx").on(table.expiresAt)
  ]
);

export const authAccounts = mysqlTable(
  "auth_accounts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    accountId: varchar("account_id", { length: 191 }).notNull(),
    providerId: varchar("provider_id", { length: 80 }).notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("auth_accounts_user_id_idx").on(table.userId),
    uniqueIndex("auth_accounts_provider_account_uidx").on(table.providerId, table.accountId)
  ]
);

export const authVerifications = mysqlTable(
  "auth_verifications",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    identifier: varchar("identifier", { length: 191 }).notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [index("auth_verifications_identifier_idx").on(table.identifier)]
);

export const authUserLinks = mysqlTable(
  "auth_user_links",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    authUserId: varchar("auth_user_id", { length: 36 }).notNull(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("auth_user_links_auth_user_id_uidx").on(table.authUserId),
    uniqueIndex("auth_user_links_user_id_uidx").on(table.userId)
  ]
);

export const linkedAccounts = mysqlTable(
  "linked_accounts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    provider: varchar("provider", { length: 80 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 191 }).notNull(),
    displayName: varchar("display_name", { length: 191 }).notNull(),
    purposeLabel: varchar("purpose_label", { length: 191 }),
    audienceKey: varchar("audience_key", { length: 80 }),
    channelKey: varchar("channel_key", { length: 80 }),
    allowLogin: boolean("allow_login").notNull().default(true),
    capabilities: json("capabilities").$type<string[]>().notNull(),
    verifiedAt: timestamp("verified_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("linked_accounts_user_id_idx").on(table.userId),
    index("linked_accounts_audience_key_idx").on(table.audienceKey),
    index("linked_accounts_channel_key_idx").on(table.channelKey),
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

export const urlAccessTokens = mysqlTable(
  "url_access_tokens",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    label: varchar("label", { length: 191 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    surface: mysqlEnum("surface", ["overlay", "control-panel", "admin", "api"]).notNull(),
    scopes: json("scopes").$type<string[]>().notNull(),
    requiresLogin: boolean("requires_login").notNull().default(true),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("url_access_tokens_surface_idx").on(table.surface),
    index("url_access_tokens_expires_at_idx").on(table.expiresAt),
    index("url_access_tokens_revoked_at_idx").on(table.revokedAt)
  ]
);

export const devAuthTokens = mysqlTable(
  "dev_auth_tokens",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    label: varchar("label", { length: 191 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    authUserId: varchar("auth_user_id", { length: 36 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("dev_auth_tokens_auth_user_id_idx").on(table.authUserId),
    index("dev_auth_tokens_expires_at_idx").on(table.expiresAt),
    index("dev_auth_tokens_revoked_at_idx").on(table.revokedAt)
  ]
);

export const systemNotifications = mysqlTable(
  "system_notifications",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    title: varchar("title", { length: 191 }).notNull(),
    body: text("body").notNull(),
    severity: mysqlEnum("severity", ["info", "warning", "critical"]).notNull().default("info"),
    source: mysqlEnum("source", ["dev_smoke", "system", "security", "provider", "moderation", "money"]).notNull().default("system"),
    status: mysqlEnum("status", ["unread", "read", "archived"]).notNull().default("unread"),
    actionUrl: varchar("action_url", { length: 1024 }),
    createdByUserId: varchar("created_by_user_id", { length: 36 }),
    readAt: timestamp("read_at"),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("system_notifications_status_created_idx").on(table.status, table.createdAt),
    index("system_notifications_severity_created_idx").on(table.severity, table.createdAt),
    index("system_notifications_source_created_idx").on(table.source, table.createdAt),
    index("system_notifications_created_by_user_idx").on(table.createdByUserId),
    check("system_notifications_read_state_check", sql`${table.status} <> 'read' or ${table.readAt} is not null`),
    check("system_notifications_archived_state_check", sql`${table.status} <> 'archived' or ${table.archivedAt} is not null`)
  ]
);

export const notificationPushSubscriptions = mysqlTable(
  "notification_push_subscriptions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    endpointHash: varchar("endpoint_hash", { length: 64 }).notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: varchar("p256dh", { length: 191 }).notNull(),
    auth: varchar("auth", { length: 191 }).notNull(),
    userAgent: varchar("user_agent", { length: 512 }),
    lastPushAt: timestamp("last_push_at"),
    lastError: varchar("last_error", { length: 512 }),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    uniqueIndex("notification_push_endpoint_hash_uidx").on(table.endpointHash),
    index("notification_push_user_idx").on(table.userId),
    index("notification_push_revoked_idx").on(table.revokedAt),
    index("notification_push_last_push_idx").on(table.lastPushAt)
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

export const projectUpdates = mysqlTable(
  "project_updates",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: varchar("project_id", { length: 36 }).notNull(),
    title: varchar("title", { length: 191 }).notNull(),
    summary: varchar("summary", { length: 280 }),
    body: text("body").notNull(),
    status: mysqlEnum("status", ["draft", "published"]).notNull().default("draft"),
    isVisible: boolean("is_visible").notNull().default(true),
    publishedAt: timestamp("published_at"),
    isPinned: boolean("is_pinned").notNull().default(false),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("project_updates_project_id_idx").on(table.projectId),
    index("project_updates_public_order_idx").on(
      table.projectId,
      table.status,
      table.isVisible,
      table.isPinned,
      table.sortOrder,
      table.publishedAt
    )
  ]
);

export const creatorLinks = mysqlTable(
  "creator_links",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    key: varchar("key", { length: 80 }).notNull().unique(),
    title: varchar("title", { length: 191 }).notNull(),
    description: text("description").notNull(),
    purpose: mysqlEnum("purpose", [
      "account",
      "accountability",
      "affiliate",
      "community",
      "context",
      "feed",
      "project",
      "social",
      "stream",
      "support",
      "tool"
    ]).notNull(),
    icon: mysqlEnum("icon", [
      "account",
      "accountability",
      "affiliate",
      "community",
      "context",
      "discord",
      "feed",
      "project",
      "social",
      "stream",
      "support",
      "twitch",
      "tool",
      "youtube"
    ]).notNull(),
    availability: mysqlEnum("availability", ["available", "unavailable"]).notNull().default("unavailable"),
    href: varchar("href", { length: 1024 }),
    availabilityNote: varchar("availability_note", { length: 191 }),
    isPrimary: boolean("is_primary").notNull().default(false),
    sortOrder: int("sort_order").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("creator_links_published_sort_idx").on(table.isPublished, table.sortOrder),
    index("creator_links_purpose_idx").on(table.purpose),
    check(
      "creator_links_availability_check",
      sql`(
        (
          ${table.availability} = 'available'
          and ${table.href} is not null
          and trim(${table.href}) <> ''
        )
        or
        (
          ${table.availability} = 'unavailable'
          and ${table.availabilityNote} is not null
          and trim(${table.availabilityNote}) <> ''
        )
      )`
    )
  ]
);

export const contentPages = mysqlTable(
  "content_pages",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    title: varchar("title", { length: 191 }).notNull(),
    routeScope: mysqlEnum("route_scope", ["primary"]).notNull().default("primary"),
    normalizedPath: varchar("normalized_path", { length: 191 }).notNull(),
    status: mysqlEnum("status", ["draft", "published"]).notNull().default("draft"),
    visibility: mysqlEnum("visibility", ["hidden", "public"]).notNull().default("hidden"),
    seoTitle: varchar("seo_title", { length: 191 }),
    seoDescription: varchar("seo_description", { length: 320 }),
    body: text("body").notNull(),
    createdByUserId: varchar("created_by_user_id", { length: 36 }),
    updatedByUserId: varchar("updated_by_user_id", { length: 36 }),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    uniqueIndex("content_pages_route_key_uidx").on(table.routeScope, table.normalizedPath),
    index("content_pages_public_lookup_idx").on(table.routeScope, table.normalizedPath, table.status, table.visibility),
    index("content_pages_admin_listing_idx").on(table.status, table.visibility, table.updatedAt),
    index("content_pages_created_by_user_idx").on(table.createdByUserId),
    check("content_pages_route_scope_check", sql`${table.routeScope} = 'primary'`),
    check(
      "content_pages_normalized_path_check",
      sql`(
        trim(${table.normalizedPath}) = ${table.normalizedPath}
        and ${table.normalizedPath} <> ''
        and left(${table.normalizedPath}, 1) = '/'
        and ${table.normalizedPath} not like '%?%'
        and ${table.normalizedPath} not like '%#%'
      )`
    ),
    check(
      "content_pages_draft_visibility_check",
      sql`${table.status} <> 'draft' or ${table.visibility} = 'hidden'`
    ),
    check(
      "content_pages_published_at_check",
      sql`(
        (${table.status} = 'draft' and ${table.publishedAt} is null)
        or
        (${table.status} = 'published' and ${table.publishedAt} is not null)
      )`
    )
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
