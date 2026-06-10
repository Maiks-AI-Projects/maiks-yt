"use client";

import { useState } from "react";

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

const OAuthLoginPanel = (): React.ReactNode => {
  const [busyProvider, setBusyProvider] = useState<OAuthProvider["id"] | null>(null);
  const [message, setMessage] = useState<string>("Not signed in");

  const startSignIn = async (provider: OAuthProvider): Promise<void> => {
    setBusyProvider(provider.id);
    setMessage(`Opening ${provider.label.replace("Continue with ", "")} sign-in...`);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/sign-in/social`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
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

  const checkSession = async (): Promise<void> => {
    setMessage("Checking session...");

    try {
      const response = await fetch(`${apiBaseUrl}/auth/get-session`, {
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(`Session check failed with ${response.status}`);
      }

      const session = await response.json() as unknown;
      setMessage(session ? "Session found" : "No session found");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Session check failed.");
    }
  };

  return (
    <section className="auth-panel" aria-labelledby="auth-panel-title">
      <div>
        <h2 id="auth-panel-title">OAuth Test Login</h2>
        <p>{message}</p>
      </div>
      <div className="auth-actions">
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => void startSignIn(provider)}
            disabled={busyProvider !== null}
          >
            {busyProvider === provider.id ? "Opening..." : provider.label}
          </button>
        ))}
        <button type="button" className="secondary-action" onClick={() => void checkSession()}>
          Check session
        </button>
      </div>
    </section>
  );
};

export default OAuthLoginPanel;
