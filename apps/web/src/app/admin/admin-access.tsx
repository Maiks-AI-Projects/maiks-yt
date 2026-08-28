"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { parseAccountSession, type AccountSession } from "../account/account-session.service";
import { captureDevAuthTokenFromUrl, createApiHeaders, getDevAuthToken } from "../dev-auth-token";
import {
  parseJson,
  parseProviderIntegrationsStatusResponse
} from "./provider-integrations/provider-integrations-status.service";

export type AdminAccessState = "checking" | "owner" | "none";

export type AdminAccountIdentity = {
  avatarUrl: string | null;
  displayName: string;
  email: string | null;
  isSignedIn: boolean;
  sessionName: string | null;
};

type AdminAccessContextValue = {
  accessState: AdminAccessState;
  accountIdentity: AdminAccountIdentity;
  devAuthToken: string | null;
};

type AdminAccessProviderProps = {
  children: React.ReactNode;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.maiks.yt";

const AdminAccessContext = createContext<AdminAccessContextValue | null>(null);

type DomainProfileResponse = {
  ok: true;
  domainUser: {
    displayName: string;
    avatarUrl: string | null;
  } | null;
} | {
  ok: false;
  reason?: string;
};

const signedOutIdentity: AdminAccountIdentity = {
  avatarUrl: null,
  displayName: "Sign in",
  email: null,
  isSignedIn: false,
  sessionName: null
};

const buildIdentity = (
  session: Exclude<AccountSession, null>,
  domainUser: Extract<DomainProfileResponse, { ok: true }>["domainUser"]
): AdminAccountIdentity => {
  const sessionName = session.currentUser.name?.trim() || null;
  const sessionEmail = session.currentUser.email?.trim() || null;
  const displayName = domainUser?.displayName.trim() || sessionName || sessionEmail || "Account";

  return {
    avatarUrl: domainUser?.avatarUrl ?? session.currentUser.imageUrl ?? null,
    displayName,
    email: sessionEmail,
    isSignedIn: true,
    sessionName
  };
};

export const AdminAccessProvider = ({ children }: AdminAccessProviderProps): React.ReactNode => {
  const [devAuthToken, setDevAuthToken] = useState<string | null>(null);
  const [accessState, setAccessState] = useState<AdminAccessState>("checking");
  const [accountIdentity, setAccountIdentity] = useState<AdminAccountIdentity>(signedOutIdentity);

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

        const session = sessionResponse.ok
          ? parseAccountSession(await sessionResponse.json())
          : null;

        if (!session) {
          if (active) {
            setAccessState("none");
            setAccountIdentity(signedOutIdentity);
          }

          return;
        }

        const [domainResponse, ownerResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/account/domain`, {
            credentials: "include",
            headers: createApiHeaders()
          }),
          fetch(`${apiBaseUrl}/admin/provider-integrations/status`, {
            credentials: "include",
            headers: createApiHeaders()
          })
        ]);

        if (!active) {
          return;
        }

        const domainProfile = domainResponse.ok
          ? await domainResponse.json() as DomainProfileResponse
          : null;
        const domainUser = domainProfile?.ok ? domainProfile.domainUser : null;
        const ownerStatus = parseProviderIntegrationsStatusResponse(
          await parseJson<unknown>(ownerResponse)
        );

        setAccountIdentity(buildIdentity(session, domainUser));
        setAccessState(ownerResponse.ok && ownerStatus?.ok === true ? "owner" : "none");
      } catch {
        if (active) {
          setAccessState("none");
          setAccountIdentity(signedOutIdentity);
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
    accountIdentity,
    devAuthToken
  }), [accessState, accountIdentity, devAuthToken]);

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
