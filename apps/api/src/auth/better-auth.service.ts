import { createDatabase, createDatabasePool } from "@maiks-yt/database";
import * as databaseSchema from "@maiks-yt/database";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

const defaultTrustedOrigins = [
  "http://localhost:3000",
  "http://localhost:3002",
  "http://localhost:3003",
  "https://web-dev.maiks.yt",
  "https://overlay-dev.maiks.yt",
  "https://control-dev.maiks.yt"
] as const;

export const configuredAuthProviderIds = [
  process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? "github" : undefined,
  process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET ? "discord" : undefined,
  process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET ? "twitch" : undefined
].filter((providerId): providerId is string => Boolean(providerId));

export const getTrustedOrigins = (): string[] => {
  const configuredOrigins = process.env.AUTH_TRUSTED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return configuredOrigins?.length ? configuredOrigins : [...defaultTrustedOrigins];
};

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
  ...(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET
    ? {
      twitch: {
        clientId: process.env.TWITCH_CLIENT_ID,
        clientSecret: process.env.TWITCH_CLIENT_SECRET
      }
    }
    : {})
});

const database = createDatabase(createDatabasePool());
const betterAuthSecret = process.env.BETTER_AUTH_SECRET;

if (process.env.NODE_ENV === "production" && !betterAuthSecret) {
  throw new Error("BETTER_AUTH_SECRET is required in production.");
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
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
      trustedProviders: ["github", "discord", "twitch"],
      allowDifferentEmails: false
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
