import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyRequest } from "fastify";

import type { RequireUrlAccessTokenForRequest } from "../url-access-token-request-access.service.js";

const streamerChatModerationActions = ["hide", "ban", "warn", "allow", "provider_action", "retract_rule", "view_rules", "view_audit", "emergency_clear"] as const;
export type StreamerChatModerationAction = typeof streamerChatModerationActions[number];

type StreamerChatModerationAccess =
  | {
    ok: true;
    permissions: string[];
  }
  | {
    ok: false;
    reason: string;
    statusCode: 401 | 403;
  };

const parseJsonArray = (value: unknown): unknown[] => {
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

const normalizeStreamerChatModerationPermissions = (rolePermissionValues: readonly unknown[]): string[] => {
  const permissions = new Set<string>();

  for (const rolePermissionValue of rolePermissionValues) {
    for (const permission of parseJsonArray(rolePermissionValue)) {
      if (typeof permission === "string") {
        permissions.add(permission);
      }
    }
  }

  return [...permissions];
};

export const canUseStreamerChatModerationAction = (
  permissions: readonly string[],
  action: StreamerChatModerationAction
): boolean => {
  if (permissions.includes("*")) {
    return true;
  }

  switch (action) {
    case "hide":
      return permissions.includes("chat:hide-message");
    case "ban":
      return permissions.includes("chat:ban-user-local");
    case "warn":
      return permissions.includes("chat:warn-user");
    case "allow":
      return permissions.includes("chat:allow-message");
    case "provider_action":
      return permissions.includes("chat:provider-moderate");
    case "retract_rule":
      return permissions.includes("chat:hide-message")
        || permissions.includes("chat:ban-user-local")
        || permissions.includes("chat:warn-user")
        || permissions.includes("chat:allow-message");
    case "view_rules":
      return permissions.includes("moderation-rules:view");
    case "view_audit":
      return permissions.includes("moderation-rules:view");
    case "emergency_clear":
      return permissions.includes("chat:emergency-clear");
  }
};

export const canViewStreamerChatModerationWindow = (permissions: readonly string[]): boolean =>
  permissions.includes("*")
  || permissions.includes("chat:view")
  || permissions.includes("moderation-rules:view")
  || permissions.includes("moderators:manage");

export class StreamerChatModerationAccessService {
  public constructor(private readonly dependencies: {
    getDatabasePool: () => DatabasePool;
    requireUrlAccessTokenForRequest: RequireUrlAccessTokenForRequest;
  }) {}

  public async resolvePermissions(
    request: FastifyRequest,
    accessToken: string
  ): Promise<StreamerChatModerationAccess> {
    const tokenValidation = await this.dependencies.requireUrlAccessTokenForRequest(request, {
      deniedReason: "control_panel_access_denied",
      token: accessToken,
      surface: "control-panel",
      scope: "control:open",
      userUnlinkedReason: "streamer_chat_moderation_user_unlinked"
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

    const [roleRows] = await this.dependencies.getDatabasePool().execute(
      `
        SELECT roles.permissions
        FROM user_roles
        INNER JOIN roles ON roles.id = user_roles.role_id
        WHERE user_roles.user_id = ?
          AND user_roles.revoked_at IS NULL
          AND (user_roles.expires_at IS NULL OR user_roles.expires_at > NOW())
        ORDER BY roles.key
      `,
      [tokenValidation.user.id]
    );
    const permissions = normalizeStreamerChatModerationPermissions(
      Array.isArray(roleRows)
        ? roleRows.map((row) => (row as { permissions: unknown }).permissions)
        : []
    );

    if (!canViewStreamerChatModerationWindow(permissions)) {
      return {
        ok: false,
        statusCode: 403,
        reason: "streamer_chat_moderation_forbidden"
      };
    }

    return {
      ok: true,
      permissions
    };
  }

  public async requirePermission(
    request: FastifyRequest,
    accessToken: string,
    action: StreamerChatModerationAction
  ): Promise<StreamerChatModerationAccess> {
    const access = await this.resolvePermissions(request, accessToken);

    if (!access.ok) {
      return access;
    }

    if (!canUseStreamerChatModerationAction(access.permissions, action)) {
      return {
        ok: false,
        statusCode: 403,
        reason: "streamer_chat_moderation_forbidden"
      };
    }

    return access;
  }
}
