"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";

type ProviderIntegrationState = "configured" | "missing" | "invalid" | "disabled" | "error";

type ProviderEnvironmentVariableStatus = {
  name: string;
  kind: "identifier" | "secret";
  required: boolean;
  configured: boolean;
  valid: boolean;
};

type ProviderIntegrationStatus = {
  id: "twitch" | "youtube" | "discord";
  label: string;
  state: ProviderIntegrationState;
  sdk: string;
  readOnly: true;
  env: readonly ProviderEnvironmentVariableStatus[];
  issues: readonly string[];
  capabilities: readonly string[];
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

type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const stateLabels: Record<ProviderIntegrationState, string> = {
  configured: "Configured",
  missing: "Missing",
  invalid: "Invalid",
  disabled: "Disabled",
  error: "Error"
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
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string>("Loading provider integration status...");

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

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadStatus();
  }, [loadStatus]);

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
                      <span className="live-helper-pill" key={capability}>{capability}</span>
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
