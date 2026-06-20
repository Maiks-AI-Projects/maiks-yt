export type UrlAccessSurface = "overlay" | "control-panel" | "admin" | "api";

export type UrlAccessTokenScope = "overlay:connect" | "control:open";

export type UrlAccessTokenAdminTarget = "overlay" | "control-panel";

export type UrlAccessTokenRecord = {
  id: string;
  surface: UrlAccessSurface;
  scopes: readonly string[];
  requiresLogin: boolean;
  expiresAt?: Date;
  revokedAt?: Date;
};

export type UrlAccessTokenUse = {
  surface: UrlAccessSurface;
  scope: string;
  now: Date;
};

export type UrlAccessTokenAdminTargetDefinition = {
  target: UrlAccessTokenAdminTarget;
  label: string;
  surface: UrlAccessSurface;
  scope: UrlAccessTokenScope;
  requiresLogin: boolean;
  devBaseUrl: string;
};
