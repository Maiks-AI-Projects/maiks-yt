import { useCallback, useEffect, useRef, useState } from "react";

import {
  getControlAccessRetryDelay,
  validateControlPanelAccess,
  type ControlPanelAuthState
} from "./control-access.service.js";

export const useControlAccess = (apiBaseUrl: string): {
  authState: ControlPanelAuthState;
  retryAccess: () => void;
} => {
  const [authState, setAuthState] = useState<ControlPanelAuthState>({ status: "checking" });
  const retryAttempt = useRef(0);
  const retryTimer = useRef<number | null>(null);
  const requestSequence = useRef(0);

  const clearRetry = useCallback((): void => {
    if (retryTimer.current !== null) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, []);

  const checkAccess = useCallback(async (showChecking: boolean): Promise<void> => {
    clearRetry();
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;

    if (showChecking) {
      setAuthState({ status: "checking" });
    }

    const nextState = await validateControlPanelAccess(apiBaseUrl);

    if (sequence !== requestSequence.current) {
      return;
    }

    setAuthState(nextState);

    if (nextState.status === "blocked" && nextState.kind === "unavailable") {
      const delay = getControlAccessRetryDelay(retryAttempt.current);
      retryAttempt.current += 1;
      retryTimer.current = window.setTimeout(() => {
        void checkAccess(false);
      }, delay);
      return;
    }

    retryAttempt.current = 0;
  }, [apiBaseUrl, clearRetry]);

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
    retryAccess
  };
};
