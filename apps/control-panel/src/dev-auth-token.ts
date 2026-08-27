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

export const getDevAuthToken = (): string | null =>
  window.localStorage.getItem(devAuthTokenStorageKey);

export const withDevAuthToken = (value: string): string => {
  if (!value.startsWith("https://web-dev.maiks.yt/")) {
    return value;
  }

  const token = getDevAuthToken();

  if (!token) {
    return value;
  }

  const url = new URL(value);
  url.searchParams.set(devAuthTokenQueryParam, token);

  return url.toString();
};

export const createApiHeaders = (headers: HeadersInit = {}): HeadersInit => {
  const nextHeaders = new Headers(headers);
  const token = getDevAuthToken();

  if (token) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  return nextHeaders;
};

export const apiFetch = async (input: string | URL, init: RequestInit = {}): Promise<Response> =>
  await fetch(input, {
    ...init,
    credentials: "include",
    headers: createApiHeaders(init.headers)
  });
