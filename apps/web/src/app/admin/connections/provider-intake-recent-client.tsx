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
  eventHistoryId: string | null;
  redactedPayloadPreview: Record<string, unknown>;
  occurredAt: string | null;
  receivedAt: string;
};

type ProviderIntakeHealthStatus = "healthy" | "stale" | "missing";

type ProviderIntakeHealthEntry = {
  provider: Provider;
  mechanism: string;
  label: string;
  lastProviderEventName: string | null;
  lastReceivedAt: string | null;
  rowCount: number;
  status: ProviderIntakeHealthStatus;
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

type IntakeHealthResponse =
  | {
    ok: true;
    readOnly: true;
    generatedAt: string;
    staleAfterMinutes: number;
    entries: ProviderIntakeHealthEntry[];
  }
  | {
    ok: false;
    reason: string;
  };

type ReviewResponse =
  | {
    ok: true;
    action: "map_internal" | "ignore";
    rowId: string;
    processingStatus: "ignored" | "mapped_to_event_history";
    publicPlayback: false;
    eventHistory: {
      id: string;
      eventKind: string;
      destination: "internal_audit";
    } | null;
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
  const [healthEntries, setHealthEntries] = useState<ProviderIntakeHealthEntry[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reviewMessage, setReviewMessage] = useState<string>("Review actions stay internal-only until Event Routing rules explicitly allow more.");
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
      const headers = createApiHeaders();
      const [healthResponse, response] = await Promise.all([
        fetch(`${apiBaseUrl}/admin/connections/intake/health`, {
          cache: "no-store",
          credentials: "include",
          headers
        }),
        fetch(requestUrl, {
          cache: "no-store",
          credentials: "include",
          headers
        })
      ]);
      const healthPayload = await healthResponse.json() as IntakeHealthResponse;
      const payload = await response.json() as IntakeResponse;

      if (!healthResponse.ok || !healthPayload.ok) {
        setHealthEntries([]);
      } else {
        setHealthEntries(healthPayload.entries);
      }

      if (!response.ok || !payload.ok) {
        setRows([]);
        setLoadState(getFailureState(response, payload.ok ? undefined : payload.reason));
        return;
      }

      setRows([...payload.rows]);
      setLoadState("ready");
    } catch {
      setHealthEntries([]);
      setRows([]);
      setLoadState("failed");
    }
  }, [requestUrl]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const reviewRow = useCallback(async (row: ProviderEventIntakeRow, action: "map_internal" | "ignore") => {
    setReviewMessage(action === "map_internal" ? "Mapping intake row to internal audit..." : "Marking intake row ignored...");
    try {
      const response = await fetch(`${apiBaseUrl}/admin/connections/intake/${encodeURIComponent(row.id)}/review`, {
        body: JSON.stringify({ action }),
        cache: "no-store",
        credentials: "include",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        method: "POST"
      });
      const payload = await response.json() as ReviewResponse;

      if (!response.ok || !payload.ok) {
        setReviewMessage(payload.ok ? `Review failed with ${response.status}.` : `Review blocked: ${payload.reason}`);
        return;
      }

      setRows((currentRows) => currentRows.map((currentRow) =>
        currentRow.id === payload.rowId
          ? {
            ...currentRow,
            eventHistoryId: payload.eventHistory?.id ?? currentRow.eventHistoryId,
            processingStatus: payload.processingStatus
          }
          : currentRow
      ));
      setReviewMessage(payload.action === "map_internal"
        ? `Mapped to ${payload.eventHistory?.eventKind ?? "internal event"} as internal audit.`
        : "Intake row marked ignored.");
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : "Review action failed.");
    }
  }, []);

  return (
    <section className="project-admin-panel connections-intake-panel">
      <div className="project-admin-panel-heading">
        <div>
          <h2>Provider Intake Health</h2>
          <p>Latest received rows by intake mechanism. Quiet mechanisms are not routed anywhere automatically.</p>
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
      <p className="form-note">{reviewMessage}</p>

      {healthEntries.length > 0 ? (
        <div className="connections-intake-health-grid">
          {healthEntries.map((entry) => (
            <article className="connections-intake-health-card" key={`${entry.provider}:${entry.mechanism}`}>
              <div>
                <span className={`service-dot ${entry.status === "healthy" ? "connected" : entry.status === "stale" ? "warning" : "disconnected"}`} aria-hidden="true" />
                <strong>{entry.label}</strong>
              </div>
              <span>{entry.status}</span>
              <small>
                {entry.lastReceivedAt
                  ? `${entry.lastProviderEventName ?? "event"} - ${formatDate(entry.lastReceivedAt)}`
                  : "No rows captured"}
              </small>
              <small>{entry.rowCount} stored row{entry.rowCount === 1 ? "" : "s"}</small>
            </article>
          ))}
        </div>
      ) : null}

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
                {row.eventHistoryId ? <span>event history</span> : null}
                {row.moneyShaped ? <span className="warning">money</span> : null}
                {row.moderationShaped ? <span className="warning">moderation</span> : null}
                {row.authOrTokenShaped ? <span className="warning">auth/token</span> : null}
                {row.highVolume ? <span className="warning">high-volume</span> : null}
                <span>{formatDate(row.receivedAt)}</span>
              </div>
              <div className="connections-intake-row-actions">
                <button
                  className="secondary-action"
                  disabled={Boolean(row.eventHistoryId) || row.processingStatus === "mapped_to_event_history" || row.processingStatus === "ignored"}
                  type="button"
                  onClick={() => void reviewRow(row, "map_internal")}
                >
                  Map internal
                </button>
                <button
                  className="secondary-action"
                  disabled={Boolean(row.eventHistoryId) || row.processingStatus === "mapped_to_event_history" || row.processingStatus === "ignored"}
                  type="button"
                  onClick={() => void reviewRow(row, "ignore")}
                >
                  Ignore
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
};

export default ProviderIntakeRecentClient;
