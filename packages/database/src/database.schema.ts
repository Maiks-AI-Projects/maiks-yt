import { mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

export const appMetadata = mysqlTable("app_metadata", {
  key: varchar("key", { length: 191 }).primaryKey(),
  value: varchar("value", { length: 1024 }).notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
});
