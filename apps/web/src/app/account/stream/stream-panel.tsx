"use client";

import type { StreamVisibilityPreferenceScope } from "@maiks-yt/domain/events";

import "../account.module.css";
import StreamVisibilitySettings from "../stream-visibility-settings";
import { useAccountSettingsData } from "../account-settings.service";

const globalStreamVisibilityScope = "all_stream_visible_website_events" satisfies StreamVisibilityPreferenceScope;

const StreamPanel = (): React.ReactNode => {
  const {
    loadAccount,
    loading,
    message,
    savingStreamScope,
    session,
    streamSnapshot,
    updateStreamVisibility
  } = useAccountSettingsData({
    loadStream: true
  });

  const preferences = streamSnapshot?.ok ? streamSnapshot.preferences : [];
  const globalPreference = preferences.find((preference) => preference.scope === globalStreamVisibilityScope);
  const perEventPreferences = preferences.filter((preference) => preference.scope !== globalStreamVisibilityScope);

  return (
    <main className="account-page-panel">
      <header className="account-page-header">
        <div>
          <p className="eyebrow">Stream appearance</p>
          <h1>Stream</h1>
          <p>Control website moments that could use your public name or image during a stream.</p>
        </div>
        <button type="button" className="secondary-action" onClick={() => void loadAccount()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      <p className="account-section-note" role="status">{message}</p>

      {loading ? (
        <section className="account-section" aria-labelledby="stream-loading-title">
          <h2 id="stream-loading-title">Loading stream settings</h2>
          <p className="account-section-note">Checking your stream visibility preferences.</p>
        </section>
      ) : session ? (
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
      ) : (
        <section className="account-section" aria-labelledby="stream-signed-out-title">
          <h2 id="stream-signed-out-title">Sign in to continue</h2>
          <p className="account-section-note">Use the account button in the site navigation to sign in.</p>
        </section>
      )}
    </main>
  );
};

export default StreamPanel;
