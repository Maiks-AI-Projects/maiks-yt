import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import * as schema from "./database.schema.js";

export type DatabasePool = mysql.Pool;
export type Database = ReturnType<typeof createDatabase>;

export const createDatabasePool = (databaseUrl = process.env.DATABASE_URL): DatabasePool => {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to create a database pool.");
  }

  return mysql.createPool(databaseUrl);
};

export const createDatabase = (pool = createDatabasePool()) => {
  return drizzle(pool, {
    mode: "default",
    schema
  });
};
