export type UrlAccessGateState =
  | {
    status: "checking";
  }
  | {
    status: "allowed";
    requiresLogin: boolean;
  }
  | {
    status: "missing-token" | "denied" | "error";
    message: string;
  };

export type UrlAccessGateOptions = {
  apiBaseUrl: string;
  surface: "overlay" | "control-panel" | "admin" | "api";
  scope: string;
  storageKey: string;
  queryParam?: string;
};

type UrlAccessTokenValidationResponse = {
  ok: boolean;
  valid?: boolean;
  requiresLogin?: boolean;
  reason?: string;
};

const defaultQueryParam = "accessToken";

export const captureUrlAccessToken = ({
  storageKey,
  queryParam = defaultQueryParam
}: Pick<UrlAccessGateOptions, "storageKey" | "queryParam">): string | null => {
  const currentUrl = new URL(window.location.href);
  const token = currentUrl.searchParams.get(queryParam);

  if (token) {
    window.localStorage.setItem(storageKey, token);
    currentUrl.searchParams.delete(queryParam);
    window.history.replaceState({}, "", currentUrl.toString());

    return token;
  }

  return window.localStorage.getItem(storageKey);
};

export const clearUrlAccessToken = (storageKey: string): void => {
  window.localStorage.removeItem(storageKey);
};

export const validateUrlAccessGate = async (options: UrlAccessGateOptions): Promise<UrlAccessGateState> => {
  const token = captureUrlAccessToken(options);

  if (!token) {
    return {
      status: "missing-token",
      message: "Access token required."
    };
  }

  try {
    const response = await fetch(`${options.apiBaseUrl}/access/url-token/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        token,
        surface: options.surface,
        scope: options.scope
      })
    });

    if (!response.ok) {
      throw new Error(`Token validation failed with ${response.status}`);
    }

    const result = await response.json() as UrlAccessTokenValidationResponse;

    if (!result.ok || !result.valid) {
      return {
        status: "denied",
        message: result.reason ?? "Access token was not accepted."
      };
    }

    return {
      status: "allowed",
      requiresLogin: Boolean(result.requiresLogin)
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Access token validation failed."
    };
  }
};
