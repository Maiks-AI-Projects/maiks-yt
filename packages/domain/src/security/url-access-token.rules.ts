import type {
  UrlAccessTokenAdminTarget,
  UrlAccessTokenAdminTargetDefinition,
  UrlAccessTokenRecord,
  UrlAccessTokenUse
} from "./url-access-token.types.js";

export const urlAccessTokenAdminTargets = [
  {
    target: "overlay",
    label: "OBS Overlay",
    surface: "overlay",
    scope: "overlay:connect",
    requiresLogin: false,
    devBaseUrl: "https://overlay-dev.maiks.yt/"
  },
  {
    target: "control-panel",
    label: "Control Panel",
    surface: "control-panel",
    scope: "control:open",
    requiresLogin: true,
    devBaseUrl: "https://control-dev.maiks.yt/"
  }
] as const satisfies readonly UrlAccessTokenAdminTargetDefinition[];

export function getUrlAccessTokenAdminTargetDefinition(
  target: UrlAccessTokenAdminTarget
): UrlAccessTokenAdminTargetDefinition {
  return urlAccessTokenAdminTargets.find((definition) => definition.target === target)!;
}

export function getUrlAccessTokenAdminTargetForRecord(
  record: Pick<UrlAccessTokenRecord, "surface" | "scopes">
): UrlAccessTokenAdminTarget | null {
  for (const definition of urlAccessTokenAdminTargets) {
    if (record.surface === definition.surface && record.scopes.includes(definition.scope)) {
      return definition.target;
    }
  }

  return null;
}

export function buildUrlAccessTokenDevUrl(input: {
  target: UrlAccessTokenAdminTarget;
  token: string;
}): string {
  const url = new URL(getUrlAccessTokenAdminTargetDefinition(input.target).devBaseUrl);
  url.searchParams.set("accessToken", input.token);

  return url.toString();
}

export function normalizeUrlAccessTokenLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}

export function isValidUrlAccessTokenLabel(label: string): boolean {
  const normalizedLabel = normalizeUrlAccessTokenLabel(label);

  return normalizedLabel.length > 0 && normalizedLabel.length <= 191;
}

export function canManageUrlAccessTokens(permissions: readonly string[]): boolean {
  return permissions.includes("*") || permissions.includes("tokens:manage");
}

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
