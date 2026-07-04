import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core";

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
