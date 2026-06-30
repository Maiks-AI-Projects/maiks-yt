"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";

type ProviderIntegrationState = "configured" | "missing" | "invalid" | "disabled" | "error";
type ProviderCapabilityState = "available" | "configured" | "missing" | "not_enabled" | "gated";

type ProviderEnvironmentVariableStatus = {
  name: string;
  kind: "identifier" | "secret";
  required: boolean;
  configured: boolean;
  valid: boolean;
};

type ProviderCapabilityStatus = {
  key: string;
  label: string;
  state: ProviderCapabilityState;
  detail: string;
};

type ProviderIntegrationStatus = {
  id: "twitch" | "youtube" | "discord";
  label: string;
  state: ProviderIntegrationState;
  sdk: string;
  readOnly: true;
  env: readonly ProviderEnvironmentVariableStatus[];
  issues: readonly string[];
  capabilities: readonly ProviderCapabilityStatus[];
};

type ProviderIntegrationsStatusResponse =
  | {
    ok: true;
    generatedAt: string;
    readOnly: true;
    providers: readonly ProviderIntegrationStatus[];
    boundaries: readonly string[];
  }
  | {
    ok: false;
    reason: string;
  };

type TwitchChatProjectedMessage = {
  id: string;
  authorName: string;
  channelName: string;
  createdAt: string;
  message: string;
  source: "twitch";
  visibleOnOverlayByDefault: false;
};

type TwitchChatIntakeStatus = {
  channelName: string | null;
  connectedAt: string | null;
  lastError: string | null;
  lastMessageAt: string | null;
  recentMessages: readonly TwitchChatProjectedMessage[];
  state: "stopped" | "connecting" | "connected" | "unconfigured";
};

type TwitchChatIntakeResponse =
  | {
    ok: true;
    readOnly: true;
    status: TwitchChatIntakeStatus;
  }
  | {
    ok: false;
    reason: string;
  };

type YouTubeCredentialSummary = {
  provider: "youtube";
  purpose: "youtube_live_chat";
  status: "active" | "revoked" | "error";
  displayName: string | null;
  scopes: readonly string[];
  lastVerifiedAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
};

type YouTubeConsentResponse =
  | {
    ok: true;
    credential: YouTubeCredentialSummary | null;
    redirectUri: string;
    requiredScope: string;
    consentUrl?: string;
  }
  | {
    ok: false;
    reason: string;
  };

type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const stateLabels: Record<ProviderIntegrationState, string> = {
  configured: "Configured",
  missing: "Missing",
  invalid: "Invalid",
  disabled: "Disabled",
  error: "Error"
};

const capabilityStateLabels: Record<ProviderCapabilityState, string> = {
  available: "Available",
  configured: "Configured",
  missing: "Missing",
  not_enabled: "Not enabled",
  gated: "Gated"
};

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

const getFailureMessage = (response: Response, reason?: string): string => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "Sign in before opening provider integration status.";
  }

  if (
    response.status === 403
    || reason === "provider_integrations_forbidden"
    || reason === "provider_integrations_user_unlinked"
  ) {
    return "Your account does not have owner access to provider integration status.";
  }

  return `Provider integration status request failed with ${response.status}.`;
};

const getLoadStateForFailure = (response: Response, reason?: string): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

  if (
    response.status === 403
    || reason === "provider_integrations_forbidden"
    || reason === "provider_integrations_user_unlinked"
  ) {
    return "forbidden";
  }

  return "failed";
};

const parseJson = async <ResponseBody,>(response: Response): Promise<ResponseBody | null> => {
  try {
    return await response.json() as ResponseBody;
  } catch {
    return null;
  }
};

const ProviderIntegrationsStatusClient = (): React.ReactNode => {
  const [snapshot, setSnapshot] = useState<Extract<ProviderIntegrationsStatusResponse, { ok: true }> | null>(null);
  const [twitchChatStatus, setTwitchChatStatus] = useState<TwitchChatIntakeStatus | null>(null);
  const [youtubeCredential, setYouTubeCredential] = useState<YouTubeCredentialSummary | null>(null);
  const [youtubeRedirectUri, setYouTubeRedirectUri] = useState<string>("https://api-dev.maiks.yt/admin/provider-integrations/youtube/callback");
  const [youtubeRequiredScope, setYouTubeRequiredScope] = useState<string>("https://www.googleapis.com/auth/youtube.readonly");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string>("Loading provider integration status...");
  const [twitchActionMessage, setTwitchActionMessage] = useState<string>("Twitch chat intake status not loaded.");
  const [youtubeActionMessage, setYouTubeActionMessage] = useState<string>("YouTube owner consent not checked.");

  const stateCounts = useMemo(() => {
    const counts: Record<ProviderIntegrationState, number> = {
      configured: 0,
      missing: 0,
      invalid: 0,
      disabled: 0,
      error: 0
    };

    for (const provider of snapshot?.providers ?? []) {
      counts[provider.state] += 1;
    }

    return counts;
  }, [snapshot]);

  const loadStatus = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    setMessage("Loading provider integration status...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/status`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<ProviderIntegrationsStatusResponse>(response);

      if (response.ok && payload?.ok) {
        setSnapshot(payload);
        setLoadState("ready");
        setMessage("Provider integration status loaded.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState(getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Provider integration status request failed.");
    }
  }, []);

  const loadTwitchChatStatus = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/twitch-chat`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<TwitchChatIntakeResponse>(response);

      if (response.ok && payload?.ok) {
        setTwitchChatStatus(payload.status);
        setTwitchActionMessage("Twitch chat intake status loaded.");
        return;
      }

      setTwitchActionMessage(`Twitch chat intake status failed with ${response.status}.`);
    } catch (error) {
      setTwitchActionMessage(error instanceof Error ? error.message : "Twitch chat intake status failed.");
    }
  }, []);

  const loadYouTubeCredential = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/youtube/credential`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<YouTubeConsentResponse>(response);

      if (response.ok && payload?.ok) {
        setYouTubeCredential(payload.credential);
        setYouTubeRedirectUri(payload.redirectUri);
        setYouTubeRequiredScope(payload.requiredScope);
        setYouTubeActionMessage(payload.credential?.status === "active"
          ? "YouTube owner credential is active."
          : "YouTube owner credential is not connected yet.");
        return;
      }

      setYouTubeActionMessage(`YouTube credential status failed with ${response.status}.`);
    } catch (error) {
      setYouTubeActionMessage(error instanceof Error ? error.message : "YouTube credential status failed.");
    }
  }, []);

  const connectYouTube = useCallback(async (): Promise<void> => {
    setYouTubeActionMessage("Creating YouTube owner consent URL...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/youtube/consent-url`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<YouTubeConsentResponse>(response);

      if (response.ok && payload?.ok && payload.consentUrl) {
        setYouTubeCredential(payload.credential);
        setYouTubeRedirectUri(payload.redirectUri);
        setYouTubeRequiredScope(payload.requiredScope);
        setYouTubeActionMessage("Opening Google owner consent...");
        window.location.assign(payload.consentUrl);
        return;
      }

      const reason = payload?.ok === false ? payload.reason : "missing_consent_url";
      setYouTubeActionMessage(`YouTube owner consent failed: ${reason}.`);
    } catch (error) {
      setYouTubeActionMessage(error instanceof Error ? error.message : "YouTube owner consent failed.");
    }
  }, []);

  const runTwitchChatAction = useCallback(async (action: "start" | "stop"): Promise<void> => {
    setTwitchActionMessage(action === "start" ? "Starting Twitch chat intake..." : "Stopping Twitch chat intake...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/provider-integrations/twitch-chat/${action}`, {
        method: "POST",
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<TwitchChatIntakeResponse>(response);

      if (response.ok && payload?.ok) {
        setTwitchChatStatus(payload.status);
        setTwitchActionMessage(action === "start" ? "Twitch chat intake started." : "Twitch chat intake stopped.");
        await loadStatus();
        return;
      }

      setTwitchActionMessage(`Twitch chat intake ${action} failed with ${response.status}.`);
    } catch (error) {
      setTwitchActionMessage(error instanceof Error ? error.message : `Twitch chat intake ${action} failed.`);
    }
  }, [loadStatus]);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadStatus();
    void loadTwitchChatStatus();
    void loadYouTubeCredential();
  }, [loadStatus, loadTwitchChatStatus, loadYouTubeCredential]);

  return (
    <>
      <header className="project-admin-header">
        <p className="eyebrow">Owner status</p>
        <h1>Provider Integrations</h1>
        <p>Twitch, YouTube, and Discord configuration readiness.</p>
      </header>

      <section className={`project-admin-state ${loadState}`}>
        <div>
          <h2>{loadState === "ready" ? "Status" : loadState === "loading" ? "Loading" : "Needs attention"}</h2>
          <p>{message}</p>
        </div>
        <div className="project-admin-actions">
          <button type="button" onClick={() => void loadStatus()}>Refresh</button>
        </div>
      </section>

      {snapshot ? (
        <>
          <section className="provider-integrations-summary-grid" aria-label="Provider integration summary">
            <div className="live-helper-kpi">
              <span>Configured</span>
              <strong>{stateCounts.configured}</strong>
            </div>
            <div className="live-helper-kpi">
              <span>Missing</span>
              <strong>{stateCounts.missing}</strong>
            </div>
            <div className="live-helper-kpi">
              <span>Invalid</span>
              <strong>{stateCounts.invalid}</strong>
            </div>
            <div className="live-helper-kpi">
              <span>Disabled</span>
              <strong>{stateCounts.disabled}</strong>
            </div>
          </section>

          <section className="project-admin-panel">
            <div className="project-admin-panel-heading">
              <div>
                <h2>Twitch Chat Intake</h2>
                <p>Read-only dev connection for private streamer chat.</p>
              </div>
              <div className="project-admin-actions">
                <button
                  type="button"
                  disabled={twitchChatStatus?.state === "connected" || twitchChatStatus?.state === "connecting"}
                  onClick={() => void runTwitchChatAction("start")}
                >
                  Start
                </button>
                <button
                  type="button"
                  disabled={twitchChatStatus?.state === "stopped" || twitchChatStatus?.state === "unconfigured"}
                  onClick={() => void runTwitchChatAction("stop")}
                >
                  Stop
                </button>
                <button type="button" onClick={() => void loadTwitchChatStatus()}>Refresh</button>
              </div>
            </div>
            <div className="provider-chat-status-grid">
              <div className={`provider-chat-state ${twitchChatStatus?.state ?? "unconfigured"}`}>
                <span>State</span>
                <strong>{twitchChatStatus?.state ?? "Unknown"}</strong>
              </div>
              <div>
                <span>Channel</span>
                <strong>{twitchChatStatus?.channelName ?? "Not configured"}</strong>
              </div>
              <div>
                <span>Last message</span>
                <strong>{twitchChatStatus?.lastMessageAt ? formatDate(twitchChatStatus.lastMessageAt) : "None yet"}</strong>
              </div>
            </div>
            <p className="provider-chat-action-message">{twitchActionMessage}</p>
            {twitchChatStatus?.lastError ? (
              <p className="provider-chat-error">{twitchChatStatus.lastError}</p>
            ) : null}
            {twitchChatStatus?.recentMessages.length ? (
              <ol className="provider-chat-recent-list" aria-label="Recent Twitch chat messages">
                {twitchChatStatus.recentMessages.slice(0, 5).map((chatMessage) => (
                  <li key={chatMessage.id}>
                    <div>
                      <strong>{chatMessage.authorName}</strong>
                      <time dateTime={chatMessage.createdAt}>{formatDate(chatMessage.createdAt)}</time>
                    </div>
                    <p>{chatMessage.message}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="provider-chat-empty">No Twitch messages captured in this API runtime yet.</p>
            )}
          </section>

          <section className="project-admin-panel">
            <div className="project-admin-panel-heading">
              <div>
                <h2>YouTube Owner Consent</h2>
                <p>Read-only OAuth credential for future live-chat intake.</p>
              </div>
              <div className="project-admin-actions">
                <button type="button" onClick={() => void connectYouTube()}>Connect</button>
                <button type="button" onClick={() => void loadYouTubeCredential()}>Refresh</button>
              </div>
            </div>
            <div className="provider-chat-status-grid">
              <div className={`provider-chat-state ${youtubeCredential?.status ?? "unconfigured"}`}>
                <span>Credential</span>
                <strong>{youtubeCredential?.status ?? "Not connected"}</strong>
              </div>
              <div>
                <span>Last verified</span>
                <strong>{youtubeCredential?.lastVerifiedAt ? formatDate(youtubeCredential.lastVerifiedAt) : "Never"}</strong>
              </div>
              <div>
                <span>Scope</span>
                <strong>{youtubeRequiredScope}</strong>
              </div>
            </div>
            <p className="provider-chat-action-message">{youtubeActionMessage}</p>
            {youtubeCredential?.lastError ? (
              <p className="provider-chat-error">{youtubeCredential.lastError}</p>
            ) : null}
            <div className="provider-env-grid" aria-label="YouTube OAuth setup details">
              <div className="provider-env-item">
                <span>Google redirect URI</span>
                <strong>{youtubeRedirectUri}</strong>
                <small>Add this exact URI in Google OAuth before connecting.</small>
              </div>
            </div>
          </section>

          <section className="project-admin-panel">
            <div className="project-admin-panel-heading">
              <div>
                <h2>Provider Status</h2>
                <p>Generated {formatDate(snapshot.generatedAt)}</p>
              </div>
            </div>

            <div className="provider-integrations-list">
              {snapshot.providers.map((provider) => (
                <article className={`provider-integration-row ${provider.state}`} key={provider.id}>
                  <div className="provider-integration-heading">
                    <div>
                      <h3>{provider.label}</h3>
                      <p>{provider.sdk}</p>
                    </div>
                    <span className={`provider-integration-state ${provider.state}`}>
                      {stateLabels[provider.state]}
                    </span>
                  </div>

                  <div className="provider-env-grid" aria-label={`${provider.label} environment variables`}>
                    {provider.env.map((variable) => (
                      <div className="provider-env-item" key={variable.name}>
                        <span>{variable.name}</span>
                        <strong>{variable.configured ? "Present" : variable.required ? "Missing" : "Optional"}</strong>
                        <small>{variable.kind}{variable.required ? " required" : " optional"}</small>
                      </div>
                    ))}
                  </div>

                  {provider.issues.length > 0 ? (
                    <ul className="provider-issue-list" aria-label={`${provider.label} issues`}>
                      {provider.issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="provider-capability-row" aria-label={`${provider.label} foundation capabilities`}>
                    {provider.capabilities.map((capability) => (
                      <div className={`provider-capability-card ${capability.state}`} key={capability.key}>
                        <div>
                          <strong>{capability.label}</strong>
                          <span>{capabilityStateLabels[capability.state]}</span>
                        </div>
                        <p>{capability.detail}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="project-admin-panel">
            <div className="project-admin-panel-heading">
              <div>
                <h2>Boundaries</h2>
                <p>Current integration limits.</p>
              </div>
            </div>
            <ul className="live-helper-boundary-list">
              {snapshot.boundaries.map((boundary) => (
                <li key={boundary}>{boundary}</li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </>
  );
};

export default ProviderIntegrationsStatusClient;
