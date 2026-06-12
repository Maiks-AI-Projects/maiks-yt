"use client";

import * as Switch from "@radix-ui/react-switch";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useEffect, useState } from "react";
import type { IconType } from "react-icons";
import { SiDiscord, SiGithub, SiGoogle, SiTwitch } from "react-icons/si";

type OAuthProviderId = "google" | "github" | "discord" | "twitch";

type AuthSession = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    emailVerified?: boolean | null;
  };
  session: {
    id?: string;
    userId?: string;
    expiresAt?: string | Date | null;
  };
} | null;

type AuthAccount = {
  id: string;
  providerId: string;
  accountId: string;
  userId: string;
  scopes?: string[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

type DomainLinkedAccount = {
  id: string;
  provider: string;
  providerAccountId: string;
  displayName: string;
  purposeLabel: string | null;
  audienceKey: string | null;
  channelKey: string | null;
  allowLogin: boolean;
  capabilities: unknown[];
  verifiedAt?: string | Date | null;
  createdAt?: string | Date | null;
};

type ProfileVisibility = "private" | "minimal" | "public";

type DomainAccountSnapshot = {
  ok: true;
  authUserId: string;
  domainUser: {
    id: string;
    displayName: string;
    profileVisibility: ProfileVisibility;
  } | null;
  linkedAccounts: DomainLinkedAccount[];
  needsSync: boolean;
} | {
  ok: false;
  reason: string;
};

type LinkSocialResponse = {
  url?: string;
  redirect?: boolean;
  status?: boolean;
};

type ProviderRow = {
  id: OAuthProviderId;
  label: string;
  Icon: IconType;
  description: string;
};

type ControlTooltipProps = {
  children: React.ReactNode;
  text: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const providers: ProviderRow[] = [
  { id: "google", label: "Google", Icon: SiGoogle, description: "Primary login and YouTube identity." },
  { id: "twitch", label: "Twitch", Icon: SiTwitch, description: "Streaming identity, chat, subs, and channel routing." },
  { id: "github", label: "GitHub", Icon: SiGithub, description: "Code and project contributor identity." },
  { id: "discord", label: "Discord", Icon: SiDiscord, description: "Community identity, roles, and perks." }
];

const profileVisibilityOptions: Array<{
  value: ProfileVisibility;
  label: string;
  description: string;
}> = [
  {
    value: "private",
    label: "Private",
    description: "Only you and trusted admin tools can see profile details."
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Show a basic community identity without linked account details."
  },
  {
    value: "public",
    label: "Public",
    description: "Allow public profile surfaces to show community identity details later."
  }
];

const ControlTooltip = ({ children, text }: ControlTooltipProps): React.ReactNode => (
  <Tooltip.Root delayDuration={250}>
    <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content className="control-tooltip" side="top" sideOffset={8}>
        {text}
        <Tooltip.Arrow className="control-tooltip-arrow" />
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
);

const AccountPanel = (): React.ReactNode => {
  const [session, setSession] = useState<AuthSession>(null);
  const [accounts, setAccounts] = useState<AuthAccount[]>([]);
  const [domainSnapshot, setDomainSnapshot] = useState<DomainAccountSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncingDomain, setSyncingDomain] = useState<boolean>(false);
  const [busyLinkedAccountId, setBusyLinkedAccountId] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<OAuthProviderId | null>(null);
  const [savingProfileVisibility, setSavingProfileVisibility] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("Loading account...");

  const loadAccount = async (): Promise<void> => {
    setLoading(true);

    try {
      const sessionResponse = await fetch(`${apiBaseUrl}/auth/get-session`, {
        credentials: "include"
      });

      if (!sessionResponse.ok) {
        throw new Error(`Session check failed with ${sessionResponse.status}`);
      }

      const nextSession = await sessionResponse.json() as AuthSession;
      setSession(nextSession);

      if (!nextSession) {
        setAccounts([]);
        setDomainSnapshot(null);
        setMessage("Sign in to manage linked accounts.");
        return;
      }

      const accountsResponse = await fetch(`${apiBaseUrl}/auth/list-accounts`, {
        credentials: "include"
      });

      if (!accountsResponse.ok) {
        throw new Error(`Account list failed with ${accountsResponse.status}`);
      }

      setAccounts(await accountsResponse.json() as AuthAccount[]);
      const domainResponse = await fetch(`${apiBaseUrl}/account/domain`, {
        credentials: "include"
      });

      if (domainResponse.ok) {
        setDomainSnapshot(await domainResponse.json() as DomainAccountSnapshot);
      } else if (domainResponse.status === 401) {
        setDomainSnapshot(null);
      } else {
        throw new Error(`Domain account snapshot failed with ${domainResponse.status}`);
      }

      setMessage("Account loaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account loading failed.");
    } finally {
      setLoading(false);
    }
  };

  const syncDomainAccounts = async (): Promise<void> => {
    setSyncingDomain(true);
    setMessage("Syncing domain accounts...");

    try {
      const response = await fetch(`${apiBaseUrl}/account/domain/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(`Domain sync failed with ${response.status}`);
      }

      setDomainSnapshot(await response.json() as DomainAccountSnapshot);
      setMessage("Domain accounts synced.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Domain sync failed.");
    } finally {
      setSyncingDomain(false);
    }
  };

  const linkProvider = async (providerId: OAuthProviderId): Promise<void> => {
    setBusyProvider(providerId);
    setMessage(`Opening ${providerId} account linking...`);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/link-social`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          provider: providerId,
          callbackURL: `${window.location.origin}/account`,
          disableRedirect: true
        })
      });

      if (!response.ok) {
        throw new Error(`Linking failed with ${response.status}`);
      }

      const data = await response.json() as LinkSocialResponse;

      if (data.status && !data.url) {
        await loadAccount();
        return;
      }

      if (!data.url) {
        throw new Error("Linking response did not include a redirect URL.");
      }

      window.location.assign(data.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account linking failed.");
      setBusyProvider(null);
    }
  };

  const updateAllowLogin = async (account: DomainLinkedAccount, allowLogin: boolean): Promise<void> => {
    setBusyLinkedAccountId(account.id);
    setMessage(`${allowLogin ? "Enabling" : "Disabling"} login for ${account.provider}...`);

    try {
      const response = await fetch(`${apiBaseUrl}/account/domain/linked-accounts/${account.id}/allow-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ allowLogin })
      });

      if (response.status === 409) {
        throw new Error("Cannot disable the last login-capable account.");
      }

      if (!response.ok) {
        throw new Error(`Allow-login update failed with ${response.status}`);
      }

      setDomainSnapshot(await response.json() as DomainAccountSnapshot);
      setMessage("Allow login updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Allow-login update failed.");
    } finally {
      setBusyLinkedAccountId(null);
    }
  };

  const updateProfileVisibility = async (profileVisibility: ProfileVisibility): Promise<void> => {
    setSavingProfileVisibility(true);
    setMessage(`Saving ${profileVisibility} profile visibility...`);

    try {
      const response = await fetch(`${apiBaseUrl}/account/domain/profile-visibility`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ profileVisibility })
      });

      if (!response.ok) {
        throw new Error(`Profile visibility update failed with ${response.status}`);
      }

      setDomainSnapshot(await response.json() as DomainAccountSnapshot);
      setMessage("Profile visibility updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Profile visibility update failed.");
    } finally {
      setSavingProfileVisibility(false);
    }
  };

  useEffect(() => {
    void loadAccount();
  }, []);

  const domainLinkedAccounts = domainSnapshot?.ok ? domainSnapshot.linkedAccounts : [];

  const getAuthAccountsForProvider = (providerId: OAuthProviderId): AuthAccount[] =>
    accounts.filter((account) => account.providerId === providerId);

  const getDomainAccountsForProvider = (providerId: OAuthProviderId): DomainLinkedAccount[] =>
    domainLinkedAccounts.filter((account) => account.provider === providerId);

  return (
    <Tooltip.Provider>
      <section className="account-page-panel" aria-labelledby="account-page-title">
      <div className="account-page-header">
        <div>
          <h1 id="account-page-title">Account</h1>
          <p>{message}</p>
        </div>
        <button type="button" className="secondary-action" onClick={() => void loadAccount()} disabled={loading}>
          Refresh
        </button>
      </div>

      {session ? (
        <>
          <section className="account-section" aria-labelledby="account-identity-title">
            <h2 id="account-identity-title">Signed-in Identity</h2>
            <div className="session-card">
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={session.user.image} />
              ) : (
                <div aria-hidden="true" className="session-avatar-placeholder">
                  {(session.user.name ?? session.user.email ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <dl>
                <div>
                  <dt>Name</dt>
                  <dd>{session.user.name ?? "Unknown"}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{session.user.email ?? "No email returned"}</dd>
                </div>
                <div>
                  <dt>User ID</dt>
                  <dd>{session.user.id}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="account-section" aria-labelledby="domain-accounts-title">
            <div className="account-section-heading-row">
              <div>
                <h2 id="domain-accounts-title">Linked Accounts</h2>
                <p className="account-section-note">
                  Link providers here, then choose which linked accounts are allowed to sign in.
                </p>
              </div>
              <button
                type="button"
                className="secondary-action"
                onClick={() => void syncDomainAccounts()}
                disabled={syncingDomain}
              >
                {syncingDomain ? "Syncing..." : "Sync domain accounts"}
              </button>
            </div>
            {domainSnapshot?.ok ? (
              <>
                {domainSnapshot.domainUser ? (
                  <div className="domain-user-strip">
                    <span>Domain user</span>
                    <strong>{domainSnapshot.domainUser.displayName}</strong>
                    <span>{domainSnapshot.domainUser.profileVisibility}</span>
                  </div>
                ) : null}
                <div className="provider-account-list">
                  {providers.map((provider) => {
                    const authProviderAccounts = getAuthAccountsForProvider(provider.id);
                    const domainProviderAccounts = getDomainAccountsForProvider(provider.id);
                    const isLinked = authProviderAccounts.length > 0 || domainProviderAccounts.length > 0;
                    const providerAccountCount = Math.max(authProviderAccounts.length, domainProviderAccounts.length);
                    const ProviderIcon = provider.Icon;

                    return (
                      <article className="provider-account-row" key={provider.id}>
                        <div className="provider-account-summary">
                          <div className="provider-identity">
                            <div className={`provider-mark ${provider.id}`} aria-hidden="true">
                              <ProviderIcon />
                            </div>
                            <div>
                              <h3>{provider.label}</h3>
                              <p>{provider.description}</p>
                              {providerAccountCount > 0 ? (
                                <span className="provider-count">
                                  {providerAccountCount} {providerAccountCount === 1 ? "account" : "accounts"} connected
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="provider-controls" aria-label={`${provider.label} account controls`}>
                            <div className="provider-control">
                              <span>Linked</span>
                              <div className="switch-control-row">
                                <ControlTooltip
                                  text={
                                    isLinked
                                      ? `${provider.label} is connected. Unlinking will be added later; use Add another for extra accounts.`
                                      : `Connect a ${provider.label} account to this profile.`
                                  }
                                >
                                  <span className="tooltip-trigger-wrap">
                                    <Switch.Root
                                      className="account-switch"
                                      checked={isLinked}
                                      disabled={busyProvider !== null || isLinked}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          void linkProvider(provider.id);
                                        }
                                      }}
                                      aria-label={`${provider.label} linked`}
                                    >
                                      <Switch.Thumb className="account-switch-thumb" />
                                    </Switch.Root>
                                  </span>
                                </ControlTooltip>
                                <span className="switch-state">
                                  {busyProvider === provider.id ? "Opening" : isLinked ? "Linked" : "Not linked"}
                                </span>
                              </div>
                              {isLinked ? (
                                <ControlTooltip
                                  text={`Connect another ${provider.label} account without removing the existing one.`}
                                >
                                  <span className="tooltip-trigger-wrap">
                                    <button
                                      type="button"
                                      className="inline-action"
                                      onClick={() => void linkProvider(provider.id)}
                                      disabled={busyProvider !== null}
                                    >
                                      Add another
                                    </button>
                                  </span>
                                </ControlTooltip>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        {domainProviderAccounts.length > 0 ? (
                          <div className="linked-account-sublist" aria-label={`${provider.label} linked accounts`}>
                            {domainProviderAccounts.map((account) => {
                              const isLoginCapable = account.capabilities.includes("login");

                              return (
                                <div className="linked-account-row" key={account.id}>
                                  <div className="linked-account-details">
                                    <strong>{account.displayName}</strong>
                                    <span>{account.purposeLabel ?? "Linked account"}</span>
                                    <code>{account.providerAccountId}</code>
                                  </div>
                                  <div className="provider-control linked-account-login-control">
                                    <span>Login</span>
                                    <div className="switch-control-row">
                                      <ControlTooltip
                                        text={
                                          isLoginCapable
                                            ? `Allow or block this ${provider.label} account from being used to sign in.`
                                            : `${provider.label} is connected, but it is not marked as login-capable yet.`
                                        }
                                      >
                                        <span className="tooltip-trigger-wrap">
                                          <Switch.Root
                                            className="account-switch"
                                            checked={account.allowLogin}
                                            disabled={busyLinkedAccountId !== null || !isLoginCapable}
                                            onCheckedChange={(checked) => void updateAllowLogin(account, checked)}
                                            aria-label={`${provider.label} ${account.displayName} login allowed`}
                                          >
                                            <Switch.Thumb className="account-switch-thumb" />
                                          </Switch.Root>
                                        </span>
                                      </ControlTooltip>
                                      <span className="switch-state">
                                        {busyLinkedAccountId === account.id
                                          ? "Updating"
                                          : account.allowLogin
                                            ? "Enabled"
                                            : "Disabled"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : isLinked ? (
                          <div className="linked-account-sublist">
                            <div className="linked-account-row">
                              <div className="linked-account-details">
                                <strong>Domain record missing</strong>
                                <span>Sync this provider before login settings can be managed.</span>
                              </div>
                              <ControlTooltip
                                text="Sync this provider into the domain account table so login settings can be managed."
                              >
                                <span className="tooltip-trigger-wrap">
                                  <button
                                    type="button"
                                    className="inline-action"
                                    onClick={() => void syncDomainAccounts()}
                                    disabled={!isLinked || syncingDomain}
                                  >
                                    {isLinked ? "Sync" : "Unavailable"}
                                  </button>
                                </span>
                              </ControlTooltip>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="account-section-note">
                Domain account data is not available yet. Refresh this page or sign in again if the problem keeps happening.
              </p>
            )}
          </section>

          <section className="account-section" aria-labelledby="profile-privacy-title">
            <div className="account-section-heading-row">
              <div>
                <h2 id="profile-privacy-title">Profile Privacy</h2>
                <p className="account-section-note">
                  New profiles start private. Choose how visible your community profile should become.
                </p>
              </div>
            </div>
            {domainSnapshot?.ok && domainSnapshot.domainUser ? (
              <div className="privacy-choice-list" role="radiogroup" aria-label="Profile visibility">
                {profileVisibilityOptions.map((option) => {
                  const isSelected = domainSnapshot.domainUser?.profileVisibility === option.value;

                  return (
                    <button
                      type="button"
                      className={isSelected ? "privacy-choice selected" : "privacy-choice"}
                      key={option.value}
                      onClick={() => void updateProfileVisibility(option.value)}
                      disabled={savingProfileVisibility || isSelected}
                      role="radio"
                      aria-checked={isSelected}
                    >
                      <span className="privacy-choice-indicator" aria-hidden="true" />
                      <span>
                        <strong>{option.label}</strong>
                        <span>{option.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state-actions">
                <p className="account-section-note">Sync domain accounts before choosing profile privacy.</p>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => void syncDomainAccounts()}
                  disabled={syncingDomain}
                >
                  {syncingDomain ? "Syncing..." : "Sync domain accounts"}
                </button>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="account-section" aria-labelledby="account-signin-title">
          <h2 id="account-signin-title">Sign In Required</h2>
          <p className="account-section-note">Use the account menu in the navigation bar to sign in first.</p>
        </section>
      )}
      </section>
    </Tooltip.Provider>
  );
};

export default AccountPanel;
