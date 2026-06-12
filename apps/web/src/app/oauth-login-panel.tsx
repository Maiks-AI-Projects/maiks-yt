"use client";

import { useEffect, useState } from "react";

import { captureDevAuthTokenFromUrl, clearDevAuthToken, createApiHeaders } from "./dev-auth-token";

type OAuthProvider = {
  id: "google" | "github" | "discord" | "twitch";
  label: string;
};

const providers: readonly OAuthProvider[] = [
  { id: "google", label: "Continue with Google" },
  { id: "github", label: "Continue with GitHub" },
  { id: "discord", label: "Continue with Discord" },
  { id: "twitch", label: "Continue with Twitch" }
];

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

type SignInResponse = {
  url?: string;
  redirect?: boolean;
};

type AuthSessionResponse = {
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

type OAuthLoginPanelProps = {
  variant?: "panel" | "nav";
};

const OAuthLoginPanel = ({ variant = "panel" }: OAuthLoginPanelProps): React.ReactNode => {
  const [busyProvider, setBusyProvider] = useState<OAuthProvider["id"] | null>(null);
  const [session, setSession] = useState<AuthSessionResponse>(null);
  const [sessionLoading, setSessionLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<string>("Checking session...");

  const startSignIn = async (provider: OAuthProvider): Promise<void> => {
    setBusyProvider(provider.id);
    setMessage(`Opening ${provider.label.replace("Continue with ", "")} sign-in...`);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/sign-in/social`, {
        method: "POST",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        credentials: "include",
        body: JSON.stringify({
          provider: provider.id,
          callbackURL: window.location.origin,
          disableRedirect: true
        })
      });

      if (!response.ok) {
        throw new Error(`Sign-in failed with ${response.status}`);
      }

      const data = await response.json() as SignInResponse;

      if (!data.url) {
        throw new Error("Sign-in response did not include a redirect URL.");
      }

      window.location.assign(data.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed.");
      setBusyProvider(null);
    }
  };

  const refreshSession = async (): Promise<void> => {
    setSessionLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/account/session`, {
        headers: createApiHeaders(),
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(`Session check failed with ${response.status}`);
      }

      const nextSession = await response.json() as AuthSessionResponse;
      setSession(nextSession);
      setMessage(nextSession ? "Signed in" : "Not signed in");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Session check failed.");
    } finally {
      setSessionLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    setMessage("Signing out...");

    try {
      const response = await fetch(`${apiBaseUrl}/auth/sign-out`, {
        method: "POST",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({}),
        credentials: "include"
      });

      if (!response.ok && response.status !== 401) {
        throw new Error(`Sign-out failed with ${response.status}`);
      }

      clearDevAuthToken();
      setSession(null);
      setMessage("Signed out");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-out failed.");
    }
  };

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void refreshSession();
  }, []);

  if (variant === "nav") {
    const displayName = session?.user.name ?? session?.user.email ?? "Account";

    return (
      <section className="auth-nav" aria-label="Account">
        {session ? (
          <details className="account-menu">
            <summary>
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={session.user.image} />
              ) : (
                <span aria-hidden="true" className="session-avatar-placeholder">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span>{displayName}</span>
            </summary>
            <div className="account-menu-panel">
              <p>{message}</p>
              <dl>
                <div>
                  <dt>Email</dt>
                  <dd>{session.user.email ?? "No email returned"}</dd>
                </div>
                <div>
                  <dt>User ID</dt>
                  <dd>{session.user.id}</dd>
                </div>
              </dl>
              <div className="auth-actions compact">
                <button type="button" className="secondary-action" onClick={() => void refreshSession()}>
                  Refresh
                </button>
                <button type="button" className="secondary-action" onClick={() => void signOut()}>
                  Sign out
                </button>
              </div>
            </div>
          </details>
        ) : (
          <details className="account-menu">
            <summary>
              <span aria-hidden="true" className="session-avatar-placeholder">?</span>
              <span>{sessionLoading ? "Checking..." : "Sign in"}</span>
            </summary>
            <div className="account-menu-panel">
              <p>{message}</p>
              <div className="auth-actions compact">
                {providers.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => void startSignIn(provider)}
                    disabled={busyProvider !== null || sessionLoading}
                  >
                    {busyProvider === provider.id ? "Opening..." : provider.label}
                  </button>
                ))}
                <button type="button" className="secondary-action" onClick={() => void refreshSession()}>
                  Refresh
                </button>
              </div>
            </div>
          </details>
        )}
      </section>
    );
  }

  return (
    <section className="auth-panel" aria-labelledby="auth-panel-title">
      <div>
        <h2 id="auth-panel-title">Account</h2>
        <p>{message}</p>
      </div>
      {session ? (
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
      ) : null}
      <div className="auth-actions">
        {!session ? providers.map((provider) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => void startSignIn(provider)}
              disabled={busyProvider !== null || sessionLoading}
            >
              {busyProvider === provider.id ? "Opening..." : provider.label}
            </button>
          )) : null}
        <button type="button" className="secondary-action" onClick={() => void refreshSession()}>
          Refresh session
        </button>
        {session ? (
          <button type="button" className="secondary-action" onClick={() => void signOut()}>
            Sign out
          </button>
        ) : null}
      </div>
    </section>
  );
};

export default OAuthLoginPanel;
