import { validateUrlAccessGate } from "@maiks-yt/ui";

import { apiFetch } from "../dev-auth-token.js";

export type ControlPanelAuthState =
  | { status: "checking" }
  | { status: "reconnecting"; message: string }
  | { status: "allowed"; displayName: string }
  | {
    status: "blocked";
    kind: "missing-token" | "token-denied" | "login-required" | "unavailable";
    message: string;
    preserveOperationalShell?: boolean;
  };

type AccountSessionResponse = {
  ok: true;
  signedIn: true;
  currentUser: {
    name: string | null;
    email: string | null;
    imageUrl: string | null;
  };
} | null;

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const isSignedInAccountSession = (
  value: unknown
): value is NonNullable<AccountSessionResponse> => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Record<string, unknown>;

  if (session.ok !== true || session.signedIn !== true) {
    return false;
  }

  const currentUser = session.currentUser;

  if (!currentUser || typeof currentUser !== "object") {
    return false;
  }

  const user = currentUser as Record<string, unknown>;

  return isNullableString(user.name)
    && isNullableString(user.email)
    && isNullableString(user.imageUrl);
};

export const controlAccessRetryDelaysMs = [2_000, 5_000, 10_000, 20_000, 30_000] as const;
export const controlAccessSessionRefreshIntervalMs = 10 * 60 * 1_000;

export const getControlAccessRetryDelay = (attempt: number): number =>
  controlAccessRetryDelaysMs[Math.min(Math.max(attempt, 0), controlAccessRetryDelaysMs.length - 1)]!;

type ControlSessionRefreshResult = {
  ok: true;
} | {
  ok: false;
  kind: "login-required";
  message: string;
} | {
  ok: false;
  kind: "unavailable";
  message: string;
};

type ControlSessionRefreshRecord = {
  backoffUntilMs: number;
  inFlight: Promise<ControlSessionRefreshResult> | null;
  transientFailureCount: number;
  transientFailure: Extract<ControlSessionRefreshResult, { ok: false; kind: "unavailable" }> | null;
};

const controlSessionRefreshRecords = new Map<string, ControlSessionRefreshRecord>();

const getControlSessionRefreshRecord = (apiBaseUrl: string): ControlSessionRefreshRecord => {
  const existingRecord = controlSessionRefreshRecords.get(apiBaseUrl);

  if (existingRecord) {
    return existingRecord;
  }

  const record: ControlSessionRefreshRecord = {
    backoffUntilMs: 0,
    inFlight: null,
    transientFailureCount: 0,
    transientFailure: null
  };

  controlSessionRefreshRecords.set(apiBaseUrl, record);
  return record;
};

export const resetControlAccessSessionRefreshStateForTest = (): void => {
  controlSessionRefreshRecords.clear();
};

const requestControlSessionRefresh = async (apiBaseUrl: string): Promise<ControlSessionRefreshResult> => {
  try {
    const response = await apiFetch(`${apiBaseUrl}/auth/get-session`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return {
        ok: false,
        kind: response.status === 401 || response.status === 403 ? "login-required" : "unavailable",
        message: response.status === 401 || response.status === 403
          ? "Your sign-in needs to be renewed."
          : `Session refresh failed with ${response.status}.`
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      kind: "unavailable",
      message: "The account service is temporarily unavailable."
    };
  }
};

export const refreshControlSessionCookie = async (apiBaseUrl: string): Promise<{
  ok: true;
} | {
  ok: false;
  kind: "login-required" | "unavailable";
  message: string;
}> => {
  const record = getControlSessionRefreshRecord(apiBaseUrl);
  const nowMs = Date.now();

  if (record.inFlight) {
    return await record.inFlight;
  }

  if (record.transientFailure && record.backoffUntilMs > nowMs) {
    return record.transientFailure;
  }

  const refreshPromise = requestControlSessionRefresh(apiBaseUrl);
  record.inFlight = refreshPromise;

  const result = await refreshPromise;

  if (record.inFlight === refreshPromise) {
    record.inFlight = null;
  }

  if (result.ok || result.kind === "login-required") {
    record.backoffUntilMs = 0;
    record.transientFailureCount = 0;
    record.transientFailure = null;
    return result;
  }

  if (!result.ok && result.kind === "unavailable") {
    record.transientFailure = result;
    record.backoffUntilMs = Date.now() + getControlAccessRetryDelay(record.transientFailureCount);
    record.transientFailureCount += 1;
  }

  return result;
};

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

  const refreshState = await refreshControlSessionCookie(apiBaseUrl);

  if (!refreshState.ok) {
    return {
      status: "blocked",
      kind: refreshState.kind,
      message: refreshState.message,
      ...(refreshState.kind === "unavailable" ? { preserveOperationalShell: true } : {})
    };
  }

  try {
    const sessionResponse = await apiFetch(`${apiBaseUrl}/account/session`);

    if (!sessionResponse.ok) {
      return {
        status: "blocked",
        kind: sessionResponse.status === 401 || sessionResponse.status === 403 ? "login-required" : "unavailable",
        message: sessionResponse.status === 401 || sessionResponse.status === 403
          ? "Your sign-in needs to be renewed."
          : `Session check failed with ${sessionResponse.status}.`,
        preserveOperationalShell: sessionResponse.status !== 401 && sessionResponse.status !== 403
      };
    }

    const session: unknown = await sessionResponse.json();

    if (session === null) {
      return {
        status: "blocked",
        kind: "login-required",
        message: "Your sign-in needs to be renewed."
      };
    }

    if (!isSignedInAccountSession(session)) {
      return {
        status: "blocked",
        kind: "unavailable",
        message: "The account service returned an invalid session response."
      };
    }

    return {
      status: "allowed",
      displayName: session.currentUser.name ?? session.currentUser.email ?? "Signed-in user"
    };
  } catch {
    return {
      status: "blocked",
      kind: "unavailable",
      message: "The account service is temporarily unavailable.",
      preserveOperationalShell: true
    };
  }
};
