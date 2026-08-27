import type { DatabasePool } from "@maiks-yt/database";
import type { UrlAccessSurface } from "@maiks-yt/domain/security";
import type { FastifyRequest } from "fastify";

import {
  getDomainUserForAuthUser,
  type AuthSessionSnapshot,
  type DomainUserRow
} from "./account/index.js";

export type UrlAccessTokenValidation = {
  valid: boolean;
  requiresLogin: boolean;
  reason?: string;
};

export type RequireUrlAccessTokenForRequest = (
  request: FastifyRequest,
  input: {
    deniedReason: string;
    scope: string;
    surface: UrlAccessSurface;
    token: string;
    userUnlinkedReason?: string;
  }
) => Promise<
  | {
    ok: true;
    requiresLogin: boolean;
    session: AuthSessionSnapshot;
    user: DomainUserRow | null;
  }
  | {
    ok: false;
    reason: string;
    statusCode: 401 | 403;
  }
>;

export const createRequireUrlAccessTokenForRequest = ({
  getAuthSession,
  getDatabasePool,
  validateUrlAccessToken
}: {
  getAuthSession: (request: FastifyRequest) => Promise<AuthSessionSnapshot>;
  getDatabasePool: () => DatabasePool;
  validateUrlAccessToken: (input: {
    scope: string;
    surface: UrlAccessSurface;
    token: string;
  }) => Promise<UrlAccessTokenValidation>;
}): RequireUrlAccessTokenForRequest => async (request, input) => {
  const tokenValidation = await validateUrlAccessToken({
    token: input.token,
    surface: input.surface,
    scope: input.scope
  });

  if (!tokenValidation.valid) {
    return {
      ok: false,
      statusCode: 403,
      reason: tokenValidation.reason ?? input.deniedReason
    };
  }

  if (!tokenValidation.requiresLogin) {
    return {
      ok: true,
      requiresLogin: false,
      session: null,
      user: null
    };
  }

  const session = await getAuthSession(request);

  if (!session) {
    return {
      ok: false,
      statusCode: 401,
      reason: "not_authenticated"
    };
  }

  const { user } = await getDomainUserForAuthUser(getDatabasePool(), session.user, false);

  if (!user) {
    return {
      ok: false,
      statusCode: 403,
      reason: input.userUnlinkedReason ?? "url_token_user_unlinked"
    };
  }

  return {
    ok: true,
    requiresLogin: true,
    session,
    user
  };
};
