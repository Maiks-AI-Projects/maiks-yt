import type {
  UrlAccessSurface,
  UrlAccessTokenAdminTarget,
  UrlAccessTokenScope
} from "@maiks-yt/domain/security";

export type UrlAccessTokenAdminActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type UrlAccessTokenAdminListItem = {
  id: string;
  label: string;
  target: UrlAccessTokenAdminTarget | null;
  surface: UrlAccessSurface;
  scopes: readonly string[];
  requiresLogin: boolean;
  devBaseUrl: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UrlAccessTokenAdminCreatedToken = UrlAccessTokenAdminListItem & {
  rawToken: string;
  devUrl: string;
};

export type UrlAccessTokenAdminCreateInput = {
  target: UrlAccessTokenAdminTarget;
  label: string;
};

export type UrlAccessTokenAdminInsertInput = {
  label: string;
  tokenHash: string;
  surface: UrlAccessSurface;
  scopes: readonly UrlAccessTokenScope[];
  requiresLogin: boolean;
};

export type UrlAccessTokenAdminListResult =
  | {
    ok: true;
    tokens: readonly UrlAccessTokenAdminListItem[];
  }
  | {
    ok: false;
    reason: "url_token_admin_user_unlinked" | "url_token_admin_forbidden";
  };

export type UrlAccessTokenAdminMutationResult =
  | {
    ok: true;
    token: UrlAccessTokenAdminCreatedToken;
  }
  | {
    ok: false;
    reason:
      | "url_token_admin_user_unlinked"
      | "url_token_admin_forbidden"
      | "url_token_admin_invalid_input"
      | "url_token_not_found"
      | "url_token_unsupported_target";
  };

export type UrlAccessTokenAdminRevokeResult =
  | {
    ok: true;
    token: UrlAccessTokenAdminListItem;
  }
  | {
    ok: false;
    reason:
      | "url_token_admin_user_unlinked"
      | "url_token_admin_forbidden"
      | "url_token_not_found";
  };

export interface UrlAccessTokenAdminRepository {
  resolveActor(authUserId: string): Promise<UrlAccessTokenAdminActor | null>;
  listTokens(): Promise<readonly UrlAccessTokenAdminListItem[]>;
  getToken(id: string): Promise<UrlAccessTokenAdminListItem | null>;
  createToken(input: UrlAccessTokenAdminInsertInput): Promise<UrlAccessTokenAdminListItem>;
  rotateToken(id: string, tokenHash: string): Promise<UrlAccessTokenAdminListItem | "not-found">;
  revokeToken(id: string): Promise<UrlAccessTokenAdminListItem | "not-found">;
}
