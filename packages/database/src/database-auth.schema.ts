import {
  boolean,
  index,
  json,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core";

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
