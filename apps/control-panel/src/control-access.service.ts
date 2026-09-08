import { validateUrlAccessGate } from "@maiks-yt/ui";

import { createApiHeaders } from "./dev-auth-token.js";

export type ControlPanelAuthState =
  | {
    status: "checking";
  }
  | {
    displayName: string;
    status: "allowed";
  }
  | {
    message: string;
    retryAfterMs: number;
    status: "reconnecting";
  }
  | {
    message: string;
    status: "blocked";
  };

export type AccountSessionResponse = {
  user: {
    email?: string | null;
    name?: string | null;
  };
} | null;

type UrlAccessGateValidator = typeof validateUrlAccessGate;

const transientSessionStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);
export const defaultAccessRetryAfterMs = 5_000;

const reconnecting = (message: string): ControlPanelAuthState => ({
  message,
  retryAfterMs: defaultAccessRetryAfterMs,
  status: "reconnecting"
});

export const isTransientSessionStatus = (status: number): boolean =>
  transientSessionStatuses.has(status);

export const validateControlPanelAccess = async ({
  apiBaseUrl,
  createHeaders = createApiHeaders,
  fetchSession = fetch,
  validateGate = validateUrlAccessGate
}: {
  apiBaseUrl: string;
  createHeaders?: typeof createApiHeaders;
  fetchSession?: typeof fetch;
  validateGate?: UrlAccessGateValidator;
}): Promise<ControlPanelAuthState> => {
  const gateState = await validateGate({
    apiBaseUrl,
    scope: "control:open",
    storageKey: "maiks.yt.control.accessToken",
    surface: "control-panel"
  });

  if (gateState.status === "checking") {
    return {
      status: "checking"
    };
  }

  if (gateState.status === "transient-error") {
    return reconnecting(gateState.message);
  }

  if (gateState.status !== "allowed") {
    return {
      message: gateState.message,
      status: "blocked"
    };
  }

  if (!gateState.requiresLogin) {
    return {
      displayName: "Token user",
      status: "allowed"
    };
  }

  try {
    const sessionResponse = await fetchSession(`${apiBaseUrl}/account/session`, {
      cache: "no-store",
      credentials: "include",
      headers: createHeaders()
    });

    if (sessionResponse.status === 401 || sessionResponse.status === 403) {
      return {
        message: "Sign in on the main site before opening the control panel.",
        status: "blocked"
      };
    }

    if (!sessionResponse.ok) {
      return reconnecting(
        isTransientSessionStatus(sessionResponse.status)
          ? `Session refresh temporarily unavailable (${sessionResponse.status}).`
          : `Session refresh failed with ${sessionResponse.status}.`
      );
    }

    const session = await sessionResponse.json() as AccountSessionResponse;

    if (!session) {
      return {
        message: "Sign in on the main site before opening the control panel.",
        status: "blocked"
      };
    }

    return {
      displayName: session.user.name ?? session.user.email ?? "Signed-in user",
      status: "allowed"
    };
  } catch {
    return reconnecting("Session refresh temporarily unavailable.");
  }
};
