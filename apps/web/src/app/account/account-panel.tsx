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

type LinkSocialResponse = {
  url?: string;
  redirect?: boolean;
  status?: boolean;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const providers: Array<{ id: OAuthProviderId; label: string }> = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
  { id: "discord", label: "Discord" },
  { id: "twitch", label: "Twitch" }
];

const formatDate = (value?: string | Date): string => {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

const AccountPanel = (): React.ReactNode => {
  const [session, setSession] = useState<AuthSession>(null);
  const [accounts, setAccounts] = useState<AuthAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
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
      setMessage("Account loaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account loading failed.");
    } finally {
      setLoading(false);
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

  useEffect(() => {
    void loadAccount();
  }, []);

  const linkedProviderIds = new Set(accounts.map((account) => account.providerId));

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

          <section className="account-section" aria-labelledby="linked-auth-title">
            <h2 id="linked-auth-title">Login Accounts</h2>
            <div className="account-card-grid">
              {accounts.map((account) => (
                <article className="linked-account-card" key={account.id}>
                  <div>
                    <h3>{account.providerId}</h3>
                    <p>{account.accountId}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>Scopes</dt>
                      <dd>{account.scopes?.length ? account.scopes.join(", ") : "Default login scopes"}</dd>
                    </div>
                    <div>
                      <dt>Linked</dt>
                      <dd>{formatDate(account.createdAt)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>

          <section className="account-section" aria-labelledby="connect-title">
            <h2 id="connect-title">Connect Another Account</h2>
            <p className="account-section-note">
              These are authentication links only. The later domain bridge will add stream display names, IGN verification,
              channel routing, perks, and the Allow login toggle.
            </p>
            <div className="auth-actions">
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => void linkProvider(provider.id)}
                  disabled={busyProvider !== null}
                >
                  {busyProvider === provider.id
                    ? "Opening..."
                    : linkedProviderIds.has(provider.id)
                      ? `Connect another ${provider.label}`
                      : `Connect ${provider.label}`}
                </button>
              ))}
            </div>
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
