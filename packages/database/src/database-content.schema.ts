import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core";

export const publicUpdates = mysqlTable(
  "public_updates",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    slug: varchar("slug", { length: 191 }).notNull(),
    title: varchar("title", { length: 191 }).notNull(),
    summary: varchar("summary", { length: 500 }).notNull(),
    body: text("body").notNull(),
    kind: mysqlEnum("kind", ["post", "stream-recap", "announcement"]).notNull(),
    status: mysqlEnum("status", ["draft", "published"]).notNull().default("draft"),
    visibility: mysqlEnum("visibility", ["hidden", "public"]).notNull().default("hidden"),
    publishedAt: timestamp("published_at"),
    isPinned: boolean("is_pinned").notNull().default(false),
    isExample: boolean("is_example").notNull().default(false),
    createdByUserId: varchar("created_by_user_id", { length: 36 }),
    updatedByUserId: varchar("updated_by_user_id", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    uniqueIndex("public_updates_slug_uidx").on(table.slug),
    index("public_updates_listing_idx").on(
      table.status,
      table.visibility,
      table.isPinned,
      table.publishedAt
    ),
    index("public_updates_kind_idx").on(table.kind, table.publishedAt),
    check(
      "public_updates_slug_check",
      sql`(
        trim(${table.slug}) = ${table.slug}
        and ${table.slug} regexp '^[a-z0-9][a-z0-9-]{0,190}$'
      )`
    ),
    check(
      "public_updates_draft_visibility_check",
      sql`${table.status} <> 'draft' or ${table.visibility} = 'hidden'`
    ),
    check(
      "public_updates_published_at_check",
      sql`(
        (${table.status} = 'draft' and ${table.publishedAt} is null)
        or
        (${table.status} = 'published' and ${table.publishedAt} is not null)
      )`
    )
  ]
);
