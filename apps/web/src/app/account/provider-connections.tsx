"use client";

import { providerDefinitions } from "./account-settings-data";
import styles from "./account.module.css";
import type { AuthAccount, OAuthProviderId, ProviderProfileOption } from "./account.types";

type ProviderConnectionsProps = {
  accounts: readonly AuthAccount[];
  busyProvider: OAuthProviderId | null;
  configuredProviderIds: readonly OAuthProviderId[];
  loadingProviderOptions: boolean;
  providerOptions: readonly ProviderProfileOption[];
  syncing: boolean;
  onLinkProvider: (providerId: OAuthProviderId) => void;
  onSync: () => void;
};

type ConnectionIdentityRow = {
  key: string;
  displayName: string;
  email: string | null;
  imageUrl: string | null;
  detail: string;
};

const ProviderConnections = ({
  accounts,
  busyProvider,
  configuredProviderIds,
  loadingProviderOptions,
  providerOptions,
  syncing,
  onLinkProvider,
  onSync
}: ProviderConnectionsProps): React.ReactNode => {
  const visibleProviders = providerDefinitions.filter((provider) =>
    configuredProviderIds.includes(provider.id)
    || accounts.some((account) => account.providerId === provider.id)
    || providerOptions.some((option) => option.providerId === provider.id)
  );

  return (
    <div className={styles.connectionList}>
      {visibleProviders.map((provider) => {
        const authProviderAccounts = accounts.filter((account) => account.providerId === provider.id);
        const providerProfileOptions = providerOptions.filter((option) => option.providerId === provider.id);
        const fallbackAuthAccounts = providerProfileOptions.length > 0 ? [] : authProviderAccounts;
        const identityRows: ConnectionIdentityRow[] = [
          ...providerProfileOptions.map((option): ConnectionIdentityRow => ({
            key: `provider-option:${option.profileOptionRef}`,
            displayName: option.displayName,
            email: option.email,
            imageUrl: option.imageUrl,
            detail: "Provider profile"
          })),
          ...fallbackAuthAccounts.map((account, index): ConnectionIdentityRow => ({
            key: `auth:${account.providerId}:${index}`,
            displayName: `${provider.label} account${fallbackAuthAccounts.length > 1 ? ` ${index + 1}` : ""}`,
            email: null,
            imageUrl: null,
            detail: loadingProviderOptions ? "Checking provider profile" : "Connected sign-in"
          }))
        ];
        const isLinked = authProviderAccounts.length > 0 || providerProfileOptions.length > 0;
        const ProviderIcon = provider.Icon;

        return (
          <article className={styles.connection} key={provider.id}>
            <div className={styles.connectionMain}>
              <div className={styles.connectionIdentity}>
                <div className={styles.connectionTitle}>
                  <span className={`${styles.providerMark} ${styles[provider.id]}`} aria-hidden="true">
                    <ProviderIcon />
                  </span>
                  <h3>{provider.label}</h3>
                  <span className={isLinked ? styles.statePillAllowed : styles.statePillBlocked}>
                    {isLinked ? "Connected" : "Not connected"}
                  </span>
                </div>
                <p>{isLinked ? `${identityRows.length} connected ${identityRows.length === 1 ? "identity" : "identities"}` : provider.description}</p>
              </div>
              <button
                type="button"
                className={isLinked ? styles.textButton : styles.actionButton}
                onClick={() => onLinkProvider(provider.id)}
                disabled={busyProvider !== null}
              >
                {busyProvider === provider.id ? "Opening..." : isLinked ? "Add account" : "Connect"}
              </button>
            </div>

            {identityRows.length > 0 ? (
              <div className={styles.linkedAccounts} aria-label={`${provider.label} linked accounts`}>
                {identityRows.map((account) => (
                  <div className={styles.linkedAccount} key={account.key}>
                    <span className={`${styles.linkedProviderMark} ${styles[provider.id]}`} aria-hidden="true">
                      <ProviderIcon />
                    </span>
                    {account.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" src={account.imageUrl} />
                    ) : (
                      <span className={styles.linkedAccountAvatarFallback} aria-hidden="true">
                        {account.displayName.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className={styles.linkedAccountText}>
                      <strong>{account.displayName}</strong>
                      <span>{account.email ?? account.detail}</span>
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
