"use client";

import { useEffect, useMemo, useState } from "react";

import { parseAccountSession, type AccountSession } from "../../account/account-session.service";
import type { OAuthProviderId } from "../../account/account.types";
import { createApiHeaders } from "../../dev-auth-token";
import {
  projectConfiguredProviders,
  type OAuthProvider
} from "../../oauth-provider-config.service";
import {
  createAccessRecoveryCallbackUrl,
  resolveAccessRecoveryReturnTarget
} from "./access-recovery.rules";
import styles from "./access-recovery.module.css";

type SignInResponse = {
  readonly url?: string;
  readonly redirect?: boolean;
};

type AccessRecoveryClientProps = {
  readonly initialReturnTo: string | null;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.maiks.yt";

const AccessRecoveryClient = ({ initialReturnTo }: AccessRecoveryClientProps): React.ReactNode => {
  const returnTarget = useMemo(
    () => resolveAccessRecoveryReturnTarget(initialReturnTo),
    [initialReturnTo]
  );
  const [providers, setProviders] = useState<readonly OAuthProvider[]>([]);
  const [busyProvider, setBusyProvider] = useState<OAuthProviderId | null>(null);
  const [session, setSession] = useState<AccountSession>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Checking available sign-in providers...");

  const refresh = async (): Promise<void> => {
    setLoading(true);

    try {
      const [providerResponse, sessionResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/account/login/providers`, {
          headers: createApiHeaders(),
          credentials: "include"
        }),
        fetch(`${apiBaseUrl}/account/session`, {
          headers: createApiHeaders(),
          credentials: "include"
        })
      ]);

      const nextProviders = providerResponse.ok
        ? projectConfiguredProviders(await providerResponse.json())
        : [];
      const nextSession = sessionResponse.ok
        ? parseAccountSession(await sessionResponse.json())
        : null;

      setProviders(nextProviders);
      setSession(nextSession);
      setMessage(nextSession
        ? "Sign-in renewed. Returning to the installed window..."
        : nextProviders.length > 0
          ? "Choose the provider you normally use for Maiks.yt."
          : "No Maiks.yt sign-in providers are currently configured.");
    } catch (error) {
      setProviders([]);
      setMessage(error instanceof Error ? error.message : "Recovery sign-in is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const startSignIn = async (provider: OAuthProvider): Promise<void> => {
    setBusyProvider(provider.id);
    setMessage(`Opening ${provider.label.replace("Continue with ", "")} sign-in...`);

    try {
      const callbackURL = createAccessRecoveryCallbackUrl(window.location.origin, returnTarget);
      const response = await fetch(`${apiBaseUrl}/auth/sign-in/social`, {
        method: "POST",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        credentials: "include",
        body: JSON.stringify({
          provider: provider.id,
          callbackURL,
          disableRedirect: true
        })
      });

      if (!response.ok) {
        throw new Error(`Sign-in failed with ${response.status}.`);
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

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (session && returnTarget) {
      window.location.assign(returnTarget);
    }
  }, [returnTarget, session]);

  return (
    <>
      <section className={styles.providers} aria-labelledby="recovery-provider-title">
        <div>
          <h2 id="recovery-provider-title">Renew your Maiks.yt sign-in</h2>
          <p className={styles.status} role="status">{message}</p>
        </div>
        {!session ? (
          <div className={styles.providerGrid}>
            {providers.map((provider) => (
              <button
                className={styles.providerButton}
                disabled={busyProvider !== null || loading}
                key={provider.id}
                onClick={() => void startSignIn(provider)}
                type="button"
              >
                {busyProvider === provider.id ? "Opening..." : provider.label}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className={styles.returnPanel} aria-labelledby="recovery-return-title">
        <div>
          <h2 id="recovery-return-title">Return to the installed window</h2>
          <p className={styles.copy}>
            Your launch token stays in that PWA. When it opens again, Maiks.yt checks the token,
            account session, linked identity, and current permissions before showing the app.
          </p>
        </div>
        <div className={styles.returnActions}>
          <button className={styles.secondaryAction} disabled={loading} onClick={() => void refresh()} type="button">
            Check again
          </button>
          {returnTarget ? (
            <a className={styles.secondaryAction} href={returnTarget}>
              Open installed window
            </a>
          ) : null}
        </div>
      </section>
    </>
  );
};

export default AccessRecoveryClient;
