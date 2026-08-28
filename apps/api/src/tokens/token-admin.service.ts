import { createHash, randomBytes } from "node:crypto";

import {
  buildUrlAccessTokenLaunchUrl,
  canManageUrlAccessTokens,
  getUrlAccessTokenAdminTargetDefinition,
  isValidUrlAccessTokenLabel,
  normalizeUrlAccessTokenLabel,
  resolveUrlAccessTokenAdminLaunchEnvironment
} from "@maiks-yt/domain/security";
import type { UrlAccessTokenAdminTarget } from "@maiks-yt/domain/security";

import type {
  UrlAccessTokenAdminCreatedToken,
  UrlAccessTokenAdminListResult,
  UrlAccessTokenAdminMutationResult,
  UrlAccessTokenAdminRepository,
  UrlAccessTokenAdminRuntimeOptions,
  UrlAccessTokenAdminRevokeResult
} from "./token-admin.types.js";

const hashToken = (token: string): string =>
  createHash("sha256").update(token, "utf8").digest("hex");

const generateRawToken = (): string => randomBytes(32).toString("base64url");

const isExpiredUrlAccessToken = (expiresAt: string | null, now: Date): boolean => {
  if (!expiresAt) {
    return false;
  }

  const expiresAtTime = Date.parse(expiresAt);

  return Number.isNaN(expiresAtTime) || expiresAtTime <= now.getTime();
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
  token: Omit<UrlAccessTokenAdminCreatedToken, "rawToken" | "launchUrl">,
  rawToken: string,
  options: UrlAccessTokenAdminRuntimeOptions
): UrlAccessTokenAdminCreatedToken => {
  if (!token.target) {
    throw new Error("url_token_admin_missing_supported_target");
  }

  return {
    ...token,
    rawToken,
    launchUrl: buildUrlAccessTokenLaunchUrl({
      environment: options.launchEnvironment,
      target: token.target,
      token: rawToken
    })
  };
};

export class UrlAccessTokenAdminService {
  private readonly options: UrlAccessTokenAdminRuntimeOptions;

  public constructor(
    private readonly repository: UrlAccessTokenAdminRepository,
    options?: Partial<UrlAccessTokenAdminRuntimeOptions>
  ) {
    this.options = {
      launchEnvironment: options?.launchEnvironment
        ?? resolveUrlAccessTokenAdminLaunchEnvironment({
          nodeEnvironment: process.env.NODE_ENV,
          publicApiBaseUrl: process.env.API_PUBLIC_BASE_URL
        })
    };
  }

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
      token: withRawToken(token, rawToken, this.options)
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

    if (existing.revokedAt) {
      return {
        ok: false,
        reason: "url_token_revoked"
      };
    }

    if (isExpiredUrlAccessToken(existing.expiresAt, new Date())) {
      return {
        ok: false,
        reason: "url_token_expired"
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

    if (rotatedToken === "terminal") {
      return {
        ok: false,
        reason: "url_token_terminal"
      };
    }

    return {
      ok: true,
      token: withRawToken(rotatedToken, rawToken, this.options)
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
