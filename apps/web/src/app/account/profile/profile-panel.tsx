"use client";

import "../account.module.css";
import ProfileIdentitySettings from "../profile-identity-settings";
import { useAccountSettingsData } from "../account-settings.service";

const ProfilePanel = (): React.ReactNode => {
  const {
    domainSnapshot,
    loadAccount,
    loading,
    loadingProviderProfileOptions,
    message,
    providerProfileOptions,
    session,
    setMessage,
    updateDomainProfile
  } = useAccountSettingsData({
    loadDomain: true,
    loadProviderProfiles: true,
    linkCallbackPath: "/account/profile"
  });

  return (
    <main className="account-page-panel">
      <header className="account-page-header">
        <div>
          <p className="eyebrow">Account profile</p>
          <h1>Profile</h1>
          <p>Set your Maiks.yt name and image, or copy them from a connected provider.</p>
        </div>
        <button type="button" className="secondary-action" onClick={() => void loadAccount()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      <p className="account-section-note" role="status">{message}</p>

      {loading ? (
        <section className="account-section" aria-labelledby="profile-loading-title">
          <h2 id="profile-loading-title">Loading profile</h2>
          <p className="account-section-note">Checking your saved identity.</p>
        </section>
      ) : session ? (
        <section className="account-section" aria-labelledby="profile-identity-title">
          <div className="account-section-heading-row">
            <div>
              <h2 id="profile-identity-title">Name and image</h2>
              <p className="account-section-note">
                Your Maiks.yt identity is independent from the accounts you use to sign in.
              </p>
            </div>
          </div>
          {domainSnapshot?.ok && domainSnapshot.domainUser ? (
            <ProfileIdentitySettings
              profile={domainSnapshot.domainUser}
              loadingProviderOptions={loadingProviderProfileOptions}
              providerOptions={providerProfileOptions}
              onUpdated={updateDomainProfile}
              onMessage={setMessage}
            />
          ) : (
            <p className="account-section-note">Profile identity is unavailable right now.</p>
          )}
        </section>
      ) : (
        <section className="account-section" aria-labelledby="profile-signed-out-title">
          <h2 id="profile-signed-out-title">Sign in to continue</h2>
          <p className="account-section-note">Use the account button in the site navigation to sign in.</p>
        </section>
      )}
    </main>
  );
};

export default ProfilePanel;
