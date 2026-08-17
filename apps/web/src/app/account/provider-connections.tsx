"use client";

import { providerDefinitions } from "./account-settings-data";
import styles from "./account.module.css";
import type { AuthAccount, DomainLinkedAccount, OAuthProviderId, ProviderProfileOption } from "./account.types";

type ProviderConnectionsProps = {
  accounts: readonly AuthAccount[];
  busyProvider: OAuthProviderId | null;
  configuredProviderIds: readonly OAuthProviderId[];
  domainAccounts: readonly DomainLinkedAccount[];
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
  domainAccounts,
  loadingProviderOptions,
  providerOptions,
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
        const providerProfileOptions = providerOptions.filter((option) => option.providerId === provider.id);
        const providerProfileAccountIds = new Set(providerProfileOptions.map((option) => option.accountId));
        const fallbackAuthAccounts = authProviderAccounts.filter((account) => !providerProfileAccountIds.has(account.id));
        const authProviderExternalIds = new Set(authProviderAccounts.map((account) => account.accountId));
        const orphanDomainAccounts = domainProviderAccounts.filter((account) =>
          !authProviderExternalIds.has(account.providerAccountId)
        );
        const identityRows: ConnectionIdentityRow[] = [
          ...providerProfileOptions.map((option): ConnectionIdentityRow => ({
            key: `provider-option:${option.accountId}`,
            displayName: option.displayName,
            email: option.email,
            imageUrl: option.imageUrl,
            detail: "Provider profile"
          })),
          ...orphanDomainAccounts.map((account): ConnectionIdentityRow => ({
            key: `domain:${account.id}`,
            displayName: account.displayName,
            email: null,
            imageUrl: null,
            detail: account.purposeLabel ?? "Login account"
          })),
          ...fallbackAuthAccounts.map((account, index): ConnectionIdentityRow => ({
            key: `auth:${account.id}`,
            displayName: `${provider.label} account${fallbackAuthAccounts.length > 1 ? ` ${index + 1}` : ""}`,
            email: null,
            imageUrl: null,
            detail: loadingProviderOptions ? "Checking provider profile" : "Connected sign-in"
          }))
        ];
        const isLinked = authProviderAccounts.length > 0 || domainProviderAccounts.length > 0;
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
