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

export const createApiHeaders = (headers: HeadersInit = {}): HeadersInit => {
  const nextHeaders = new Headers(headers);
  const token = getDevAuthToken();

  if (token) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  return nextHeaders;
};
