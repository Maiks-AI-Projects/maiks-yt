import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyRequest } from "fastify";

import type { RequireUrlAccessTokenForRequest } from "../url-access-token-request-access.service.js";

export type StreamerChatControlAccess =
  | {
    ok: true;
  }
  | {
    ok: false;
    reason: string;
    statusCode: 401 | 403;
  };

type StreamerChatControlAccessDependencies = {
  getDatabasePool: () => DatabasePool;
  requireUrlAccessTokenForRequest: RequireUrlAccessTokenForRequest;
};

const parsePermissionArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeStreamerChatControlPermissions = (rolePermissionValues: readonly unknown[]): string[] => {
  const permissions = new Set<string>();

  for (const rolePermissionValue of rolePermissionValues) {
    for (const permission of parsePermissionArray(rolePermissionValue)) {
      if (typeof permission === "string") {
        permissions.add(permission);
      }
    }
  }

  return [...permissions];
};

export const canViewPrivateStreamerChat = (permissions: readonly string[]): boolean =>
  permissions.includes("*") || permissions.includes("chat:view");

const loadActiveRolePermissionValues = async (
  pool: DatabasePool,
  userId: string
): Promise<unknown[]> => {
  const [roleRows] = await pool.execute(
    `
      SELECT roles.permissions
      FROM user_roles
      INNER JOIN roles ON roles.id = user_roles.role_id
      WHERE user_roles.user_id = ?
        AND user_roles.revoked_at IS NULL
        AND (user_roles.expires_at IS NULL OR user_roles.expires_at > NOW())
      ORDER BY roles.key
    `,
    [userId]
  );

  return Array.isArray(roleRows)
    ? roleRows.map((row) => (row as { permissions: unknown }).permissions)
    : [];
};

export const createRequireStreamerChatControlAccess = ({
  getDatabasePool,
  requireUrlAccessTokenForRequest
}: StreamerChatControlAccessDependencies) => async (
  request: FastifyRequest,
  accessToken: string
): Promise<StreamerChatControlAccess> => {
  const tokenValidation = await requireUrlAccessTokenForRequest(request, {
    deniedReason: "control_panel_access_denied",
    token: accessToken,
    surface: "control-panel",
    scope: "control:open",
    userUnlinkedReason: "control_panel_user_unlinked"
  });

  if (!tokenValidation.ok) {
    return {
      ok: false,
      statusCode: tokenValidation.statusCode,
      reason: tokenValidation.reason
    };
  }

  if (!tokenValidation.user) {
    return {
      ok: false,
      statusCode: 401,
      reason: "not_authenticated"
    };
  }

  const rolePermissionValues = await loadActiveRolePermissionValues(
    getDatabasePool(),
    tokenValidation.user.id
  );
  const permissions = normalizeStreamerChatControlPermissions(rolePermissionValues);

  if (!canViewPrivateStreamerChat(permissions)) {
    return {
      ok: false,
      statusCode: 403,
      reason: "streamer_chat_forbidden"
    };
  }

  return {
    ok: true
  };
};
