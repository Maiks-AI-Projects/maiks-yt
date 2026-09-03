import { useCallback, useEffect, useRef, useState } from "react";

import {
  controlAccessSessionRefreshIntervalMs,
  getControlAccessRetryDelay,
  validateControlPanelAccess,
  type ControlPanelAuthState
} from "./control-access.service.js";

export type ControlAccessTransientIssue = {
  readonly message: string;
  readonly retrying: boolean;
};

const lastAllowedStorageKey = "maiks.yt.control.lastAllowedSessionShell";

const clearLastAllowedAuthState = (): void => {
  try {
    window.localStorage.removeItem(lastAllowedStorageKey);
  } catch {
    // Ignore storage failures; genuine auth loss is still represented by the current blocked state.
  }
};

export const useControlAccess = (
  apiBaseUrl: string,
  onConfirmedLoginRequired?: () => void
): {
  authState: ControlPanelAuthState;
  transientIssue: ControlAccessTransientIssue | null;
  retryAccess: () => void;
} => {
  const [authState, setAuthState] = useState<ControlPanelAuthState>({ status: "checking" });
  const [transientIssue, setTransientIssue] = useState<ControlAccessTransientIssue | null>(null);
  const lastAllowedAuthState = useRef<Extract<ControlPanelAuthState, { status: "allowed" }> | null>(null);
  const retryAttempt = useRef(0);
  const retryTimer = useRef<number | null>(null);
  const inFlightCheck = useRef<Promise<void> | null>(null);
  const requestSequence = useRef(0);

  const clearRetry = useCallback((): void => {
    if (retryTimer.current !== null) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, []);

  const runAccessCheck = useCallback(async (showChecking: boolean): Promise<void> => {
    clearRetry();
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;

    if (showChecking) {
      setAuthState({ status: "checking" });
      setTransientIssue(null);
    }

    const nextState = await validateControlPanelAccess(apiBaseUrl);

    if (sequence !== requestSequence.current) {
      return;
    }

    if (nextState.status === "blocked" && nextState.kind === "unavailable") {
      const preservedAllowedState = nextState.preserveOperationalShell ? lastAllowedAuthState.current : null;
      const delay = getControlAccessRetryDelay(retryAttempt.current);

      retryAttempt.current += 1;
      retryTimer.current = window.setTimeout(() => {
        void checkAccess(false);
      }, delay);

      if (preservedAllowedState) {
        lastAllowedAuthState.current = preservedAllowedState;
        setAuthState(preservedAllowedState);
        setTransientIssue({
          message: nextState.message,
          retrying: true
        });
        return;
      }

      lastAllowedAuthState.current = null;
      clearLastAllowedAuthState();
      setTransientIssue(null);
      setAuthState(nextState.preserveOperationalShell
        ? {
          status: "reconnecting",
          message: nextState.message
        }
        : nextState);
      return;
    }

    retryAttempt.current = 0;
    if (nextState.status === "allowed") {
      lastAllowedAuthState.current = nextState;
      clearLastAllowedAuthState();
      setTransientIssue(null);
      retryTimer.current = window.setTimeout(() => {
        void checkAccess(false);
      }, controlAccessSessionRefreshIntervalMs);
    } else {
      lastAllowedAuthState.current = null;
      clearLastAllowedAuthState();
      setTransientIssue(null);
    }

    setAuthState(nextState);
    if (nextState.status === "blocked" && nextState.kind === "login-required") {
      onConfirmedLoginRequired?.();
    }
  }, [apiBaseUrl, clearRetry, onConfirmedLoginRequired]);

  const checkAccess = useCallback(async (showChecking: boolean): Promise<void> => {
    if (inFlightCheck.current) {
      return await inFlightCheck.current;
    }

    const accessCheck = runAccessCheck(showChecking);
    inFlightCheck.current = accessCheck;

    try {
      await accessCheck;
    } finally {
      if (inFlightCheck.current === accessCheck) {
        inFlightCheck.current = null;
      }
    }
  }, [runAccessCheck]);

  const retryAccess = useCallback((): void => {
    retryAttempt.current = 0;
    void checkAccess(true);
  }, [checkAccess]);

  useEffect(() => {
    void checkAccess(true);

    const retryWhenAvailable = (): void => {
      if (document.visibilityState === "visible") {
        void checkAccess(false);
      }
    };

    const retryWhenOnline = (): void => {
      void checkAccess(false);
    };

    window.addEventListener("online", retryWhenOnline);
    window.addEventListener("focus", retryWhenAvailable);
    document.addEventListener("visibilitychange", retryWhenAvailable);

    return () => {
      clearRetry();
      requestSequence.current += 1;
      window.removeEventListener("online", retryWhenOnline);
      window.removeEventListener("focus", retryWhenAvailable);
      document.removeEventListener("visibilitychange", retryWhenAvailable);
    };
  }, [checkAccess, clearRetry]);

  return {
    authState,
    transientIssue,
    retryAccess
  };
};
