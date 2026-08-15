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

export const gameCatalogEntries = mysqlTable(
  "game_catalog_entries",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    canonicalTitle: varchar("canonical_title", { length: 191 }).notNull(),
    normalizedTitle: varchar("normalized_title", { length: 191 }).notNull(),
    matchState: mysqlEnum("match_state", ["discovered", "owner-confirmed"]).notNull().default("discovered"),
    firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("game_catalog_entries_title_idx").on(table.normalizedTitle),
    index("game_catalog_entries_match_state_idx").on(table.matchState, table.lastSeenAt),
    check("game_catalog_entries_title_not_blank_check", sql`trim(${table.canonicalTitle}) <> ''`),
    check("game_catalog_entries_normalized_title_not_blank_check", sql`trim(${table.normalizedTitle}) <> ''`)
  ]
);

export const gameCatalogProviderIdentities = mysqlTable(
  "game_catalog_provider_identities",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    catalogGameId: varchar("catalog_game_id", { length: 36 }).notNull(),
    provider: mysqlEnum("provider", ["steam", "twitch", "igdb", "other"]).notNull(),
    providerGameId: varchar("provider_game_id", { length: 191 }).notNull(),
    providerTitle: varchar("provider_title", { length: 191 }).notNull(),
    storeUrl: varchar("store_url", { length: 1024 }),
    artworkUrl: varchar("artwork_url", { length: 1024 }),
    popularityScore: int("popularity_score"),
    popularityUpdatedAt: timestamp("popularity_updated_at"),
    firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    lastRefreshedAt: timestamp("last_refreshed_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    uniqueIndex("game_catalog_provider_identity_uidx").on(table.provider, table.providerGameId),
    index("game_catalog_provider_catalog_idx").on(table.catalogGameId, table.provider),
    index("game_catalog_provider_title_idx").on(table.provider, table.providerTitle),
    index("game_catalog_provider_popularity_idx").on(table.provider, table.popularityScore),
    check("game_catalog_provider_game_id_not_blank_check", sql`trim(${table.providerGameId}) <> ''`),
    check("game_catalog_provider_title_not_blank_check", sql`trim(${table.providerTitle}) <> ''`),
    check("game_catalog_provider_popularity_nonnegative_check", sql`${table.popularityScore} is null or ${table.popularityScore} >= 0`)
  ]
);

export const gameLibraryEntries = mysqlTable(
  "game_library_entries",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    catalogGameId: varchar("catalog_game_id", { length: 36 }),
    slug: varchar("slug", { length: 191 }).notNull(),
    title: varchar("title", { length: 191 }).notNull(),
    platformLabel: varchar("platform_label", { length: 120 }),
    storeProvider: varchar("store_provider", { length: 80 }),
    storeUrl: varchar("store_url", { length: 1024 }),
    ownershipStatus: mysqlEnum("ownership_status", [
      "owned",
      "not-owned",
      "borrowed",
      "subscription-access",
      "gifted",
      "unknown"
    ]).notNull().default("unknown"),
    interestStatus: mysqlEnum("interest_status", [
      "interested",
      "maybe-later",
      "currently-playing",
      "completed",
      "paused",
      "not-a-fit"
    ]).notNull().default("interested"),
    streamFitNote: varchar("stream_fit_note", { length: 500 }),
    contentWarnings: text("content_warnings"),
    categoryLabel: varchar("category_label", { length: 120 }),
    visibility: mysqlEnum("visibility", ["private", "public"]).notNull().default("private"),
    sortOrder: int("sort_order").notNull().default(0),
    createdByUserId: varchar("created_by_user_id", { length: 36 }),
    updatedByUserId: varchar("updated_by_user_id", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    uniqueIndex("game_library_entries_slug_uidx").on(table.slug),
    index("game_library_entries_catalog_game_idx").on(table.catalogGameId),
    index("game_library_entries_public_idx").on(table.visibility, table.interestStatus, table.sortOrder),
    index("game_library_entries_ownership_idx").on(table.ownershipStatus),
    check("game_library_entries_slug_not_blank_check", sql`trim(${table.slug}) <> ''`),
    check("game_library_entries_title_not_blank_check", sql`trim(${table.title}) <> ''`)
  ]
);

export const gameSuggestions = mysqlTable(
  "game_suggestions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    title: varchar("title", { length: 191 }).notNull(),
    platformLabel: varchar("platform_label", { length: 120 }),
    storeUrl: varchar("store_url", { length: 1024 }),
    reason: varchar("reason", { length: 1000 }),
    tags: json("tags").$type<readonly string[]>(),
    suggestedByUserId: varchar("suggested_by_user_id", { length: 36 }),
    suggestedByName: varchar("suggested_by_name", { length: 191 }),
    status: mysqlEnum("status", [
      "pending",
      "accepted",
      "maybe-later",
      "rejected",
      "duplicate",
      "already-played"
    ]).notNull().default("pending"),
    linkedGameId: varchar("linked_game_id", { length: 36 }),
    reviewerUserId: varchar("reviewer_user_id", { length: 36 }),
    reviewerNote: varchar("reviewer_note", { length: 1000 }),
    reviewedAt: timestamp("reviewed_at"),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    index("game_suggestions_status_idx").on(table.status, table.createdAt),
    index("game_suggestions_linked_game_idx").on(table.linkedGameId),
    index("game_suggestions_suggested_by_user_idx").on(table.suggestedByUserId),
    check("game_suggestions_title_not_blank_check", sql`trim(${table.title}) <> ''`),
    check(
      "game_suggestions_pending_private_check",
      sql`${table.status} <> 'pending' or ${table.isPublic} = false`
    ),
    check(
      "game_suggestions_review_state_check",
      sql`(
        (${table.status} = 'pending' and ${table.reviewerUserId} is null and ${table.reviewedAt} is null)
        or
        (${table.status} <> 'pending' and ${table.reviewerUserId} is not null and ${table.reviewedAt} is not null)
      )`
    )
  ]
);

export const gameScheduleLinks = mysqlTable(
  "game_schedule_links",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    gameId: varchar("game_id", { length: 36 }).notNull(),
    scheduleEntryId: varchar("schedule_entry_id", { length: 36 }).notNull(),
    relationship: mysqlEnum("relationship", ["planned", "current", "played", "completed-showcase"]).notNull().default("planned"),
    publicNote: varchar("public_note", { length: 280 }),
    sortOrder: int("sort_order").notNull().default(0),
    createdByUserId: varchar("created_by_user_id", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    uniqueIndex("game_schedule_links_entry_game_uidx").on(table.scheduleEntryId, table.gameId),
    index("game_schedule_links_game_idx").on(table.gameId),
    index("game_schedule_links_schedule_entry_idx").on(table.scheduleEntryId),
    index("game_schedule_links_relationship_idx").on(table.relationship)
  ]
);
