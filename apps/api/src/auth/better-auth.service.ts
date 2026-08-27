import { createDatabase, createDatabasePool } from "@maiks-yt/database";
import * as databaseSchema from "@maiks-yt/database";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import {
  assertTrustedOriginEnvironment,
  getBetterAuthBaseUrl,
  getTrustedOrigins
} from "./better-auth-origin.rules.js";

export { getTrustedOrigins } from "./better-auth-origin.rules.js";

export const configuredAuthProviderIds = [
  process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? "github" : undefined,
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? "google" : undefined,
  process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET ? "discord" : undefined,
  process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET ? "twitch" : undefined
].filter((providerId): providerId is string => Boolean(providerId));

const createSocialProviders = () => ({
  ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET
      }
    }
    : {}),
  ...(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
    ? {
      discord: {
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET
      }
    }
    : {}),
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET
      }
    }
    : {}),
  ...(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET
    ? {
      twitch: {
        clientId: process.env.TWITCH_CLIENT_ID,
        clientSecret: process.env.TWITCH_CLIENT_SECRET
      }
    }
    : {})
});

assertTrustedOriginEnvironment();

const database = createDatabase(createDatabasePool());
const betterAuthSecret = process.env.BETTER_AUTH_SECRET;

if (process.env.NODE_ENV === "production" && !betterAuthSecret) {
  throw new Error("BETTER_AUTH_SECRET is required in production.");
}

export const auth = betterAuth({
  baseURL: getBetterAuthBaseUrl(),
  basePath: "/auth",
  secret: betterAuthSecret ?? "development-only-better-auth-secret-change-before-production",
  trustedOrigins: getTrustedOrigins(),
  database: drizzleAdapter(database, {
    provider: "mysql",
    schema: databaseSchema,
    camelCase: true
  }),
  user: {
    modelName: "authUsers"
  },
  session: {
    modelName: "authSessions"
  },
  account: {
    modelName: "authAccounts",
    accountLinking: {
      enabled: true,
      trustedProviders: ["github", "google", "discord", "twitch"],
      allowDifferentEmails: true
    }
  },
  verification: {
    modelName: "authVerifications"
  },
  socialProviders: createSocialProviders(),
  advanced: {
    database: {
      generateId: () => crypto.randomUUID()
    }
  }
});
