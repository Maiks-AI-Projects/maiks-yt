type RecoveryReturnTargetRule = {
  readonly origin: string;
  readonly pathPrefixes: readonly string[];
};

const recoveryReturnTargetRules = [
  {
    origin: "https://control.maiks.yt",
    pathPrefixes: ["/control", "/chat", "/moderation"]
  },
  {
    origin: "https://maiks.yt",
    pathPrefixes: ["/tools/notifications"]
  }
] as const satisfies readonly RecoveryReturnTargetRule[];

const isAllowedPath = (pathname: string, pathPrefix: string): boolean =>
  pathname === pathPrefix || pathname.startsWith(`${pathPrefix}/`);

export const resolveAccessRecoveryReturnTarget = (
  value: string | null | undefined
): string | null => {
  if (!value) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.username || url.password) {
    return null;
  }

  const rule = recoveryReturnTargetRules.find((candidate) =>
    candidate.origin === url.origin
    && candidate.pathPrefixes.some((pathPrefix) => isAllowedPath(url.pathname, pathPrefix))
  );

  if (!rule) {
    return null;
  }

  return `${url.origin}${url.pathname}`;
};

export const createAccessRecoveryCallbackUrl = (
  origin: string,
  returnTarget: string | null
): string => {
  const callbackUrl = new URL("/access/recovery", origin);

  if (returnTarget) {
    callbackUrl.searchParams.set("returnTo", returnTarget);
  }

  return callbackUrl.toString();
};

export const createCanonicalAccessRecoveryPath = (url: URL): string => {
  const canonicalUrl = new URL("/access/recovery", url.origin);
  const returnTarget = resolveAccessRecoveryReturnTarget(url.searchParams.get("returnTo"));

  if (returnTarget) {
    canonicalUrl.searchParams.set("returnTo", returnTarget);
  }

  return `${canonicalUrl.pathname}${canonicalUrl.search}`;
};
