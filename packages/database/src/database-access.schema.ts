import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core";

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

export const providerRuntimeCredentials = mysqlTable(
  "provider_runtime_credentials",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    ownerUserId: varchar("owner_user_id", { length: 36 }).notNull(),
    provider: mysqlEnum("provider", ["youtube", "twitch", "discord"]).notNull(),
    purpose: mysqlEnum("purpose", ["youtube_live_chat", "twitch_eventsub", "discord_gateway"]).notNull(),
    status: mysqlEnum("status", ["active", "revoked", "error"]).notNull().default("active"),
    providerAccountId: varchar("provider_account_id", { length: 191 }),
    displayName: varchar("display_name", { length: 191 }),
    scopes: json("scopes").$type<string[]>().notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    lastVerifiedAt: timestamp("last_verified_at"),
    lastError: varchar("last_error", { length: 512 }),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    uniqueIndex("provider_runtime_owner_provider_purpose_uidx").on(table.ownerUserId, table.provider, table.purpose),
    index("provider_runtime_provider_status_idx").on(table.provider, table.status),
    index("provider_runtime_owner_status_idx").on(table.ownerUserId, table.status),
    index("provider_runtime_revoked_at_idx").on(table.revokedAt),
    check(
      "provider_runtime_youtube_purpose_check",
      sql`${table.provider} <> 'youtube' or ${table.purpose} = 'youtube_live_chat'`
    ),
    check(
      "provider_runtime_twitch_purpose_check",
      sql`${table.provider} <> 'twitch' or ${table.purpose} = 'twitch_eventsub'`
    ),
    check(
      "provider_runtime_discord_purpose_check",
      sql`${table.provider} <> 'discord' or ${table.purpose} = 'discord_gateway'`
    ),
    check(
      "provider_runtime_active_token_check",
      sql`${table.provider} <> 'youtube' or ${table.status} <> 'active' or ${table.refreshToken} is not null`
    ),
    check(
      "provider_runtime_revocation_check",
      sql`(
        (${table.status} <> 'revoked' and ${table.revokedAt} is null)
        or
        (${table.status} = 'revoked' and ${table.revokedAt} is not null)
      )`
    )
  ]
);

export const providerChannelIdentities = mysqlTable(
  "provider_channel_identities",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    ownerUserId: varchar("owner_user_id", { length: 36 }).notNull(),
    provider: mysqlEnum("provider", ["youtube", "twitch", "discord"]).notNull(),
    providerChannelId: varchar("provider_channel_id", { length: 191 }).notNull(),
    displayName: varchar("display_name", { length: 191 }).notNull(),
    handle: varchar("handle", { length: 191 }),
    thumbnailUrl: varchar("thumbnail_url", { length: 1024 }),
    selectedForLiveChat: boolean("selected_for_live_chat").notNull().default(false),
    discoveredAt: timestamp("discovered_at").notNull(),
    lastSeenAt: timestamp("last_seen_at").notNull(),
    selectedAt: timestamp("selected_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    uniqueIndex("provider_channel_owner_provider_channel_uidx").on(
      table.ownerUserId,
      table.provider,
      table.providerChannelId
    ),
    index("provider_channel_owner_provider_idx").on(table.ownerUserId, table.provider),
    index("provider_channel_live_chat_selected_idx").on(table.ownerUserId, table.provider, table.selectedForLiveChat),
    index("provider_channel_last_seen_idx").on(table.provider, table.lastSeenAt),
    check(
      "provider_channel_selected_at_check",
      sql`${table.selectedForLiveChat} = false or ${table.selectedAt} is not null`
    )
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
