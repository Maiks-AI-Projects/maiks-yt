"use client";

import type { StreamVisibilityPreferenceScope } from "@maiks-yt/domain/events";
import { useEffect, useState } from "react";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../dev-auth-token";
import "./account.module.css";
import ProfilePrivacySettings from "./profile-privacy-settings";
import ProfileIdentitySettings from "./profile-identity-settings";
import ProviderConnections from "./provider-connections";
import StreamVisibilitySettings from "./stream-visibility-settings";
import type {
  AuthAccount,
  AuthConfigurationStatus,
  AuthSession,
  DomainAccountSnapshot,
  DomainUserProfile,
  LinkSocialResponse,
  OAuthProviderId,
  ProfileVisibility,
  StreamVisibilityPreferencesSnapshot
} from "./account.types";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";
const globalStreamVisibilityScope = "all_stream_visible_website_events" satisfies StreamVisibilityPreferenceScope;

const AccountPanel = (): React.ReactNode => {
  const [session, setSession] = useState<AuthSession>(null);
  const [accounts, setAccounts] = useState<AuthAccount[]>([]);
  const [configuredProviders, setConfiguredProviders] = useState<OAuthProviderId[]>([]);
  const [domainSnapshot, setDomainSnapshot] = useState<DomainAccountSnapshot | null>(null);
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

    try {
      const [sessionResponse, configurationResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/account/session`, {
          headers: createApiHeaders(),
          credentials: "include"
        }),
        fetch(`${apiBaseUrl}/auth/dev/status`, {
          headers: createApiHeaders(),
          credentials: "include"
        })
      ]);

      if (!sessionResponse.ok) {
        throw new Error("We could not check your sign-in right now.");
      }

      const nextSession = await sessionResponse.json() as AuthSession;
      setSession(nextSession);

      if (configurationResponse.ok) {
        const configuration = await configurationResponse.json() as AuthConfigurationStatus;
        setConfiguredProviders(configuration.configuredProviders);
      }

      if (!nextSession) {
        setAccounts([]);
        setDomainSnapshot(null);
        setStreamSnapshot(null);
        setMessage("Sign in to manage your account.");
        return;
      }

      const [accountsResponse, domainResponse, streamResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/account/auth-accounts`, {
          headers: createApiHeaders(),
          credentials: "include"
        }),
        fetch(`${apiBaseUrl}/account/domain`, {
          headers: createApiHeaders(),
          credentials: "include"
        }),
        fetch(`${apiBaseUrl}/account/stream-visibility-preferences`, {
          headers: createApiHeaders(),
          credentials: "include"
        })
      ]);

      if (!accountsResponse.ok) {
        throw new Error("We could not load your connected accounts.");
      }

      setAccounts(await accountsResponse.json() as AuthAccount[]);

      if (domainResponse.ok) {
        const nextDomainSnapshot = await domainResponse.json() as DomainAccountSnapshot;
        setDomainSnapshot(nextDomainSnapshot);

        if (nextDomainSnapshot.ok && nextDomainSnapshot.needsSync) {
          await syncDomainAccounts();
        }
      } else {
        setDomainSnapshot(null);
      }

      if (streamResponse.ok) {
        setStreamSnapshot(await streamResponse.json() as StreamVisibilityPreferencesSnapshot);
      } else {
        setStreamSnapshot(null);
      }

      setMessage("Account settings are up to date.");
    } catch (error) {
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
          callbackURL: `${window.location.origin}/account`,
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

  const domainAccounts = domainSnapshot?.ok ? domainSnapshot.linkedAccounts : [];
  const preferences = streamSnapshot?.ok ? streamSnapshot.preferences : [];
  const globalPreference = preferences.find((preference) => preference.scope === globalStreamVisibilityScope);
  const perEventPreferences = preferences.filter((preference) => preference.scope !== globalStreamVisibilityScope);
  const displayName = domainSnapshot?.ok
    ? domainSnapshot.domainUser?.displayName ?? "Maiks.yt member"
    : "Maiks.yt member";

  return (
    <main className="account-page-panel">
      <header className="account-page-header">
        <div>
          <p className="eyebrow">Your Maiks.yt identity</p>
          <h1>Account</h1>
          <p>Manage how you sign in and how your community identity may appear.</p>
        </div>
        <button type="button" className="secondary-action" onClick={() => void loadAccount()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      <p className="account-section-note" role="status">{message}</p>

      {loading ? (
        <section className="account-section" aria-labelledby="account-loading-title">
          <h2 id="account-loading-title">Loading account</h2>
          <p className="account-section-note">Checking your current sign-in and saved settings.</p>
        </section>
      ) : session ? (
        <>
          <section className="account-section" aria-labelledby="identity-title">
            <h2 id="identity-title">Signed in as</h2>
            <div className="session-card">
              {domainSnapshot?.ok && domainSnapshot.domainUser?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={domainSnapshot.domainUser.avatarUrl} />
              ) : (
                <span className="session-avatar-placeholder" aria-hidden="true">
                  {(displayName ?? session.user.email ?? "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              <dl>
                <div>
                  <dt>Name</dt>
                  <dd>{displayName ?? "Maiks.yt member"}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{session.user.email ?? "No email shared by the provider"}</dd>
                </div>
              </dl>
            </div>
          </section>

          {domainSnapshot?.ok && domainSnapshot.domainUser ? (
            <section className="account-section" aria-labelledby="profile-identity-title">
              <div className="account-section-heading-row">
                <div>
                  <h2 id="profile-identity-title">Name and image</h2>
                  <p className="account-section-note">
                    Your Maiks.yt identity is independent from the accounts you use to sign in.
                  </p>
                </div>
              </div>
              <ProfileIdentitySettings
                profile={domainSnapshot.domainUser}
                onUpdated={updateDomainProfile}
                onMessage={setMessage}
              />
            </section>
          ) : null}

          <section className="account-section" aria-labelledby="connections-title">
            <div className="account-section-heading-row">
              <div>
                <h2 id="connections-title">Connected accounts</h2>
                <p className="account-section-note">Only sign-in providers available on Maiks.yt are shown.</p>
              </div>
            </div>
            <ProviderConnections
              accounts={accounts}
              busyProvider={busyProvider}
              configuredProviderIds={configuredProviders}
              domainAccounts={domainAccounts}
              syncing={syncing}
              onLinkProvider={(providerId) => void linkProvider(providerId)}
              onSync={() => void syncDomainAccounts()}
            />
          </section>

          <section className="account-section" aria-labelledby="privacy-title">
            <div className="account-section-heading-row">
              <div>
                <h2 id="privacy-title">Profile privacy</h2>
                <p className="account-section-note">
                  This choice is saved now. Real community profiles are still being connected to it.
                </p>
              </div>
            </div>
            {domainSnapshot?.ok && domainSnapshot.domainUser ? (
              <ProfilePrivacySettings
                currentValue={domainSnapshot.domainUser.profileVisibility}
                saving={savingProfile}
                onChange={(value) => void updateProfileVisibility(value)}
              />
            ) : (
              <p className="account-section-note">Profile privacy is unavailable right now.</p>
            )}
          </section>

          <section className="account-section" aria-labelledby="stream-title">
            <div className="account-section-heading-row">
              <div>
                <h2 id="stream-title">Appearance on stream</h2>
                <p className="account-section-note">
                  Opt out of website moments that could use your public name or image during a stream.
                </p>
              </div>
            </div>
            {streamSnapshot?.ok ? (
              <StreamVisibilitySettings
                globalPreference={globalPreference}
                perEventPreferences={perEventPreferences}
                savingScope={savingStreamScope}
                onChange={(scope, optedOut) => void updateStreamVisibility(scope, optedOut)}
              />
            ) : (
              <p className="account-section-note">Stream appearance settings are unavailable right now.</p>
            )}
          </section>
        </>
      ) : (
        <section className="account-section" aria-labelledby="signed-out-title">
          <h2 id="signed-out-title">Sign in to continue</h2>
          <p className="account-section-note">Use the account button in the site navigation to sign in.</p>
        </section>
      )}
    </main>
  );
};

export default AccountPanel;
