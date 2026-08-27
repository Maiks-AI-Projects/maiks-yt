"use client";

import type { UrlAccessSurface, UrlAccessTokenAdminTarget } from "@maiks-yt/domain/security";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiCopy, FiKey, FiLock, FiMonitor, FiPlus, FiRefreshCw, FiShield } from "react-icons/fi";

import { captureDevAuthTokenFromUrl, createApiHeaders, withDevAuthToken } from "../../dev-auth-token";
import styles from "./token-admin.module.css";

type UrlAccessTokenAdminListItem = {
  id: string;
  label: string;
  target: UrlAccessTokenAdminTarget | null;
  surface: UrlAccessSurface;
  scopes: readonly string[];
  requiresLogin: boolean;
  baseUrl: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type UrlAccessTokenAdminCreatedToken = UrlAccessTokenAdminListItem & {
  rawToken: string;
  launchUrl: string;
};

type AdminTokensResponse =
  | { ok: true; tokens: readonly UrlAccessTokenAdminListItem[] }
  | { ok: false; reason: string };

type AdminTokenMutationResponse =
  | { ok: true; token: UrlAccessTokenAdminCreatedToken }
  | { ok: false; reason: string };

type AdminTokenRevokeResponse =
  | { ok: true; token: UrlAccessTokenAdminListItem }
  | { ok: false; reason: string };

type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";

type TokenFormState = {
  target: UrlAccessTokenAdminTarget;
  label: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const defaultTokenForm: TokenFormState = {
  target: "overlay",
  label: "OBS overlay"
};

const targetLabels: Record<UrlAccessTokenAdminTarget, string> = {
  overlay: "OBS Overlay",
  "control-panel": "Control Panel"
};

const targetDefaultLabels: Record<UrlAccessTokenAdminTarget, string> = {
  overlay: "OBS overlay",
  "control-panel": "Control tools"
};

const targetSurfaceLabels: Record<UrlAccessTokenAdminTarget, string> = {
  overlay: "OBS browser source",
  "control-panel": "Installed stream-tool PWA"
};

const formatDate = (value: string | null): string =>
  value
    ? new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value))
    : "Never";

const formatRelativeDate = (value: string | null): string => {
  if (!value) {
    return "Never";
  }

  const elapsedSeconds = Math.round((new Date(value).getTime() - Date.now()) / 1_000);
  const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (Math.abs(elapsedSeconds) < 60) {
    return relativeTime.format(elapsedSeconds, "second");
  }

  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  if (Math.abs(elapsedMinutes) < 60) {
    return relativeTime.format(elapsedMinutes, "minute");
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (Math.abs(elapsedHours) < 24) {
    return relativeTime.format(elapsedHours, "hour");
  }

  const elapsedDays = Math.round(elapsedHours / 24);
  if (Math.abs(elapsedDays) < 7) {
    return relativeTime.format(elapsedDays, "day");
  }

  return formatDate(value);
};

const formatShortDate = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short"
  }).format(new Date(value));

const formatTokenId = (value: string): string =>
  value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;

const formatScopes = (scopes: readonly string[]): string =>
  scopes.length > 0 ? scopes.join(", ") : "No scopes";

const getTokenState = (token: UrlAccessTokenAdminListItem): "Active" | "Expired" | "Revoked" =>
  token.revokedAt ? "Revoked" : token.expiresAt && new Date(token.expiresAt) <= new Date() ? "Expired" : "Active";

const getTokenStateClass = (token: UrlAccessTokenAdminListItem): string => {
  const state = getTokenState(token);
  return state === "Active" ? styles.active! : state === "Expired" ? styles.expired! : styles.revoked!;
};

const getSurfaceLabel = (token: UrlAccessTokenAdminListItem): string =>
  token.target ? targetSurfaceLabels[token.target] : token.surface;

const getLastActivityLabel = (token: UrlAccessTokenAdminListItem): string => {
  if (token.revokedAt) {
    return `Revoked ${formatShortDate(token.revokedAt)}`;
  }

  if (token.lastUsedAt) {
    return `Used ${formatRelativeDate(token.lastUsedAt)}`;
  }

  return `Created ${formatDate(token.createdAt)}`;
};

const getFailureMessage = (response: Response, reason?: string): string => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "Sign in before managing scoped URL tokens.";
  }

  if (response.status === 403 || reason === "url_token_admin_forbidden") {
    return "Your account does not have scoped token admin permission.";
  }

  if (reason === "url_token_admin_invalid_input") {
    return "The token request has invalid or missing fields.";
  }

  if (reason === "url_token_not_found") {
    return "That token could not be found.";
  }

  if (reason === "url_token_unsupported_target") {
    return "That existing token is not an overlay or control-panel token, so it cannot be rotated here.";
  }

  return `Scoped token request failed with ${response.status}.`;
};

const getLoadStateForFailure = (response: Response, reason?: string): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

  if (response.status === 403 || reason === "url_token_admin_forbidden" || reason === "url_token_admin_user_unlinked") {
    return "forbidden";
  }

  return "failed";
};

const sortTokens = (tokens: readonly UrlAccessTokenAdminListItem[]): readonly UrlAccessTokenAdminListItem[] =>
  tokens
    .slice()
    .sort((left, right) => {
      const activeDelta = Number(Boolean(left.revokedAt)) - Number(Boolean(right.revokedAt));
      return activeDelta
        || left.surface.localeCompare(right.surface)
        || left.label.localeCompare(right.label)
        || right.createdAt.localeCompare(left.createdAt);
    });

const TokenAdminClient = (): React.ReactNode => {
  const [tokens, setTokens] = useState<readonly UrlAccessTokenAdminListItem[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState("");
  const [tokenForm, setTokenForm] = useState<TokenFormState>(defaultTokenForm);
  const [createdToken, setCreatedToken] = useState<UrlAccessTokenAdminCreatedToken | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("Loading access tokens...");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const visibleTokens = useMemo(() => sortTokens(tokens), [tokens]);
  const selectedToken = useMemo(
    () => tokens.find((token) => token.id === selectedTokenId) ?? null,
    [tokens, selectedTokenId]
  );
  const createdTokenLaunchUrl = createdToken ? withDevAuthToken(createdToken.launchUrl) : null;

  const replaceToken = useCallback((token: UrlAccessTokenAdminListItem): void => {
    setTokens((current) => {
      const exists = current.some((candidate) => candidate.id === token.id);
      const next = exists
        ? current.map((candidate) => candidate.id === token.id ? token : candidate)
        : [token, ...current];

      return sortTokens(next);
    });
    setSelectedTokenId(token.id);
  }, []);

  const parseJson = async <ResponseBody,>(response: Response): Promise<ResponseBody | null> => {
    try {
      return await response.json() as ResponseBody;
    } catch {
      return null;
    }
  };

  const loadTokens = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    setMessage("Loading access tokens...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/tokens`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<AdminTokensResponse>(response);

      if (response.ok && payload?.ok) {
        const orderedTokens = sortTokens(payload.tokens);
        setTokens(orderedTokens);
        setSelectedTokenId((current) => current || orderedTokens[0]?.id || "");
        setIsCreateOpen(orderedTokens.length === 0);
        setLoadState("ready");
        setMessage(orderedTokens.length === 0 ? "Create the first persistent access URL." : "");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState(getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Access token admin request failed.");
    }
  }, []);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadTokens();
  }, [loadTokens]);

  const runSecretMutation = async (
    label: string,
    path: string,
    options: { method: "POST"; body?: Record<string, unknown> }
  ): Promise<void> => {
    setBusyAction(label);
    setMessage(`${label}...`);

    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: options.method,
        headers: createApiHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        ...(options.body ? { body: JSON.stringify(options.body) } : {})
      });
      const payload = await parseJson<AdminTokenMutationResponse>(response);

      if (response.ok && payload?.ok) {
        replaceToken(payload.token);
        setCreatedToken(payload.token);
        setIsCreateOpen(false);
        setLoadState("ready");
        setMessage(`${label} complete. Copy the persistent URL now; it will not be shown again after this page changes.`);
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState((current) => current === "ready" ? current : getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${label} failed.`);
    } finally {
      setBusyAction(null);
    }
  };

  const createToken = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await runSecretMutation("Creating token", "/admin/tokens", {
      method: "POST",
      body: {
        target: tokenForm.target,
        label: tokenForm.label.trim()
      }
    });
  };

  const rotateToken = async (): Promise<void> => {
    if (!selectedToken) {
      setMessage("Choose a token before rotating.");
      return;
    }

    if (!selectedToken.target) {
      setMessage("Only overlay and control-panel tokens can be rotated here.");
      return;
    }

    if (!window.confirm(`Rotate ${selectedToken.label}? The saved URL will stop working immediately.`)) {
      return;
    }

    await runSecretMutation("Rotating token", `/admin/tokens/${encodeURIComponent(selectedToken.id)}/rotate`, {
      method: "POST"
    });
  };

  const revokeToken = async (): Promise<void> => {
    if (!selectedToken) {
      setMessage("Choose a token before revoking.");
      return;
    }

    if (!window.confirm(`Revoke ${selectedToken.label}? Any saved OBS or stream-tool URL using it will stop working.`)) {
      return;
    }

    setBusyAction("Revoking token");
    setMessage("Revoking token...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/tokens/${encodeURIComponent(selectedToken.id)}/revoke`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<AdminTokenRevokeResponse>(response);

      if (response.ok && payload?.ok) {
        replaceToken(payload.token);
        if (createdToken?.id === payload.token.id) {
          setCreatedToken(null);
        }
        setMessage("Token revoked.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Revoking token failed.");
    } finally {
      setBusyAction(null);
    }
  };

  const copyValue = async (value: string, label: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
    } catch {
      setMessage(`Could not copy ${label}. Select the field and copy it manually.`);
    }
  };

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1>Access Tokens</h1>
          <p>Persistent entry URLs for OBS and installed stream tools.</p>
        </div>
        <button
          type="button"
          className={styles.newButton}
          onClick={() => {
            setTokenForm(defaultTokenForm);
            setIsCreateOpen(true);
          }}
        >
          <FiPlus aria-hidden="true" />
          <span>New token</span>
        </button>
      </header>

      {message ? <p className={styles.message} aria-live="polite">{message}</p> : null}

      {loadState !== "ready" ? (
        <section className={`project-admin-state ${loadState}`}>
          <h2>{loadState === "loading" ? "Loading" : loadState === "signed-out" ? "Sign In Required" : loadState === "forbidden" ? "Forbidden" : "Unavailable"}</h2>
          <p>{message}</p>
          {loadState !== "loading" ? (
            <button type="button" className="secondary-action" onClick={() => void loadTokens()}>
              Retry
            </button>
          ) : null}
        </section>
      ) : null}

      {loadState === "ready" ? (
        <>
          {isCreateOpen ? (
            <form className={styles.createPanel} onSubmit={(event) => void createToken(event)}>
              <div className={styles.createHeading}>
                <div>
                  <h2>New access token</h2>
                  <p>The persistent URL is shown once after creation.</p>
                </div>
                <button type="button" className={styles.cancelButton} onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </button>
              </div>
              <label>
                Intended surface
                <select value={tokenForm.target} onChange={(event) => {
                  const target = event.target.value as UrlAccessTokenAdminTarget;
                  setTokenForm({ target, label: targetDefaultLabels[target] });
                }}>
                  <option value="overlay">OBS browser source</option>
                  <option value="control-panel">Installed stream-tool PWA</option>
                </select>
              </label>
              <label>
                Label
                <input
                  value={tokenForm.label}
                  onChange={(event) => setTokenForm((current) => ({ ...current, label: event.target.value }))}
                  required
                  maxLength={191}
                />
              </label>
              <button type="submit" disabled={busyAction !== null}>
                <FiKey aria-hidden="true" />
                <span>{busyAction === "Creating token" ? "Creating..." : "Create token"}</span>
              </button>
            </form>
          ) : null}

          <div className={styles.management}>
            <aside className={styles.tokenList} aria-label="Access tokens">
              <div className={styles.listHeading}>
                <h2>Tokens</h2>
                <p>Choose one to inspect</p>
              </div>
              {visibleTokens.length === 0 ? (
                <div className={styles.emptyList}>
                  <FiKey aria-hidden="true" />
                  <p>No persistent access URLs yet.</p>
                </div>
              ) : (
                <div className={styles.selector}>
                  {visibleTokens.map((token) => {
                    const SurfaceIcon = token.target === "control-panel" ? FiMonitor : FiKey;
                    return (
                      <button
                        key={token.id}
                        type="button"
                        className={token.id === selectedTokenId ? styles.selectedToken : styles.tokenButton}
                        onClick={() => setSelectedTokenId(token.id)}
                      >
                        <SurfaceIcon aria-hidden="true" className={styles.surfaceIcon} />
                        <span className={styles.tokenIdentity}>
                          <strong>{token.label}</strong>
                          <span>{getSurfaceLabel(token)}</span>
                        </span>
                        <span className={styles.tokenStatus}>
                          <span className={`${styles.statePill} ${getTokenStateClass(token)}`}>{getTokenState(token)}</span>
                          <small>{getLastActivityLabel(token)}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>

            <section className={styles.details} aria-label="Access token details">
              {selectedToken ? (
                <>
                  <div className={styles.detailHeader}>
                    <div className={styles.detailIdentity}>
                      <p className={styles.surfaceEyebrow}>{selectedToken.target ? targetLabels[selectedToken.target] : selectedToken.surface}</p>
                      <h2>{selectedToken.label}</h2>
                      <div className={styles.identityMeta}>
                        <span className={`${styles.stateText} ${getTokenStateClass(selectedToken)}`}>
                          <span aria-hidden="true" />
                          {getTokenState(selectedToken)}
                        </span>
                        <code title={selectedToken.id}>{formatTokenId(selectedToken.id)}</code>
                        <button type="button" className={styles.iconButton} onClick={() => void copyValue(selectedToken.id, "token ID")} aria-label="Copy token ID">
                          <FiCopy aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <div className={styles.actionArea}>
                      <div className={styles.actions}>
                        <button type="button" className={styles.rotateButton} onClick={() => void rotateToken()} disabled={busyAction !== null || selectedToken.revokedAt !== null || selectedToken.target === null}>
                          <FiRefreshCw aria-hidden="true" />
                          <span>Rotate</span>
                        </button>
                        <button type="button" className={styles.revokeButton} onClick={() => void revokeToken()} disabled={busyAction !== null || selectedToken.revokedAt !== null}>
                          <FiShield aria-hidden="true" />
                          <span>Revoke</span>
                        </button>
                      </div>
                      {selectedToken.revokedAt ? null : (
                        <p className={styles.actionWarning}>
                          <FiAlertTriangle aria-hidden="true" />
                          <span><strong>Rotate disables the saved URL immediately.</strong> Revoke stops access and cannot be undone.</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {createdToken?.id === selectedToken.id ? (
                    <section className={styles.copyOnce} aria-label="Copy-once access URL">
                      <div className={styles.copyHeading}>
                        <FiKey aria-hidden="true" />
                        <div>
                          <h3>Persistent URL ready — copy it now</h3>
                          <p>The URL keeps working after this message disappears. It is shown only after create or rotate.</p>
                        </div>
                      </div>
                      <div className={styles.copyControls}>
                        <input value={createdTokenLaunchUrl ?? createdToken.launchUrl} readOnly aria-label="Launch URL" />
                        <button type="button" onClick={() => void copyValue(createdTokenLaunchUrl ?? createdToken.launchUrl, "launch URL")}>
                          <FiCopy aria-hidden="true" />
                          <span>Copy launch URL</span>
                        </button>
                      </div>
                      <div className={styles.copyFooter}>
                        <button type="button" className={styles.rawTokenButton} onClick={() => void copyValue(createdToken.rawToken, "raw token")}>
                          Copy raw token
                        </button>
                        <p><FiLock aria-hidden="true" /> Save it in {createdToken.target === "overlay" ? "OBS" : "the stream tool"} now; the secret will not be shown again.</p>
                      </div>
                      {createdToken.requiresLogin ? (
                        <p className={styles.loginNote}>The copied launch URL includes short-lived sign-in access when available. The installed control surface still requires login after its URL-token gate.</p>
                      ) : null}
                    </section>
                  ) : null}

                  <section className={styles.definitionSection}>
                    <h3>Access</h3>
                    <dl>
                      <div><dt>Surface</dt><dd>{getSurfaceLabel(selectedToken)}</dd></div>
                      <div><dt>Scope</dt><dd><code>{formatScopes(selectedToken.scopes)}</code></dd></div>
                      <div><dt>Login after token</dt><dd>{selectedToken.requiresLogin ? "Required" : "Not required"}</dd></div>
                      <div><dt>Base URL</dt><dd>{selectedToken.baseUrl ?? "Unavailable for this token shape"}</dd></div>
                    </dl>
                  </section>

                  <section className={styles.definitionSection}>
                    <h3>Usage</h3>
                    <dl>
                      <div><dt>Last used</dt><dd>{formatRelativeDate(selectedToken.lastUsedAt)}</dd></div>
                      <div><dt>Created</dt><dd>{formatDate(selectedToken.createdAt)}</dd></div>
                      <div><dt>Updated</dt><dd>{formatDate(selectedToken.updatedAt)}</dd></div>
                      <div><dt>Expires</dt><dd>{selectedToken.expiresAt ? formatDate(selectedToken.expiresAt) : "Never"}</dd></div>
                      {selectedToken.revokedAt ? <div><dt>Revoked</dt><dd>{formatDate(selectedToken.revokedAt)}</dd></div> : null}
                    </dl>
                  </section>
                </>
              ) : (
                <div className={styles.emptyDetails}>
                  <FiKey aria-hidden="true" />
                  <h2>No token selected</h2>
                  <p>Create a persistent access URL for an OBS browser source or installed stream tool.</p>
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}
    </>
  );
};

export default TokenAdminClient;
