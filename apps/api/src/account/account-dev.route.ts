import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import type { AuthSessionSnapshot } from "./auth-session.types.js";
import { getDomainUserForAuthUser, parseJsonArray } from "./domain-identity.service.js";

const devOwnerClaimRequestSchema = z.object({
  confirm: z.literal("claim-dev-owner")
});

type AccountDevRouteDependencies = {
  configuredAuthProviderIds: readonly string[];
  getAuthSession: (request: FastifyRequest) => Promise<AuthSessionSnapshot>;
  getDatabasePool: () => DatabasePool;
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

export const registerAccountDevRoutes = (
  server: FastifyInstance,
  dependencies: AccountDevRouteDependencies
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
};
