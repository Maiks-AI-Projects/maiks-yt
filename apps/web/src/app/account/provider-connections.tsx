"use client";

import { providerDefinitions } from "./account-settings-data";
import styles from "./account.module.css";
import type { AuthAccount, DomainLinkedAccount, OAuthProviderId } from "./account.types";

type ProviderConnectionsProps = {
  accounts: readonly AuthAccount[];
  busyProvider: OAuthProviderId | null;
  configuredProviderIds: readonly OAuthProviderId[];
  domainAccounts: readonly DomainLinkedAccount[];
  syncing: boolean;
  onLinkProvider: (providerId: OAuthProviderId) => void;
  onSync: () => void;
};

const ProviderConnections = ({
  accounts,
  busyProvider,
  configuredProviderIds,
  domainAccounts,
  syncing,
  onLinkProvider,
  onSync
}: ProviderConnectionsProps): React.ReactNode => {
  const visibleProviders = providerDefinitions.filter((provider) =>
    configuredProviderIds.includes(provider.id)
    || accounts.some((account) => account.providerId === provider.id)
    || domainAccounts.some((account) => account.provider === provider.id)
  );

  return (
    <div className={styles.connectionList}>
      {visibleProviders.map((provider) => {
        const authProviderAccounts = accounts.filter((account) => account.providerId === provider.id);
        const domainProviderAccounts = domainAccounts.filter((account) => account.provider === provider.id);
        const isLinked = authProviderAccounts.length > 0 || domainProviderAccounts.length > 0;
        const ProviderIcon = provider.Icon;

        return (
          <article className={styles.connection} key={provider.id}>
            <div className={styles.connectionMain}>
              <div className={`${styles.providerMark} ${styles[provider.id]}`} aria-hidden="true">
                <ProviderIcon />
              </div>
              <div className={styles.connectionIdentity}>
                <div className={styles.connectionTitle}>
                  <h3>{provider.label}</h3>
                  <span className={isLinked ? styles.connected : styles.notConnected}>
                    {isLinked ? "Connected" : "Not connected"}
                  </span>
                </div>
                <p>{provider.description}</p>
              </div>
              {isLinked ? null : (
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={() => onLinkProvider(provider.id)}
                  disabled={busyProvider !== null}
                >
                  {busyProvider === provider.id ? "Opening..." : "Connect"}
                </button>
              )}
            </div>

            {domainProviderAccounts.length > 0 ? (
              <div className={styles.linkedAccounts} aria-label={`${provider.label} linked accounts`}>
                {domainProviderAccounts.map((account) => (
                  <div className={styles.linkedAccount} key={account.id}>
                    <div>
                      <strong>{provider.label} login</strong>
                      <span>{account.purposeLabel ?? "Connected sign-in account"}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : isLinked ? (
              <div className={styles.setupNotice}>
                <span>Finishing this connection will make its account controls available.</span>
                <button type="button" className={styles.textButton} onClick={onSync} disabled={syncing}>
                  {syncing ? "Finishing..." : "Finish setup"}
                </button>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
};

export default ProviderConnections;
