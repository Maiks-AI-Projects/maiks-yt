"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { UrlAccessSurface, UrlAccessTokenAdminTarget } from "@maiks-yt/domain/security";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";

type UrlAccessTokenAdminListItem = {
  id: string;
  label: string;
  target: UrlAccessTokenAdminTarget | null;
  surface: UrlAccessSurface;
  scopes: readonly string[];
  requiresLogin: boolean;
  devBaseUrl: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type UrlAccessTokenAdminCreatedToken = UrlAccessTokenAdminListItem & {
  rawToken: string;
  devUrl: string;
};

type AdminTokensResponse =
  | {
    ok: true;
    tokens: readonly UrlAccessTokenAdminListItem[];
  }
  | {
    ok: false;
    reason: string;
  };

type AdminTokenMutationResponse =
  | {
    ok: true;
    token: UrlAccessTokenAdminCreatedToken;
  }
  | {
    ok: false;
    reason: string;
  };

type AdminTokenRevokeResponse =
  | {
    ok: true;
    token: UrlAccessTokenAdminListItem;
  }
  | {
    ok: false;
    reason: string;
  };

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
  "control-panel": "Control panel"
};

const formatDate = (value: string | null): string =>
  value
    ? new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value))
    : "Never";

const formatScopes = (scopes: readonly string[]): string =>
  scopes.length > 0 ? scopes.join(", ") : "No scopes";

const getTokenState = (token: UrlAccessTokenAdminListItem): string =>
  token.revokedAt ? "Revoked" : token.expiresAt && new Date(token.expiresAt) <= new Date() ? "Expired" : "Active";

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
    return "That existing token is not an overlay or control-panel token, so this first admin slice cannot rotate it.";
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
  const [selectedTokenId, setSelectedTokenId] = useState<string>("");
  const [tokenForm, setTokenForm] = useState<TokenFormState>(defaultTokenForm);
  const [createdToken, setCreatedToken] = useState<UrlAccessTokenAdminCreatedToken | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string>("Loading scoped URL tokens...");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const visibleTokens = useMemo(() => sortTokens(tokens), [tokens]);
  const selectedToken = useMemo(
    () => tokens.find((token) => token.id === selectedTokenId) ?? null,
    [tokens, selectedTokenId]
  );

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
    setMessage("Loading scoped URL tokens...");

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
        setLoadState("ready");
        setMessage(orderedTokens.length === 0 ? "No scoped URL tokens exist yet." : "Scoped URL tokens loaded.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState(getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Scoped URL token admin request failed.");
    }
  }, []);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadTokens();
  }, [loadTokens]);

  const runSecretMutation = async (
    label: string,
    path: string,
    options: {
      method: "POST";
      body?: Record<string, unknown>;
    }
  ): Promise<void> => {
    setBusyAction(label);
    setMessage(`${label}...`);

    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: options.method,
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        credentials: "include",
        ...(options.body ? { body: JSON.stringify(options.body) } : {})
      });
      const payload = await parseJson<AdminTokenMutationResponse>(response);

      if (response.ok && payload?.ok) {
        replaceToken(payload.token);
        setCreatedToken(payload.token);
        setLoadState("ready");
        setMessage(`${label} complete. Copy the generated URL now; the raw token will not be shown again after this page changes.`);
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
      setMessage("This first admin slice can rotate only overlay and control-panel tokens.");
      return;
    }

    if (!window.confirm(`Rotate ${selectedToken.label}? The old URL will stop working.`)) {
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

    if (!window.confirm(`Revoke ${selectedToken.label}? Any saved OBS or control URL using it will stop working.`)) {
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
      <header className="project-admin-header">
        <p className="eyebrow">Owner Admin</p>
        <h1>Scoped URL Tokens</h1>
        <p aria-live="polite">{message}</p>
      </header>

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
        <div className="project-admin-layout">
          <aside className="project-admin-sidebar" aria-label="Scoped URL tokens">
            <div className="project-admin-sidebar-heading">
              <h2>Tokens</h2>
              <button type="button" className="secondary-action" onClick={() => {
                setSelectedTokenId("");
                setTokenForm(defaultTokenForm);
              }}>
                New
              </button>
            </div>
            {visibleTokens.length === 0 ? (
              <p>No tokens yet.</p>
            ) : (
              <div className="project-admin-selector">
                {visibleTokens.map((token) => (
                  <button
                    key={token.id}
                    type="button"
                    className={token.id === selectedTokenId ? "selected" : ""}
                    onClick={() => setSelectedTokenId(token.id)}
                  >
                    <strong>{token.label}</strong>
                    <span>{token.target ? targetLabels[token.target] : token.surface} / {getTokenState(token)}</span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="project-admin-workspace" aria-label="Scoped URL token editor">
            {createdToken ? (
              <section className="project-admin-panel visibility-panel">
                <div>
                  <h2>Copy Once URL</h2>
                  <p>This raw token is available only from this create or rotate response.</p>
                </div>
                <button type="button" onClick={() => void copyValue(createdToken.devUrl, "token URL")}>
                  Copy URL
                </button>
                <label className="project-admin-inline-form">
                  Generated URL
                  <input value={createdToken.devUrl} readOnly />
                </label>
                <label className="project-admin-inline-form">
                  Raw Token
                  <input value={createdToken.rawToken} readOnly />
                </label>
              </section>
            ) : null}

            <form className="project-admin-panel project-admin-form token-admin-form" onSubmit={(event) => void createToken(event)}>
              <div className="project-admin-panel-heading">
                <h2>Create Token</h2>
                <button type="submit" disabled={busyAction !== null}>
                  {busyAction === "Creating token" ? "Creating..." : "Create Token"}
                </button>
              </div>
              <div className="project-admin-form-grid">
                <label>
                  Surface
                  <select value={tokenForm.target} onChange={(event) => {
                    const target = event.target.value as UrlAccessTokenAdminTarget;
                    setTokenForm({
                      target,
                      label: targetDefaultLabels[target]
                    });
                  }}>
                    <option value="overlay">OBS Overlay</option>
                    <option value="control-panel">Control Panel</option>
                  </select>
                </label>
                <label>
                  Label
                  <input value={tokenForm.label} onChange={(event) => setTokenForm((current) => ({ ...current, label: event.target.value }))} required maxLength={191} />
                </label>
              </div>
            </form>

            <section className="project-admin-panel">
              <div className="project-admin-panel-heading">
                <h2>{selectedToken ? selectedToken.label : "Token Details"}</h2>
                {selectedToken ? (
                  <div className="project-admin-actions">
                    <button type="button" className="secondary-action" onClick={() => void rotateToken()} disabled={busyAction !== null || selectedToken.revokedAt !== null || selectedToken.target === null}>
                      Rotate
                    </button>
                    <button type="button" onClick={() => void revokeToken()} disabled={busyAction !== null || selectedToken.revokedAt !== null}>
                      Revoke
                    </button>
                  </div>
                ) : null}
              </div>
              {selectedToken ? (
                <ul className="project-admin-record-list">
                  <li>
                    <div>
                      <strong>Surface</strong>
                      <span>{selectedToken.target ? targetLabels[selectedToken.target] : selectedToken.surface}</span>
                      <p>{selectedToken.devBaseUrl ?? "No generated dev URL for this unsupported token shape."}</p>
                    </div>
                    <input value={getTokenState(selectedToken)} readOnly aria-label="Token state" />
                  </li>
                  <li>
                    <div>
                      <strong>Scopes</strong>
                      <span>{formatScopes(selectedToken.scopes)}</span>
                      <p>{selectedToken.requiresLogin ? "Requires login after the URL token gate." : "URL token gate only; no interactive login required for OBS."}</p>
                    </div>
                    <input value={selectedToken.id} readOnly aria-label="Token id" />
                  </li>
                  <li>
                    <div>
                      <strong>Usage</strong>
                      <span>Last used: {formatDate(selectedToken.lastUsedAt)}</span>
                      <p>Created {formatDate(selectedToken.createdAt)}. Updated {formatDate(selectedToken.updatedAt)}.</p>
                    </div>
                    <input value={selectedToken.revokedAt ? `Revoked ${formatDate(selectedToken.revokedAt)}` : "Not revoked"} readOnly aria-label="Revocation state" />
                  </li>
                </ul>
              ) : (
                <p>Choose an existing token or create a new overlay/control-panel token.</p>
              )}
            </section>

            <section className="project-admin-panel project-admin-note">
              <h2>Deferred</h2>
              <p>Production token architecture, Cloudflare Access, expiry policies, audit logs, secrets management, migrations, and deployment changes stay outside this dev utility slice.</p>
            </section>
          </section>
        </div>
      ) : null}
    </>
  );
};

export default TokenAdminClient;
