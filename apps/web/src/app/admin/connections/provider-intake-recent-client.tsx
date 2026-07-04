"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";

type Provider = "twitch" | "youtube" | "discord";
type ProcessingStatus = "stored" | "normalized" | "mapped_to_event_history" | "ignored" | "failed";

type ProviderEventIntakeRow = {
  id: string;
  provider: Provider;
  mechanism: string;
  providerEventName: string;
  internalTrigger: string;
  category: string;
  providerChannelId: string | null;
  actorDisplayName: string | null;
  catalogKnown: boolean;
  moneyShaped: boolean;
  moderationShaped: boolean;
  authOrTokenShaped: boolean;
  highVolume: boolean;
  processingStatus: ProcessingStatus;
  redactedPayloadPreview: Record<string, unknown>;
  occurredAt: string | null;
  receivedAt: string;
};

type IntakeResponse =
  | {
    ok: true;
    readOnly: true;
    rows: ProviderEventIntakeRow[];
  }
  | {
    ok: false;
    reason: string;
  };

type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const providerLabels: Record<Provider, string> = {
  discord: "Discord",
  twitch: "Twitch",
  youtube: "YouTube"
};

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

const summarizePayload = (payload: Record<string, unknown>): string => {
  const message = payload.message;
  if (typeof message === "string" && message.trim()) {
    return message.trim().slice(0, 140);
  }

  const keys = Object.keys(payload).slice(0, 5);
  return keys.length > 0 ? keys.join(", ") : "No preview fields";
};

const getFailureState = (response: Response, reason?: string): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

  if (response.status === 403 || reason?.includes("forbidden")) {
    return "forbidden";
  }

  return "failed";
};

const ProviderIntakeRecentClient = (): React.ReactNode => {
  const [filter, setFilter] = useState<Provider | "any">("any");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [rows, setRows] = useState<ProviderEventIntakeRow[]>([]);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
  }, []);

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({
      limit: "25"
    });

    if (filter !== "any") {
      params.set("provider", filter);
    }

    return `${apiBaseUrl}/admin/connections/intake?${params.toString()}`;
  }, [filter]);

  const loadRows = useCallback(async () => {
    setLoadState("loading");
    try {
      const response = await fetch(requestUrl, {
        cache: "no-store",
        credentials: "include",
        headers: createApiHeaders()
      });
      const payload = await response.json() as IntakeResponse;

      if (!response.ok || !payload.ok) {
        setRows([]);
        setLoadState(getFailureState(response, payload.ok ? undefined : payload.reason));
        return;
      }

      setRows([...payload.rows]);
      setLoadState("ready");
    } catch {
      setRows([]);
      setLoadState("failed");
    }
  }, [requestUrl]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  return (
    <section className="project-admin-panel connections-intake-panel">
      <div className="project-admin-panel-heading">
        <div>
          <h2>Recently Received Events</h2>
          <p>Pre-routing provider intake rows. This panel is read-only.</p>
        </div>
        <div className="connections-intake-controls">
          <select
            aria-label="Filter provider intake rows"
            value={filter}
            onChange={(event) => setFilter(event.target.value as Provider | "any")}
          >
            <option value="any">All providers</option>
            <option value="twitch">Twitch</option>
            <option value="youtube">YouTube</option>
            <option value="discord">Discord</option>
          </select>
          <button className="secondary-action" type="button" onClick={() => void loadRows()}>
            Refresh
          </button>
        </div>
      </div>

      {loadState === "loading" ? (
        <p className="form-note">Loading recent intake rows...</p>
      ) : null}
      {loadState === "signed-out" ? (
        <p className="form-note warning">Sign in to view recent provider intake rows.</p>
      ) : null}
      {loadState === "forbidden" ? (
        <p className="form-note warning">Your account cannot view provider intake rows.</p>
      ) : null}
      {loadState === "failed" ? (
        <p className="form-note warning">Provider intake rows are unavailable.</p>
      ) : null}
      {loadState === "ready" && rows.length === 0 ? (
        <p className="form-note">No provider intake rows captured yet.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="connections-intake-list">
          {rows.map((row) => (
            <article className="connections-intake-row" key={row.id}>
              <div>
                <strong>{providerLabels[row.provider]} / {row.providerEventName}</strong>
                <span>{row.actorDisplayName ?? "Unknown actor"} - {row.providerChannelId ?? "unknown channel"}</span>
                <code>{row.internalTrigger}</code>
              </div>
              <p>{summarizePayload(row.redactedPayloadPreview)}</p>
              <div className="dev-test-console-badges">
                <span>{row.catalogKnown ? "known" : "unknown"}</span>
                <span>{row.processingStatus}</span>
                {row.moneyShaped ? <span className="warning">money</span> : null}
                {row.moderationShaped ? <span className="warning">moderation</span> : null}
                {row.authOrTokenShaped ? <span className="warning">auth/token</span> : null}
                {row.highVolume ? <span className="warning">high-volume</span> : null}
                <span>{formatDate(row.receivedAt)}</span>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
};

export default ProviderIntakeRecentClient;
