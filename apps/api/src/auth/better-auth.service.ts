import { createDatabase, createDatabasePool } from "@maiks-yt/database";
import * as databaseSchema from "@maiks-yt/database";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { createAuthDataCipherFromEnvironment } from "./auth-sensitive-field-crypto.service.js";
import { createAuthSessionTokenHasherFromEnvironment } from "./auth-session-token-hash.service.js";
import {
  assertTrustedOriginEnvironment,
  getBetterAuthBaseUrl,
  getTrustedOrigins
} from "./better-auth-origin.rules.js";
import { withProtectedAuthSensitiveFields } from "./better-auth-sensitive-field-adapter.service.js";

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
const authDataCipher = createAuthDataCipherFromEnvironment();
const authSessionTokenHasher = createAuthSessionTokenHasherFromEnvironment();

if (process.env.NODE_ENV === "production" && !betterAuthSecret) {
  throw new Error("BETTER_AUTH_SECRET is required in production.");
}

const authDatabaseAdapter = drizzleAdapter(database, {
  provider: "mysql",
  schema: databaseSchema,
  camelCase: true
});

export const auth = betterAuth({
  baseURL: getBetterAuthBaseUrl(),
  basePath: "/auth",
  secret: betterAuthSecret ?? "development-only-better-auth-secret-change-before-production",
  trustedOrigins: getTrustedOrigins(),
  database: authDataCipher || authSessionTokenHasher
    ? withProtectedAuthSensitiveFields(authDatabaseAdapter, {
      cipher: authDataCipher,
      sessionTokenHasher: authSessionTokenHasher
    })
    : authDatabaseAdapter,
  user: {
    modelName: "authUsers"
  },
  session: {
    modelName: "authSessions",
    additionalFields: {
      tokenHash: {
        type: "string",
        required: false,
        input: false,
        returned: false
      }
    }
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
