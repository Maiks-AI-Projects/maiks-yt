"use client";

import "../account.module.css";
import ProfilePrivacySettings from "../profile-privacy-settings";
import { useAccountSettingsData } from "../account-settings.service";

const PrivacyPanel = (): React.ReactNode => {
  const {
    domainSnapshot,
    loadAccount,
    loading,
    message,
    savingProfile,
    session,
    updateProfileVisibility
  } = useAccountSettingsData({
    loadDomain: true
  });

  return (
    <main className="account-page-panel">
      <header className="account-page-header">
        <div>
          <p className="eyebrow">Account privacy</p>
          <h1>Privacy</h1>
          <p>Choose how much of your Maiks.yt profile can be public.</p>
        </div>
        <button type="button" className="secondary-action" onClick={() => void loadAccount()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      <p className="account-section-note" role="status">{message}</p>

      {loading ? (
        <section className="account-section" aria-labelledby="privacy-loading-title">
          <h2 id="privacy-loading-title">Loading privacy</h2>
          <p className="account-section-note">Checking your profile visibility.</p>
        </section>
      ) : session ? (
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
      ) : (
        <section className="account-section" aria-labelledby="privacy-signed-out-title">
          <h2 id="privacy-signed-out-title">Sign in to continue</h2>
          <p className="account-section-note">Use the account button in the site navigation to sign in.</p>
        </section>
      )}
    </main>
  );
};

export default PrivacyPanel;
