"use client";

import "../account.module.css";
import ProviderConnections from "../provider-connections";
import { useAccountSettingsData } from "../account-settings.service";

const ConnectionsPanel = (): React.ReactNode => {
  const {
    accounts,
    busyProvider,
    configuredProviders,
    linkProvider,
    loadAccount,
    loading,
    loadingProviderProfileOptions,
    message,
    providerProfileOptions,
    session,
    syncDomainAccounts,
    syncing
  } = useAccountSettingsData({
    loadAccounts: true,
    loadConfiguration: true,
    loadDomain: true,
    loadProviderProfiles: true,
    linkCallbackPath: "/account/connections"
  });

  return (
    <main className="account-page-panel">
      <header className="account-page-header">
        <div>
          <p className="eyebrow">Account connections</p>
          <h1>Connections</h1>
          <p>Manage the sign-in providers connected to this Maiks.yt account.</p>
        </div>
        <button type="button" className="secondary-action" onClick={() => void loadAccount()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      <p className="account-section-note" role="status">{message}</p>

      {loading ? (
        <section className="account-section" aria-labelledby="connections-loading-title">
          <h2 id="connections-loading-title">Loading connections</h2>
          <p className="account-section-note">Checking your connected providers.</p>
        </section>
      ) : session ? (
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
            loadingProviderOptions={loadingProviderProfileOptions}
            providerOptions={providerProfileOptions}
            syncing={syncing}
            onLinkProvider={(providerId) => void linkProvider(providerId)}
            onSync={() => void syncDomainAccounts()}
          />
        </section>
      ) : (
        <section className="account-section" aria-labelledby="connections-signed-out-title">
          <h2 id="connections-signed-out-title">Sign in to continue</h2>
          <p className="account-section-note">Use the account button in the site navigation to sign in.</p>
        </section>
      )}
    </main>
  );
};

export default ConnectionsPanel;
