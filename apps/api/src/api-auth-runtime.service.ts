import type { DatabasePool } from "@maiks-yt/database";
import { canUseUrlAccessToken, type UrlAccessSurface } from "@maiks-yt/domain/security";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyRequest } from "fastify";

import { parseJsonArray, type AuthSessionSnapshot } from "./account/index.js";
import { auth } from "./auth/better-auth.service.js";
import { hashToken } from "./security/token-hash.service.js";

type DevAuthTokenRow = {
  tokenId: string;
  userId: string;
  name: string;
  email: string;
  image?: string | null;
};

export { hashToken };

const getRequestOrigin = (request: FastifyRequest): string => {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;

  return `${protocol ?? "http"}://${request.headers.host}`;
};

const getBearerToken = (request: FastifyRequest): string | null => {
  const authorization = request.headers.authorization;
  const authorizationValue = Array.isArray(authorization) ? authorization[0] : authorization;

  if (!authorizationValue?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationValue.slice("Bearer ".length).trim() || null;
};

export const createApiAuthRuntime = ({
  getDatabasePool,
  handleAuthRequest = (request) => auth.handler(request)
}: {
  getDatabasePool: () => DatabasePool;
  handleAuthRequest?: (request: Request) => Promise<Response>;
}): {
  getAuthSession: (request: FastifyRequest) => Promise<AuthSessionSnapshot>;
  validateUrlAccessTokenForRequest: (input: {
    scope: string;
    surface: UrlAccessSurface;
    token: string;
  }) => Promise<{ valid: boolean; requiresLogin: boolean; reason?: string }>;
} => {
  const getDevAuthSession = async (request: FastifyRequest): Promise<AuthSessionSnapshot> => {
    if (process.env.NODE_ENV === "production") {
      return null;
    }

    const token = getBearerToken(request);

    if (!token) {
      return null;
    }

    const tokenHash = hashToken(token);
    const pool = getDatabasePool();
    const [tokenRows] = await pool.execute(
      "SELECT dev_auth_tokens.id AS tokenId, auth_users.id AS userId, auth_users.name, auth_users.email, auth_users.image FROM dev_auth_tokens INNER JOIN auth_users ON auth_users.id = dev_auth_tokens.auth_user_id WHERE dev_auth_tokens.token_hash = ? AND dev_auth_tokens.revoked_at IS NULL AND dev_auth_tokens.expires_at > NOW() LIMIT 1",
      [tokenHash]
    );
    const tokenRow = Array.isArray(tokenRows)
      ? tokenRows[0] as DevAuthTokenRow | undefined
      : undefined;

    if (!tokenRow) {
      return null;
    }

    await pool.execute("UPDATE dev_auth_tokens SET last_used_at = NOW() WHERE id = ?", [tokenRow.tokenId]);

    return {
      user: {
        id: tokenRow.userId,
        name: tokenRow.name,
        email: tokenRow.email,
        image: tokenRow.image ?? null
      },
      session: {
        id: `dev-token:${tokenRow.tokenId}`,
        userId: tokenRow.userId
      }
    };
  };

  const getAuthSession = async (request: FastifyRequest): Promise<AuthSessionSnapshot> => {
    const sessionRequest = new Request(new URL("/auth/get-session", getRequestOrigin(request)), {
      method: "GET",
      headers: fromNodeHeaders(request.headers)
    });
    const sessionResponse = await handleAuthRequest(sessionRequest);

    if (!sessionResponse.ok) {
      throw new Error(`Auth session lookup failed with ${sessionResponse.status}.`);
    }

    const session = await sessionResponse.json() as AuthSessionSnapshot;

    if (session) {
      return session;
    }

    return await getDevAuthSession(request);
  };

  const validateUrlAccessTokenForRequest = async ({
    scope,
    surface,
    token
  }: {
    scope: string;
    surface: UrlAccessSurface;
    token: string;
  }): Promise<{ valid: boolean; requiresLogin: boolean; reason?: string }> => {
    const pool = getDatabasePool();
    const tokenHash = hashToken(token);
    const [tokenRows] = await pool.execute(
      "SELECT id, surface, scopes, requires_login AS requiresLogin, expires_at AS expiresAt, revoked_at AS revokedAt FROM url_access_tokens WHERE token_hash = ? LIMIT 1",
      [tokenHash]
    );
    const row = Array.isArray(tokenRows)
      ? tokenRows[0] as {
        id: string;
        surface: UrlAccessSurface;
        scopes: unknown;
        requiresLogin: number | boolean;
        expiresAt?: Date | null;
        revokedAt?: Date | null;
      } | undefined
      : undefined;

    if (!row) {
      return {
        valid: false,
        requiresLogin: false,
        reason: "token_not_found"
      };
    }

    const tokenRecord = {
      id: row.id,
      surface: row.surface,
      scopes: parseJsonArray(row.scopes).filter((tokenScope): tokenScope is string => typeof tokenScope === "string"),
      requiresLogin: Boolean(row.requiresLogin)
    };
    const valid = canUseUrlAccessToken({
      ...tokenRecord,
      ...(row.expiresAt ? { expiresAt: row.expiresAt } : {}),
      ...(row.revokedAt ? { revokedAt: row.revokedAt } : {})
    }, {
      surface,
      scope,
      now: new Date()
    });

    if (valid) {
      await pool.execute("UPDATE url_access_tokens SET last_used_at = NOW() WHERE id = ?", [row.id]);
    }

    return {
      valid,
      requiresLogin: Boolean(row.requiresLogin),
      ...(valid ? {} : { reason: "token_not_valid_for_scope" })
    };
  };

  return {
    getAuthSession,
    validateUrlAccessTokenForRequest
  };
};
