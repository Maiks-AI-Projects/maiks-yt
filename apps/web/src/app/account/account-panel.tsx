"use client";

import { useEffect, useState } from "react";

type OAuthProviderId = "google" | "github" | "discord" | "twitch";

type AuthSession = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    emailVerified?: boolean | null;
  };
  session: {
    id?: string;
    userId?: string;
    expiresAt?: string | Date | null;
  };
} | null;

type AuthAccount = {
  id: string;
  providerId: string;
  accountId: string;
  userId: string;
  scopes?: string[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

type DomainLinkedAccount = {
  id: string;
  provider: string;
  providerAccountId: string;
  displayName: string;
  purposeLabel: string | null;
  audienceKey: string | null;
  channelKey: string | null;
  allowLogin: boolean;
  capabilities: unknown[];
  verifiedAt?: string | Date | null;
  createdAt?: string | Date | null;
};

type DomainAccountSnapshot = {
  ok: true;
  authUserId: string;
  domainUser: {
    id: string;
    displayName: string;
    profileVisibility: string;
  } | null;
  linkedAccounts: DomainLinkedAccount[];
  needsSync: boolean;
} | {
  ok: false;
  reason: string;
};

type LinkSocialResponse = {
  url?: string;
  redirect?: boolean;
  status?: boolean;
};

type ProviderRow = {
  id: OAuthProviderId;
  label: string;
  shortLabel: string;
  description: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const providers: ProviderRow[] = [
  { id: "google", label: "Google", shortLabel: "G", description: "Primary login and YouTube identity." },
  { id: "twitch", label: "Twitch", shortLabel: "Tw", description: "Streaming identity, chat, subs, and channel routing." },
  { id: "github", label: "GitHub", shortLabel: "GH", description: "Code and project contributor identity." },
  { id: "discord", label: "Discord", shortLabel: "Dc", description: "Community identity, roles, and perks." }
];

const AccountPanel = (): React.ReactNode => {
  const [session, setSession] = useState<AuthSession>(null);
  const [accounts, setAccounts] = useState<AuthAccount[]>([]);
  const [domainSnapshot, setDomainSnapshot] = useState<DomainAccountSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncingDomain, setSyncingDomain] = useState<boolean>(false);
  const [busyLinkedAccountId, setBusyLinkedAccountId] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<OAuthProviderId | null>(null);
  const [message, setMessage] = useState<string>("Loading account...");

  const loadAccount = async (): Promise<void> => {
    setLoading(true);

    try {
      const sessionResponse = await fetch(`${apiBaseUrl}/auth/get-session`, {
        credentials: "include"
      });

      if (!sessionResponse.ok) {
        throw new Error(`Session check failed with ${sessionResponse.status}`);
      }

      const nextSession = await sessionResponse.json() as AuthSession;
      setSession(nextSession);

      if (!nextSession) {
        setAccounts([]);
        setDomainSnapshot(null);
        setMessage("Sign in to manage linked accounts.");
        return;
      }

      const accountsResponse = await fetch(`${apiBaseUrl}/auth/list-accounts`, {
        credentials: "include"
      });

      if (!accountsResponse.ok) {
        throw new Error(`Account list failed with ${accountsResponse.status}`);
      }

      setAccounts(await accountsResponse.json() as AuthAccount[]);
      const domainResponse = await fetch(`${apiBaseUrl}/account/domain`, {
        credentials: "include"
      });

      if (domainResponse.ok) {
        setDomainSnapshot(await domainResponse.json() as DomainAccountSnapshot);
      } else if (domainResponse.status === 401) {
        setDomainSnapshot(null);
      } else {
        throw new Error(`Domain account snapshot failed with ${domainResponse.status}`);
      }

      setMessage("Account loaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account loading failed.");
    } finally {
      setLoading(false);
    }
  };

  const syncDomainAccounts = async (): Promise<void> => {
    setSyncingDomain(true);
    setMessage("Syncing domain accounts...");

    try {
      const response = await fetch(`${apiBaseUrl}/account/domain/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(`Domain sync failed with ${response.status}`);
      }

      setDomainSnapshot(await response.json() as DomainAccountSnapshot);
      setMessage("Domain accounts synced.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Domain sync failed.");
    } finally {
      setSyncingDomain(false);
    }
  };

  const linkProvider = async (providerId: OAuthProviderId): Promise<void> => {
    setBusyProvider(providerId);
    setMessage(`Opening ${providerId} account linking...`);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/link-social`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          provider: providerId,
          callbackURL: `${window.location.origin}/account`,
          disableRedirect: true
        })
      });

      if (!response.ok) {
        throw new Error(`Linking failed with ${response.status}`);
      }

      const data = await response.json() as LinkSocialResponse;

      if (data.status && !data.url) {
        await loadAccount();
        return;
      }

      if (!data.url) {
        throw new Error("Linking response did not include a redirect URL.");
      }

      window.location.assign(data.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account linking failed.");
      setBusyProvider(null);
    }
  };

  const updateAllowLogin = async (account: DomainLinkedAccount, allowLogin: boolean): Promise<void> => {
    setBusyLinkedAccountId(account.id);
    setMessage(`${allowLogin ? "Enabling" : "Disabling"} login for ${account.provider}...`);

    try {
      const response = await fetch(`${apiBaseUrl}/account/domain/linked-accounts/${account.id}/allow-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ allowLogin })
      });

      if (response.status === 409) {
        throw new Error("Cannot disable the last login-capable account.");
      }

      if (!response.ok) {
        throw new Error(`Allow-login update failed with ${response.status}`);
      }

      setDomainSnapshot(await response.json() as DomainAccountSnapshot);
      setMessage("Allow login updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Allow-login update failed.");
    } finally {
      setBusyLinkedAccountId(null);
    }
  };

  useEffect(() => {
    void loadAccount();
  }, []);

  const domainLinkedAccounts = domainSnapshot?.ok ? domainSnapshot.linkedAccounts : [];

  const getAuthAccountsForProvider = (providerId: OAuthProviderId): AuthAccount[] =>
    accounts.filter((account) => account.providerId === providerId);

  const getDomainAccountsForProvider = (providerId: OAuthProviderId): DomainLinkedAccount[] =>
    domainLinkedAccounts.filter((account) => account.provider === providerId);

  return (
    <section className="account-page-panel" aria-labelledby="account-page-title">
      <div className="account-page-header">
        <div>
          <h1 id="account-page-title">Account</h1>
          <p>{message}</p>
        </div>
        <button type="button" className="secondary-action" onClick={() => void loadAccount()} disabled={loading}>
          Refresh
        </button>
      </div>

      {session ? (
        <>
          <section className="account-section" aria-labelledby="account-identity-title">
            <h2 id="account-identity-title">Signed-in Identity</h2>
            <div className="session-card">
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={session.user.image} />
              ) : (
                <div aria-hidden="true" className="session-avatar-placeholder">
                  {(session.user.name ?? session.user.email ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <dl>
                <div>
                  <dt>Name</dt>
                  <dd>{session.user.name ?? "Unknown"}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{session.user.email ?? "No email returned"}</dd>
                </div>
                <div>
                  <dt>User ID</dt>
                  <dd>{session.user.id}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="account-section" aria-labelledby="domain-accounts-title">
            <div className="account-section-heading-row">
              <div>
                <h2 id="domain-accounts-title">Linked Accounts</h2>
                <p className="account-section-note">
                  Link providers here, then choose which linked accounts are allowed to sign in.
                </p>
              </div>
              <button
                type="button"
                className="secondary-action"
                onClick={() => void syncDomainAccounts()}
                disabled={syncingDomain}
              >
                {syncingDomain ? "Syncing..." : "Sync domain accounts"}
              </button>
            </div>
            {domainSnapshot?.ok ? (
              <>
                {domainSnapshot.domainUser ? (
                  <div className="domain-user-strip">
                    <span>Domain user</span>
                    <strong>{domainSnapshot.domainUser.displayName}</strong>
                    <span>{domainSnapshot.domainUser.profileVisibility}</span>
                  </div>
                ) : null}
                <div className="provider-account-list">
                  {providers.map((provider) => {
                    const authProviderAccounts = getAuthAccountsForProvider(provider.id);
                    const domainProviderAccounts = getDomainAccountsForProvider(provider.id);
                    const primaryDomainAccount = domainProviderAccounts[0];
                    const isLinked = authProviderAccounts.length > 0 || domainProviderAccounts.length > 0;
                    const isLoginCapable = Boolean(primaryDomainAccount?.capabilities.includes("login"));

                    return (
                      <article className="provider-account-row" key={provider.id}>
                        <div className="provider-identity">
                          <div className={`provider-mark ${provider.id}`} aria-hidden="true">
                            {provider.shortLabel}
                          </div>
                          <div>
                            <h3>{provider.label}</h3>
                            <p>{primaryDomainAccount?.displayName ?? provider.description}</p>
                            {authProviderAccounts.length > 1 || domainProviderAccounts.length > 1 ? (
                              <span className="provider-count">
                                {Math.max(authProviderAccounts.length, domainProviderAccounts.length)} accounts connected
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="provider-controls" aria-label={`${provider.label} account controls`}>
                          <div className="provider-control">
                            <span>Linked</span>
                            <button
                              type="button"
                              className={isLinked ? "switch-action enabled" : "switch-action"}
                              onClick={() => void linkProvider(provider.id)}
                              disabled={busyProvider !== null}
                              aria-pressed={isLinked}
                            >
                              <span>{busyProvider === provider.id ? "Opening" : isLinked ? "Linked" : "Connect"}</span>
                            </button>
                          </div>
                          <div className="provider-control">
                            <span>Login</span>
                            {primaryDomainAccount ? (
                              <button
                                type="button"
                                className={primaryDomainAccount.allowLogin ? "switch-action enabled" : "switch-action"}
                                onClick={() => void updateAllowLogin(primaryDomainAccount, !primaryDomainAccount.allowLogin)}
                                disabled={busyLinkedAccountId !== null || !isLoginCapable}
                                aria-pressed={primaryDomainAccount.allowLogin}
                              >
                                <span>
                                  {busyLinkedAccountId === primaryDomainAccount.id
                                    ? "Updating"
                                    : primaryDomainAccount.allowLogin
                                      ? "Enabled"
                                      : "Disabled"}
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="switch-action"
                                onClick={() => void syncDomainAccounts()}
                                disabled={!isLinked || syncingDomain}
                              >
                                <span>{isLinked ? "Sync" : "Unavailable"}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="account-section-note">
                Domain account data is not available yet. Refresh this page or sign in again if the problem keeps happening.
              </p>
            )}
          </section>
        </>
      ) : (
        <section className="account-section" aria-labelledby="account-signin-title">
          <h2 id="account-signin-title">Sign In Required</h2>
          <p className="account-section-note">Use the account menu in the navigation bar to sign in first.</p>
        </section>
      )}
    </section>
  );
};

export default AccountPanel;
