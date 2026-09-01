import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { registerAccountDevRoutes } from "./account-dev.route.js";
import { projectAccountDomain, projectAccountSession } from "./account-response-projection.service.js";
import type { AuthSessionSnapshot } from "./auth-session.types.js";
import { getDomainUserForAuthUser, parseJsonArray } from "./domain-identity.service.js";

const allowLoginRequestSchema = z.object({
  allowLogin: z.boolean()
});
const profileVisibilityRequestSchema = z.object({
  profileVisibility: z.enum(["private", "minimal", "public"])
});

type AuthAccountRow = {
  accountId: string;
  providerId: string;
};

type AuthAccountProviderRow = {
  providerId?: string | null;
};

type AccountDomainRouteDependencies = {
  configuredAuthProviderIds: readonly string[];
  getAuthSession: (request: FastifyRequest) => Promise<AuthSessionSnapshot>;
  getDatabasePool: () => DatabasePool;
};

const getProviderAccountLabel = (providerId: string): string => {
  const normalized = providerId.trim().toLowerCase();

  if (normalized.length === 0) {
    return "Sign-in account";
  }

  return `${normalized.slice(0, 1).toUpperCase()}${normalized.slice(1)} account`;
};

const projectLinkedAccountCount = async (
  pool: DatabasePool,
  userId: string | null
): Promise<number> => {
  if (!userId) {
    return 0;
  }

  const [rows] = await pool.execute(
    "SELECT COUNT(*) AS linkedAccountCount FROM linked_accounts WHERE user_id = ?",
    [userId]
  );
  const row = Array.isArray(rows)
    ? rows[0] as { linkedAccountCount?: number | string | null } | undefined
    : undefined;
  const count = Number(row?.linkedAccountCount ?? 0);

  return Number.isFinite(count) && count > 0 ? count : 0;
};

const projectAuthAccountProviders = (rows: readonly AuthAccountProviderRow[]): {
  ok: true;
  accounts: Array<{ providerId: string }>;
} => {
  const providerIds = new Set<string>();

  for (const row of rows) {
    const providerId = row.providerId?.trim();

    if (providerId) {
      providerIds.add(providerId);
    }
  }

  return {
    ok: true,
    accounts: [...providerIds].sort().map((providerId) => ({ providerId }))
  };
};

export const registerAccountDomainRoutes = (
  server: FastifyInstance,
  dependencies: AccountDomainRouteDependencies
): void => {
  const { configuredAuthProviderIds, getAuthSession, getDatabasePool } = dependencies;

  if (process.env.NODE_ENV !== "production") {
    registerAccountDevRoutes(server, dependencies);
  }

  server.get("/account/login/providers", async () => ({
    ok: true,
    configuredProviderIds: configuredAuthProviderIds
  }));

  server.get("/account/connections/providers", async (request, reply) => {
    const session = await getAuthSession(request);

    if (!session) {
      reply.code(401);
      return {
        ok: false,
        reason: "not_authenticated"
      };
    }

    return {
      ok: true,
      configuredProviderIds: configuredAuthProviderIds
    };
  });

  server.get("/account/session", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    return projectAccountSession(await getAuthSession(request));
  });

  server.get("/account/auth-accounts", async (request, reply) => {
    const session = await getAuthSession(request);

    if (!session) {
      reply.code(401);
      return {
        ok: false,
        reason: "not_authenticated"
      };
    }

    try {
      const pool = getDatabasePool();
      const [authAccountRows] = await pool.execute(
        "SELECT provider_id AS providerId FROM auth_accounts WHERE user_id = ? ORDER BY provider_id, created_at",
        [session.user.id]
      );
      const authAccounts = Array.isArray(authAccountRows)
        ? authAccountRows as AuthAccountProviderRow[]
        : [];

      return projectAuthAccountProviders(authAccounts);
    } catch (error) {
      server.log.warn({ err: error }, "Auth account list failed.");
      reply.code(503);

      return {
        ok: false,
        reason: "auth_account_list_unavailable"
      };
    }
  });

  server.get("/account/domain", async (request, reply) => {
    const session = await getAuthSession(request);

    if (!session) {
      reply.code(401);
      return {
        ok: false,
        reason: "not_authenticated"
      };
    }

    try {
      const pool = getDatabasePool();
      const { user } = await getDomainUserForAuthUser(pool, session.user, false);

      return projectAccountDomain({
        linkedAccountCount: await projectLinkedAccountCount(pool, user?.id ?? null),
        needsSync: !user,
        user
      });
    } catch (error) {
      server.log.warn({ err: error }, "Domain account snapshot failed.");
      reply.code(503);

      return {
        ok: false,
        reason: "domain_account_unavailable"
      };
    }
  });

  server.post("/account/domain/sync", async (request, reply) => {
    const session = await getAuthSession(request);

    if (!session) {
      reply.code(401);
      return {
        ok: false,
        reason: "not_authenticated"
      };
    }

    try {
      const pool = getDatabasePool();
      const { user } = await getDomainUserForAuthUser(pool, session.user, true);

      if (!user) {
        reply.code(500);
        return {
          ok: false,
          reason: "domain_user_not_created"
        };
      }

      const [authAccountRows] = await pool.execute(
        "SELECT account_id AS accountId, provider_id AS providerId FROM auth_accounts WHERE user_id = ? ORDER BY provider_id, created_at",
        [session.user.id]
      );
      const authAccounts = Array.isArray(authAccountRows)
        ? authAccountRows as AuthAccountRow[]
        : [];
      for (const authAccount of authAccounts) {
        const [existingRows] = await pool.execute(
          "SELECT id FROM linked_accounts WHERE provider = ? AND provider_account_id = ? LIMIT 1",
          [authAccount.providerId, authAccount.accountId]
        );
        const existing = Array.isArray(existingRows) ? existingRows[0] : undefined;

        if (existing) {
          continue;
        }

        await pool.execute(
          "INSERT INTO linked_accounts (id, user_id, provider, provider_account_id, display_name, purpose_label, allow_login, capabilities, verified_at) VALUES (?, ?, ?, ?, ?, 'Login account', true, ?, NOW())",
          [
            randomUUID(),
            user.id,
            authAccount.providerId,
            authAccount.accountId,
            getProviderAccountLabel(authAccount.providerId),
            JSON.stringify(["login"])
          ]
        );
      }

      return projectAccountDomain({
        linkedAccountCount: await projectLinkedAccountCount(pool, user.id),
        needsSync: false,
        user
      });
    } catch (error) {
      server.log.warn({ err: error }, "Domain account sync failed.");
      reply.code(503);

      return {
        ok: false,
        reason: "domain_account_sync_unavailable"
      };
    }
  });

  server.post<{ Params: { linkedAccountId: string } }>("/account/domain/linked-accounts/:linkedAccountId/allow-login", async (request, reply) => {
    const session = await getAuthSession(request);

    if (!session) {
      reply.code(401);
      return {
        ok: false,
        reason: "not_authenticated"
      };
    }

    const parsedRequest = allowLoginRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    try {
      const pool = getDatabasePool();
      const { user } = await getDomainUserForAuthUser(pool, session.user, false);

      if (!user) {
        reply.code(404);
        return {
          ok: false,
          reason: "domain_user_not_found"
        };
      }

      const [linkedAccountRows] = await pool.execute(
        "SELECT id, capabilities, allow_login AS allowLogin FROM linked_accounts WHERE id = ? AND user_id = ? LIMIT 1",
        [request.params.linkedAccountId, user.id]
      );
      const linkedAccount = Array.isArray(linkedAccountRows)
        ? linkedAccountRows[0] as { id: string; capabilities: unknown; allowLogin: number | boolean } | undefined
        : undefined;

      if (!linkedAccount) {
        reply.code(404);
        return {
          ok: false,
          reason: "linked_account_not_found"
        };
      }

      const capabilities = parseJsonArray(linkedAccount.capabilities);
      const isLoginCapable = capabilities.includes("login");

      if (!parsedRequest.data.allowLogin && isLoginCapable && Boolean(linkedAccount.allowLogin)) {
        const [loginAccountRows] = await pool.execute(
          "SELECT id FROM linked_accounts WHERE user_id = ? AND allow_login = true AND JSON_CONTAINS(capabilities, JSON_QUOTE('login')) AND id <> ? LIMIT 1",
          [user.id, linkedAccount.id]
        );
        const hasOtherAllowedLoginAccount = Array.isArray(loginAccountRows) && loginAccountRows.length > 0;

        if (!hasOtherAllowedLoginAccount) {
          reply.code(409);
          return {
            ok: false,
            reason: "cannot_disable_last_login_account"
          };
        }
      }

      await pool.execute(
        "UPDATE linked_accounts SET allow_login = ?, updated_at = NOW() WHERE id = ? AND user_id = ?",
        [parsedRequest.data.allowLogin, linkedAccount.id, user.id]
      );

      return projectAccountDomain({
        linkedAccountCount: await projectLinkedAccountCount(pool, user.id),
        needsSync: false,
        user
      });
    } catch (error) {
      server.log.warn({ err: error }, "Allow-login update failed.");
      reply.code(503);

      return {
        ok: false,
        reason: "allow_login_update_unavailable"
      };
    }
  });

  server.post("/account/domain/profile-visibility", async (request, reply) => {
    const session = await getAuthSession(request);

    if (!session) {
      reply.code(401);
      return {
        ok: false,
        reason: "not_authenticated"
      };
    }

    const parsedRequest = profileVisibilityRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    try {
      const pool = getDatabasePool();
      const { user } = await getDomainUserForAuthUser(pool, session.user, true);

      if (!user) {
        reply.code(500);
        return {
          ok: false,
          reason: "domain_user_not_created"
        };
      }

      await pool.execute(
        "UPDATE users SET profile_visibility = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL",
        [parsedRequest.data.profileVisibility, user.id]
      );

      return projectAccountDomain({
        linkedAccountCount: await projectLinkedAccountCount(pool, user.id),
        needsSync: false,
        user: {
          ...user,
          profileVisibility: parsedRequest.data.profileVisibility
        }
      });
    } catch (error) {
      server.log.warn({ err: error }, "Profile visibility update failed.");
      reply.code(503);

      return {
        ok: false,
        reason: "profile_visibility_update_unavailable"
      };
    }
  });
};
