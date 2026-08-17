"use client";

import type { StreamVisibilityPreferenceScope } from "@maiks-yt/domain/events";
import { useEffect, useState } from "react";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../dev-auth-token";
import type {
  AuthAccount,
  AuthConfigurationStatus,
  AuthSession,
  DomainAccountSnapshot,
  DomainUserProfile,
  LinkSocialResponse,
  OAuthProviderId,
  ProviderProfileOption,
  ProviderProfileOptionsResponse,
  ProfileVisibility,
  StreamVisibilityPreferencesSnapshot
} from "./account.types";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

type UseAccountSettingsOptions = {
  loadAccounts?: boolean;
  loadConfiguration?: boolean;
  loadDomain?: boolean;
  loadProviderProfiles?: boolean;
  loadStream?: boolean;
  linkCallbackPath?: string;
};

type UseAccountSettingsResult = {
  accounts: readonly AuthAccount[];
  busyProvider: OAuthProviderId | null;
  configuredProviders: readonly OAuthProviderId[];
  domainSnapshot: DomainAccountSnapshot | null;
  linkProvider: (providerId: OAuthProviderId) => Promise<void>;
  loadAccount: () => Promise<void>;
  loading: boolean;
  loadingProviderProfileOptions: boolean;
  message: string;
  providerProfileOptions: readonly ProviderProfileOption[];
  savingProfile: boolean;
  savingStreamScope: StreamVisibilityPreferenceScope | null;
  session: AuthSession;
  setMessage: (message: string) => void;
  streamSnapshot: StreamVisibilityPreferencesSnapshot | null;
  syncing: boolean;
  syncDomainAccounts: () => Promise<DomainAccountSnapshot | null>;
  updateDomainProfile: (domainUser: DomainUserProfile) => void;
  updateProfileVisibility: (profileVisibility: ProfileVisibility) => Promise<void>;
  updateStreamVisibility: (scope: StreamVisibilityPreferenceScope, optedOut: boolean) => Promise<void>;
};

export const useAccountSettingsData = ({
  loadAccounts = false,
  loadConfiguration = false,
  loadDomain = false,
  loadProviderProfiles = false,
  loadStream = false,
  linkCallbackPath = "/account/connections"
}: UseAccountSettingsOptions = {}): UseAccountSettingsResult => {
  const [session, setSession] = useState<AuthSession>(null);
  const [accounts, setAccounts] = useState<AuthAccount[]>([]);
  const [configuredProviders, setConfiguredProviders] = useState<OAuthProviderId[]>([]);
  const [domainSnapshot, setDomainSnapshot] = useState<DomainAccountSnapshot | null>(null);
  const [providerProfileOptions, setProviderProfileOptions] = useState<ProviderProfileOption[]>([]);
  const [loadingProviderProfileOptions, setLoadingProviderProfileOptions] = useState(loadProviderProfiles);
  const [streamSnapshot, setStreamSnapshot] = useState<StreamVisibilityPreferencesSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busyProvider, setBusyProvider] = useState<OAuthProviderId | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingStreamScope, setSavingStreamScope] = useState<StreamVisibilityPreferenceScope | null>(null);
  const [message, setMessage] = useState("Loading your account...");

  const syncDomainAccounts = async (): Promise<DomainAccountSnapshot | null> => {
    setSyncing(true);

    try {
      const response = await fetch(`${apiBaseUrl}/account/domain/sync`, {
        method: "POST",
        headers: createApiHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({})
      });

      if (!response.ok) {
        return null;
      }

      const snapshot = await response.json() as DomainAccountSnapshot;
      setDomainSnapshot(snapshot);
      return snapshot;
    } finally {
      setSyncing(false);
    }
  };

  const loadAccount = async (): Promise<void> => {
    setLoading(true);
    setLoadingProviderProfileOptions(loadProviderProfiles);

    try {
      const [sessionResponse, configurationResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/account/session`, {
          headers: createApiHeaders(),
          credentials: "include"
        }),
        loadConfiguration
          ? fetch(`${apiBaseUrl}/auth/dev/status`, {
            headers: createApiHeaders(),
            credentials: "include"
          })
          : Promise.resolve(null)
      ]);

      if (!sessionResponse.ok) {
        throw new Error("We could not check your sign-in right now.");
      }

      const nextSession = await sessionResponse.json() as AuthSession;
      setSession(nextSession);

      if (configurationResponse?.ok) {
        const configuration = await configurationResponse.json() as AuthConfigurationStatus;
        setConfiguredProviders(configuration.configuredProviders);
      }

      if (!nextSession) {
        setAccounts([]);
        setDomainSnapshot(null);
        setProviderProfileOptions([]);
        setStreamSnapshot(null);
        setMessage("Sign in to manage your account.");
        setLoadingProviderProfileOptions(false);
        return;
      }

      const accountRequests: Array<Promise<void>> = [];

      if (loadAccounts) {
        accountRequests.push(fetch(`${apiBaseUrl}/account/auth-accounts`, {
          headers: createApiHeaders(),
          credentials: "include"
        }).then(async (response) => {
          if (!response.ok) {
            throw new Error("We could not load your connected accounts.");
          }

          setAccounts(await response.json() as AuthAccount[]);
        }));
      }

      if (loadDomain) {
        accountRequests.push(fetch(`${apiBaseUrl}/account/domain`, {
          headers: createApiHeaders(),
          credentials: "include"
        }).then(async (response) => {
          if (!response.ok) {
            setDomainSnapshot(null);
            return;
          }

          const nextDomainSnapshot = await response.json() as DomainAccountSnapshot;
          setDomainSnapshot(nextDomainSnapshot);

          if (nextDomainSnapshot.ok && nextDomainSnapshot.needsSync) {
            await syncDomainAccounts();
          }
        }));
      }

      if (loadStream) {
        accountRequests.push(fetch(`${apiBaseUrl}/account/stream-visibility-preferences`, {
          headers: createApiHeaders(),
          credentials: "include"
        }).then(async (response) => {
          setStreamSnapshot(response.ok
            ? await response.json() as StreamVisibilityPreferencesSnapshot
            : null);
        }));
      }

      if (loadProviderProfiles) {
        accountRequests.push(fetch(`${apiBaseUrl}/account/domain/provider-profile-options`, {
          headers: createApiHeaders(),
          credentials: "include"
        }).then(async (response) => {
          if (!response.ok) {
            setProviderProfileOptions([]);
            return;
          }

          const result = await response.json() as ProviderProfileOptionsResponse;
          setProviderProfileOptions(result.ok ? result.options : []);
        }).finally(() => setLoadingProviderProfileOptions(false)));
      }

      await Promise.all(accountRequests);
      setMessage("Account settings are up to date.");
    } catch (error) {
      setProviderProfileOptions([]);
      setLoadingProviderProfileOptions(false);
      setMessage(error instanceof Error ? error.message : "We could not load your account.");
    } finally {
      setLoading(false);
    }
  };

  const linkProvider = async (providerId: OAuthProviderId): Promise<void> => {
    setBusyProvider(providerId);
    setMessage(`Opening ${providerId} sign-in...`);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/link-social`, {
        method: "POST",
        headers: createApiHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          provider: providerId,
          callbackURL: `${window.location.origin}${linkCallbackPath}`,
          disableRedirect: true
        })
      });

      if (!response.ok) {
        throw new Error(`Could not connect ${providerId}.`);
      }

      const result = await response.json() as LinkSocialResponse;

      if (result.status && !result.url) {
        await loadAccount();
        return;
      }

      if (!result.url) {
        throw new Error(`Could not open ${providerId} sign-in.`);
      }

      window.location.assign(result.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not connect that account.");
      setBusyProvider(null);
    }
  };

  const updateProfileVisibility = async (profileVisibility: ProfileVisibility): Promise<void> => {
    setSavingProfile(true);

    try {
      const response = await fetch(`${apiBaseUrl}/account/domain/profile-visibility`, {
        method: "POST",
        headers: createApiHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ profileVisibility })
      });

      if (!response.ok) {
        throw new Error("Could not save profile privacy.");
      }

      setDomainSnapshot(await response.json() as DomainAccountSnapshot);
      setMessage("Profile privacy saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save profile privacy.");
    } finally {
      setSavingProfile(false);
    }
  };

  const updateDomainProfile = (domainUser: DomainUserProfile): void => {
    setDomainSnapshot((current) => current?.ok
      ? { ...current, domainUser }
      : current);
  };

  const updateStreamVisibility = async (
    scope: StreamVisibilityPreferenceScope,
    optedOut: boolean
  ): Promise<void> => {
    setSavingStreamScope(scope);

    try {
      const response = await fetch(`${apiBaseUrl}/account/stream-visibility-preferences`, {
        method: "PUT",
        headers: createApiHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ preferences: [{ scope, optedOut }] })
      });

      if (!response.ok) {
        throw new Error("Could not save stream visibility.");
      }

      setStreamSnapshot(await response.json() as StreamVisibilityPreferencesSnapshot);
      setMessage("Stream visibility saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save stream visibility.");
    } finally {
      setSavingStreamScope(null);
    }
  };

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadAccount();
  }, []);

  return {
    accounts,
    busyProvider,
    configuredProviders,
    domainSnapshot,
    linkProvider,
    loadAccount,
    loading,
    loadingProviderProfileOptions,
    message,
    providerProfileOptions,
    savingProfile,
    savingStreamScope,
    session,
    setMessage,
    streamSnapshot,
    syncing,
    syncDomainAccounts,
    updateDomainProfile,
    updateProfileVisibility,
    updateStreamVisibility
  };
};
