import type {
  UrlAccessTokenAdminTarget,
  UrlAccessTokenAdminTargetDefinition,
  UrlAccessTokenAdminLaunchEnvironment,
  UrlAccessTokenAdminLaunchEnvironmentInput,
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
    baseUrls: {
      development: "https://overlay-dev.maiks.yt/",
      production: "https://overlay.maiks.yt/"
    }
  },
  {
    target: "control-panel",
    label: "Control Panel",
    surface: "control-panel",
    scope: "control:open",
    requiresLogin: true,
    baseUrls: {
      development: "https://control-dev.maiks.yt/",
      production: "https://control.maiks.yt/"
    }
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

export function resolveUrlAccessTokenAdminLaunchEnvironment(
  input: UrlAccessTokenAdminLaunchEnvironmentInput
): UrlAccessTokenAdminLaunchEnvironment {
  const publicApiHostname = getHostname(input.publicApiBaseUrl);

  if (publicApiHostname === "api-dev.maiks.yt") {
    return "development";
  }

  if (publicApiHostname === "api.maiks.yt") {
    return "production";
  }

  return input.nodeEnvironment === "production" ? "production" : "development";
}

export function getUrlAccessTokenAdminBaseUrl(input: {
  target: UrlAccessTokenAdminTarget;
  environment: UrlAccessTokenAdminLaunchEnvironment;
}): string {
  return getUrlAccessTokenAdminTargetDefinition(input.target).baseUrls[input.environment];
}

export function buildUrlAccessTokenLaunchUrl(input: {
  environment: UrlAccessTokenAdminLaunchEnvironment;
  target: UrlAccessTokenAdminTarget;
  token: string;
}): string {
  const url = new URL(getUrlAccessTokenAdminBaseUrl({
    target: input.target,
    environment: input.environment
  }));
  url.searchParams.set("accessToken", input.token);

  return url.toString();
}

function getHostname(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
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
