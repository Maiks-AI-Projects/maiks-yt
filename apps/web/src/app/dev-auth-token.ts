"use client";

const devAuthTokenStorageKey = "maiks.yt.devAuthToken";
const devAuthTokenQueryParam = "devAuthToken";

export const captureDevAuthTokenFromUrl = (): boolean => {
  const currentUrl = new URL(window.location.href);
  const token = currentUrl.searchParams.get(devAuthTokenQueryParam);

  if (!token) {
    return false;
  }

  window.localStorage.setItem(devAuthTokenStorageKey, token);
  currentUrl.searchParams.delete(devAuthTokenQueryParam);
  window.history.replaceState({}, "", currentUrl.toString());

  return true;
};

export const getDevAuthToken = (): string | null => {
  return window.localStorage.getItem(devAuthTokenStorageKey);
};

export const clearDevAuthToken = (): void => {
  window.localStorage.removeItem(devAuthTokenStorageKey);
};

const shouldAppendDevAuthToken = (href: string): boolean => {
  if (href.startsWith("/")) {
    return href.startsWith("/admin") || href.startsWith("/tools") || href === "/account";
  }

  try {
    const url = new URL(href);

    return url.hostname === "control-dev.maiks.yt" || url.hostname === "web-dev.maiks.yt";
  } catch {
    return false;
  }
};

export const withDevAuthToken = (href: string, token = getDevAuthToken()): string => {
  if (!token || !shouldAppendDevAuthToken(href)) {
    return href;
  }

  const url = href.startsWith("/")
    ? new URL(href, window.location.origin)
    : new URL(href);

  url.searchParams.set(devAuthTokenQueryParam, token);

  return href.startsWith("/") ? `${url.pathname}${url.search}${url.hash}` : url.toString();
};

export const createApiHeaders = (headers: HeadersInit = {}): HeadersInit => {
  const nextHeaders = new Headers(headers);
  const token = getDevAuthToken();

  if (token) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  return nextHeaders;
};
