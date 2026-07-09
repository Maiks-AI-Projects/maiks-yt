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

export const gameLibraryEntries = mysqlTable(
  "game_library_entries",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
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
