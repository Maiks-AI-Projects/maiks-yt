import {
  mysqlEnum,
  mysqlTable,
  timestamp,
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
