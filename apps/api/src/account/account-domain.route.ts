import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import type { AuthSessionSnapshot } from "./auth-session.types.js";
import { getDomainLinkedAccounts, getDomainUserForAuthUser, parseJsonArray } from "./domain-identity.service.js";

const allowLoginRequestSchema = z.object({
  allowLogin: z.boolean()
});
const profileVisibilityRequestSchema = z.object({
  profileVisibility: z.enum(["private", "minimal", "public"])
});
const devOwnerClaimRequestSchema = z.object({
  confirm: z.literal("claim-dev-owner")
});

type AuthAccountRow = {
  id: string;
  userId: string;
  accountId: string;
  providerId: string;
  scope?: string | null;
  createdAt?: Date | null;
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

const getDevOwnerEmailAllowlist = (): Set<string> =>
  new Set((process.env.DEV_OWNER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0));

const isDevOwnerClaimAllowed = (session: NonNullable<AuthSessionSnapshot>): boolean => {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const email = session.user.email?.trim().toLowerCase();

  return Boolean(email && getDevOwnerEmailAllowlist().has(email));
};

export const registerAccountDomainRoutes = (
  server: FastifyInstance,
  dependencies: AccountDomainRouteDependencies
): void => {
  const { configuredAuthProviderIds, getAuthSession, getDatabasePool } = dependencies;

  server.get("/identity/dev/creator", async (_request, reply) => {
    try {
      const pool = getDatabasePool();
      const creatorUserId = "00000000-0000-4000-8000-000000000001";
      const [userRows] = await pool.execute(
        "SELECT id, display_name AS displayName, profile_visibility AS profileVisibility, avatar_url AS avatarUrl FROM users WHERE id = ? AND deleted_at IS NULL",
        [creatorUserId]
      );
      const user = Array.isArray(userRows)
        ? userRows[0] as { id: string; displayName: string; profileVisibility: string; avatarUrl?: string | null } | undefined
        : undefined;

      if (!user) {
        reply.code(404);
        return {
          ok: false,
          reason: "creator_not_seeded"
        };
      }

      const [linkedAccountRows] = await pool.execute(
        "SELECT id, provider, display_name AS displayName, allow_login AS allowLogin, capabilities FROM linked_accounts WHERE user_id = ? ORDER BY provider",
        [creatorUserId]
      );
      const [roleRows] = await pool.execute(
        "SELECT roles.key, roles.name, roles.permissions FROM user_roles INNER JOIN roles ON roles.id = user_roles.role_id WHERE user_roles.user_id = ? ORDER BY roles.key",
        [creatorUserId]
      );

      return {
        ok: true,
        user,
        linkedAccounts: Array.isArray(linkedAccountRows)
          ? linkedAccountRows.map((account) => {
            const typedAccount = account as { id: string; provider: string; displayName: string; allowLogin: number | boolean; capabilities: unknown };

            return {
              id: typedAccount.id,
              provider: typedAccount.provider,
              displayName: typedAccount.displayName,
              allowLogin: Boolean(typedAccount.allowLogin),
              capabilities: parseJsonArray(typedAccount.capabilities)
            };
          })
          : [],
        roles: Array.isArray(roleRows)
          ? roleRows.map((role) => {
            const typedRole = role as { key: string; name: string; permissions: unknown };

            return {
              key: typedRole.key,
              name: typedRole.name,
              permissions: parseJsonArray(typedRole.permissions)
            };
          })
          : []
      };
    } catch (error) {
      server.log.warn({ err: error }, "Dev identity snapshot failed.");
      reply.code(503);

      return {
        ok: false,
        reason: "identity_unavailable"
      };
    }
  });

  server.post("/identity/dev/claim-owner", async (request, reply) => {
    const session = await getAuthSession(request);

    if (!session) {
      reply.code(401);
      return {
        ok: false,
        reason: "not_authenticated"
      };
    }

    if (!isDevOwnerClaimAllowed(session)) {
      reply.code(403);
      return {
        ok: false,
        reason: "dev_owner_email_not_allowed"
      };
    }

    const parsedRequest = devOwnerClaimRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_owner_claim_request"
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

      const [ownerRoleRows] = await pool.execute(
        "SELECT id FROM roles WHERE `key` = 'owner' LIMIT 1"
      );
      const ownerRole = Array.isArray(ownerRoleRows)
        ? ownerRoleRows[0] as { id: string } | undefined
        : undefined;

      if (!ownerRole) {
        reply.code(404);
        return {
          ok: false,
          reason: "owner_role_not_seeded"
        };
      }

      await pool.execute(
        "INSERT IGNORE INTO user_roles (id, user_id, role_id) VALUES (?, ?, ?)",
        [randomUUID(), user.id, ownerRole.id]
      );

      return {
        ok: true,
        domainUser: user,
        role: "owner"
      };
    } catch (error) {
      server.log.warn({ err: error }, "Dev owner claim failed.");
      reply.code(503);

      return {
        ok: false,
        reason: "dev_owner_claim_unavailable"
      };
    }
  });

  server.get("/auth/dev/status", async () => ({
    ok: true,
    authProvider: "better-auth",
    configuredProviders: configuredAuthProviderIds,
    domainIdentityModel: "maiks-linked-accounts"
  }));

  server.get("/account/session", async (request) => {
    return await getAuthSession(request);
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
        "SELECT id, user_id AS userId, account_id AS accountId, provider_id AS providerId, scope, created_at AS createdAt, updated_at AS updatedAt FROM auth_accounts WHERE user_id = ? ORDER BY provider_id, created_at",
        [session.user.id]
      );
      const authAccounts = Array.isArray(authAccountRows)
        ? authAccountRows as Array<AuthAccountRow & { updatedAt?: Date | null }>
        : [];

      return authAccounts.map((account) => ({
        id: account.id,
        userId: account.userId,
        accountId: account.accountId,
        providerId: account.providerId,
        scopes: account.scope?.split(" ").filter((scope) => scope.length > 0) ?? [],
        createdAt: account.createdAt ?? null,
        updatedAt: account.updatedAt ?? null
      }));
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

      return {
        ok: true,
        authUserId: session.user.id,
        domainUser: user,
        linkedAccounts: user ? await getDomainLinkedAccounts(pool, user.id) : [],
        needsSync: !user
      };
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
      const { user, created: createdDomainUser } = await getDomainUserForAuthUser(pool, session.user, true);

      if (!user) {
        reply.code(500);
        return {
          ok: false,
          reason: "domain_user_not_created"
        };
      }

      const [authAccountRows] = await pool.execute(
        "SELECT id, user_id AS userId, account_id AS accountId, provider_id AS providerId, scope, created_at AS createdAt FROM auth_accounts WHERE user_id = ? ORDER BY provider_id, created_at",
        [session.user.id]
      );
      const authAccounts = Array.isArray(authAccountRows)
        ? authAccountRows as AuthAccountRow[]
        : [];
      let createdLinkedAccounts = 0;

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
        createdLinkedAccounts += 1;
      }

      return {
        ok: true,
        createdDomainUser,
        createdLinkedAccounts,
        domainUser: user,
        linkedAccounts: await getDomainLinkedAccounts(pool, user.id)
      };
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

      return {
        ok: true,
        domainUser: user,
        linkedAccounts: await getDomainLinkedAccounts(pool, user.id)
      };
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

      return {
        ok: true,
        domainUser: {
          ...user,
          profileVisibility: parsedRequest.data.profileVisibility
        },
        linkedAccounts: await getDomainLinkedAccounts(pool, user.id)
      };
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
