import type { UrlAccessTokenRecord, UrlAccessTokenUse } from "./url-access-token.types.js";

export function canUseUrlAccessToken(record: UrlAccessTokenRecord, use: UrlAccessTokenUse): boolean {
  if (record.revokedAt) {
    return false;
  }

  if (record.expiresAt && record.expiresAt <= use.now) {
    return false;
  }

  if (record.surface !== use.surface) {
    return false;
  }

  return record.scopes.includes(use.scope) || record.scopes.includes("*");
}
