import { createHash, randomBytes } from "node:crypto";

import {
  buildUrlAccessTokenDevUrl,
  canManageUrlAccessTokens,
  getUrlAccessTokenAdminTargetDefinition,
  isValidUrlAccessTokenLabel,
  normalizeUrlAccessTokenLabel
} from "@maiks-yt/domain/security";
import type { UrlAccessTokenAdminTarget } from "@maiks-yt/domain/security";

import type {
  UrlAccessTokenAdminCreatedToken,
  UrlAccessTokenAdminListResult,
  UrlAccessTokenAdminMutationResult,
  UrlAccessTokenAdminRepository,
  UrlAccessTokenAdminRevokeResult
} from "./token-admin.types.js";

const hashToken = (token: string): string =>
  createHash("sha256").update(token, "utf8").digest("hex");

const generateRawToken = (): string => randomBytes(32).toString("base64url");

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

export const normalizeUrlAccessTokenAdminPermissions = (
  rolePermissionValues: readonly unknown[]
): string[] => {
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

const withRawToken = (
  token: Omit<UrlAccessTokenAdminCreatedToken, "rawToken" | "devUrl">,
  rawToken: string
): UrlAccessTokenAdminCreatedToken => {
  if (!token.target) {
    throw new Error("url_token_admin_missing_supported_target");
  }

  return {
    ...token,
    rawToken,
    devUrl: buildUrlAccessTokenDevUrl({
      target: token.target,
      token: rawToken
    })
  };
};

export class UrlAccessTokenAdminService {
  public constructor(private readonly repository: UrlAccessTokenAdminRepository) {}

  public async listTokens(input: { authUserId: string }): Promise<UrlAccessTokenAdminListResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    return {
      ok: true,
      tokens: await this.repository.listTokens()
    };
  }

  public async createToken(input: {
    authUserId: string;
    target: UrlAccessTokenAdminTarget;
    label: string;
  }): Promise<UrlAccessTokenAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const label = normalizeUrlAccessTokenLabel(input.label);

    if (!isValidUrlAccessTokenLabel(label)) {
      return {
        ok: false,
        reason: "url_token_admin_invalid_input"
      };
    }

    const definition = getUrlAccessTokenAdminTargetDefinition(input.target);
    const rawToken = generateRawToken();
    const token = await this.repository.createToken({
      label,
      tokenHash: hashToken(rawToken),
      surface: definition.surface,
      scopes: [definition.scope],
      requiresLogin: definition.requiresLogin
    });

    return {
      ok: true,
      token: withRawToken(token, rawToken)
    };
  }

  public async rotateToken(input: {
    authUserId: string;
    id: string;
  }): Promise<UrlAccessTokenAdminMutationResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const existing = await this.repository.getToken(input.id);

    if (!existing) {
      return {
        ok: false,
        reason: "url_token_not_found"
      };
    }

    if (!existing.target) {
      return {
        ok: false,
        reason: "url_token_unsupported_target"
      };
    }

    const rawToken = generateRawToken();
    const rotatedToken = await this.repository.rotateToken(input.id, hashToken(rawToken));

    if (rotatedToken === "not-found") {
      return {
        ok: false,
        reason: "url_token_not_found"
      };
    }

    return {
      ok: true,
      token: withRawToken(rotatedToken, rawToken)
    };
  }

  public async revokeToken(input: {
    authUserId: string;
    id: string;
  }): Promise<UrlAccessTokenAdminRevokeResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const revokedToken = await this.repository.revokeToken(input.id);

    return revokedToken === "not-found"
      ? {
        ok: false,
        reason: "url_token_not_found"
      }
      : {
        ok: true,
        token: revokedToken
      };
  }

  private async requireActor(authUserId: string): Promise<{
    ok: true;
    domainUserId: string;
  } | {
    ok: false;
    reason: "url_token_admin_user_unlinked" | "url_token_admin_forbidden";
  }> {
    const actor = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "url_token_admin_user_unlinked"
      };
    }

    if (!canManageUrlAccessTokens(normalizeUrlAccessTokenAdminPermissions(actor.rolePermissionValues))) {
      return {
        ok: false,
        reason: "url_token_admin_forbidden"
      };
    }

    return {
      ok: true,
      domainUserId: actor.domainUserId
    };
  }
}
