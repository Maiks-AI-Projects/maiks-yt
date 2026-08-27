import { validateUrlAccessGate } from "@maiks-yt/ui";

import { createApiHeaders } from "../dev-auth-token.js";

export type ControlPanelAuthState =
  | { status: "checking" }
  | { status: "allowed"; displayName: string }
  | {
    status: "blocked";
    kind: "missing-token" | "token-denied" | "login-required" | "unavailable";
    message: string;
  };

type AccountSessionResponse = {
  user: {
    name?: string | null;
    email?: string | null;
  };
} | null;

export const controlAccessRetryDelaysMs = [2_000, 5_000, 10_000, 20_000, 30_000] as const;

export const getControlAccessRetryDelay = (attempt: number): number =>
  controlAccessRetryDelaysMs[Math.min(Math.max(attempt, 0), controlAccessRetryDelaysMs.length - 1)]!;

export const validateControlPanelAccess = async (apiBaseUrl: string): Promise<ControlPanelAuthState> => {
  const gateState = await validateUrlAccessGate({
    apiBaseUrl,
    surface: "control-panel",
    scope: "control:open",
    storageKey: "maiks.yt.control.accessToken"
  });

  if (gateState.status === "checking") {
    return { status: "checking" };
  }

  if (gateState.status !== "allowed") {
    return {
      status: "blocked",
      kind: gateState.status === "missing-token"
        ? "missing-token"
        : gateState.status === "denied"
          ? "token-denied"
          : "unavailable",
      message: gateState.message
    };
  }

  if (!gateState.requiresLogin) {
    return {
      status: "allowed",
      displayName: "Token user"
    };
  }

  try {
    const sessionResponse = await fetch(`${apiBaseUrl}/account/session`, {
      credentials: "include",
      headers: createApiHeaders()
    });

    if (!sessionResponse.ok) {
      return {
        status: "blocked",
        kind: sessionResponse.status === 401 ? "login-required" : "unavailable",
        message: sessionResponse.status === 401
          ? "Your sign-in needs to be renewed."
          : `Session check failed with ${sessionResponse.status}.`
      };
    }

    const session = await sessionResponse.json() as AccountSessionResponse;

    if (!session) {
      return {
        status: "blocked",
        kind: "login-required",
        message: "Your sign-in needs to be renewed."
      };
    }

    return {
      status: "allowed",
      displayName: session.user.name ?? session.user.email ?? "Signed-in user"
    };
  } catch {
    return {
      status: "blocked",
      kind: "unavailable",
      message: "The account service is temporarily unavailable."
    };
  }
};
