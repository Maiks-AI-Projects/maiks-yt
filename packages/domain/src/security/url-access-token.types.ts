export type UrlAccessSurface = "overlay" | "control-panel" | "admin" | "api";

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
