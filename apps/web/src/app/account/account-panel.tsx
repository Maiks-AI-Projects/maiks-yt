"use client";

import "./account.module.css";
import { useAccountSettingsData } from "./account-settings.service";

const AccountPanel = (): React.ReactNode => {
  const {
    accounts,
    domainSnapshot,
    loadAccount,
    loading,
    message,
    session,
    streamSnapshot
  } = useAccountSettingsData({
    loadAccounts: true,
    loadDomain: true,
    loadStream: true
  });

  const displayName = domainSnapshot?.ok
    ? domainSnapshot.domainUser?.displayName ?? "Maiks.yt member"
    : "Maiks.yt member";
  const avatarUrl = domainSnapshot?.ok ? domainSnapshot.domainUser?.avatarUrl : null;
  const linkedCount = domainSnapshot?.ok ? domainSnapshot.linkedAccountCount : accounts.length;
  const streamHiddenCount = streamSnapshot?.ok
    ? streamSnapshot.preferences.filter((preference) => preference.optedOut).length
    : 0;

  return (
    <main className="account-page-panel">
      <header className="account-page-header">
        <div>
          <p className="eyebrow">Your Maiks.yt identity</p>
          <h1>Account</h1>
          <p>Quick status and shortcuts for your account settings.</p>
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
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={avatarUrl} />
              ) : (
                <span className="session-avatar-placeholder" aria-hidden="true">
                  {(displayName ?? session.currentUser.email ?? "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              <dl>
                <div>
                  <dt>Name</dt>
                  <dd>{displayName}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{session.currentUser.email ?? "No email shared by the provider"}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="account-section" aria-labelledby="account-overview-title">
            <div className="account-section-heading-row">
              <div>
                <h2 id="account-overview-title">Settings</h2>
                <p className="account-section-note">Open the specific task you want to change.</p>
              </div>
            </div>
            <div className="account-overview-actions">
              <a href="/account/profile">
                <strong>Profile</strong>
                <span>Name, image, and provider identity choices</span>
              </a>
              <a href="/account/connections">
                <strong>Connections</strong>
                <span>{linkedCount} connected {linkedCount === 1 ? "account" : "accounts"}</span>
              </a>
              <a href="/account/privacy">
                <strong>Privacy</strong>
                <span>{domainSnapshot?.ok && domainSnapshot.domainUser ? domainSnapshot.domainUser.profileVisibility : "Unavailable"}</span>
              </a>
              <a href="/account/stream">
                <strong>Stream</strong>
                <span>{streamHiddenCount} hidden {streamHiddenCount === 1 ? "setting" : "settings"}</span>
              </a>
            </div>
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
