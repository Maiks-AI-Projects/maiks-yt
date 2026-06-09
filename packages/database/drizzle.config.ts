import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL ?? "mysql://user:password@localhost:3306/maiks_yt_v2_dev";

export default defineConfig({
  schema: "./src/database.schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: databaseUrl
  },
  strict: true,
  verbose: true
});
