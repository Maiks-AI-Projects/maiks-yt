"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { captureDevAuthTokenFromUrl, createApiHeaders, getDevAuthToken } from "../dev-auth-token";

export type AdminAccessState = "checking" | "owner" | "helper" | "none";

type AdminAccessContextValue = {
  accessState: AdminAccessState;
  devAuthToken: string | null;
};

type AdminAccessProviderProps = {
  children: React.ReactNode;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const AdminAccessContext = createContext<AdminAccessContextValue | null>(null);

export const AdminAccessProvider = ({ children }: AdminAccessProviderProps): React.ReactNode => {
  const [devAuthToken, setDevAuthToken] = useState<string | null>(null);
  const [accessState, setAccessState] = useState<AdminAccessState>("checking");

  useEffect(() => {
    let active = true;

    captureDevAuthTokenFromUrl();
    setDevAuthToken(getDevAuthToken());

    const loadAccess = async (): Promise<void> => {
      try {
        const sessionResponse = await fetch(`${apiBaseUrl}/account/session`, {
          credentials: "include",
          headers: createApiHeaders()
        });

        if (!sessionResponse.ok || !await sessionResponse.json()) {
          if (active) {
            setAccessState("none");
          }

          return;
        }

        const [ownerResponse, helperResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/admin/provider-integrations/status`, {
            credentials: "include",
            headers: createApiHeaders()
          }),
          fetch(`${apiBaseUrl}/admin/live-helper`, {
            credentials: "include",
            headers: createApiHeaders()
          })
        ]);

        if (!active) {
          return;
        }

        setAccessState(ownerResponse.ok ? "owner" : helperResponse.ok ? "helper" : "none");
      } catch {
        if (active) {
          setAccessState("none");
        }
      }
    };

    void loadAccess();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AdminAccessContextValue>(() => ({
    accessState,
    devAuthToken
  }), [accessState, devAuthToken]);

  return (
    <AdminAccessContext.Provider value={value}>
      {children}
    </AdminAccessContext.Provider>
  );
};

export const useAdminAccess = (): AdminAccessContextValue => {
  const context = useContext(AdminAccessContext);

  if (!context) {
    throw new Error("useAdminAccess must be used inside AdminAccessProvider.");
  }

  return context;
};
