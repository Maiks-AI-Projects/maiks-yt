"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";
import type {
  ConnectionsSource,
  ProcessingStatus,
  Provider,
  ProviderEventIntakeRow,
  ProviderIntakeHealthEntry
} from "./connections.types";

type IntakeResponse =
  | { ok: true; readOnly: true; rows: unknown[] }
  | { ok: false; reason: string };

type IntakeHealthResponse =
  | {
    ok: true;
    readOnly: true;
    generatedAt: string;
    staleAfterMinutes: number;
    entries: ProviderIntakeHealthEntry[];
  }
  | { ok: false; reason: string };

type ReviewResponse =
  | {
    ok: true;
    action: "map_internal" | "ignore";
    processingStatus: "ignored" | "mapped_to_event_history";
    publicPlayback: false;
  }
  | { ok: false; reason: string };

type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";
type CatalogFilter = "any" | "known" | "unknown";
type SafetyFilter = "any" | "money" | "moderation" | "auth-token" | "high-volume";
type StatusFilter = ProcessingStatus | "any";
type RowLimit = 25 | 50 | 100;

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.maiks.yt";

const providerLabels: Record<Provider, string> = {
  discord: "Discord",
  twitch: "Twitch",
  youtube: "YouTube"
};

const providerValues = new Set<Provider>(["discord", "twitch", "youtube"]);
const processingStatusValues = new Set<ProcessingStatus>([
  "stored",
  "normalized",
  "mapped_to_event_history",
  "ignored",
  "failed"
]);
const providerIntakeRowKeys = [
  "catalogKnown",
  "category",
  "internalTrigger",
  "mechanism",
  "occurredAt",
  "overlayEligibleByDefault",
  "processingStatus",
  "provider",
  "providerEventName",
  "receivedAt",
  "reviewRef",
  "reviewable",
  "safeSummary",
  "safetyFlags"
] as const;
const safetyFlagKeys = [
  "authOrTokenShaped",
  "highVolume",
  "moderationShaped",
  "moneyShaped"
] as const;

const nonProviderSourceLabels: Record<Extract<ConnectionsSource, "website">, string> = {
  website: "Website"
};

const isProvider = (source: ConnectionsSource): source is Provider =>
  source === "twitch" || source === "youtube" || source === "discord";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();

  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const isStringOrNull = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const parseSafetyFlags = (value: unknown): ProviderEventIntakeRow["safetyFlags"] | null => {
  if (!isRecord(value) || !hasExactKeys(value, safetyFlagKeys)) {
    return null;
  }

  if (
    typeof value.authOrTokenShaped !== "boolean"
    || typeof value.highVolume !== "boolean"
    || typeof value.moderationShaped !== "boolean"
    || typeof value.moneyShaped !== "boolean"
  ) {
    return null;
  }

  return {
    authOrTokenShaped: value.authOrTokenShaped,
    highVolume: value.highVolume,
    moderationShaped: value.moderationShaped,
    moneyShaped: value.moneyShaped
  };
};

const parseProviderEventIntakeRow = (value: unknown): ProviderEventIntakeRow | null => {
  if (!isRecord(value) || !hasExactKeys(value, providerIntakeRowKeys)) {
    return null;
  }

  const provider = value.provider;
  const processingStatus = value.processingStatus;
  const safetyFlags = parseSafetyFlags(value.safetyFlags);

  if (
    typeof provider !== "string"
    || !providerValues.has(provider as Provider)
    || typeof processingStatus !== "string"
    || !processingStatusValues.has(processingStatus as ProcessingStatus)
    || typeof value.catalogKnown !== "boolean"
    || typeof value.category !== "string"
    || typeof value.internalTrigger !== "string"
    || typeof value.mechanism !== "string"
    || !isStringOrNull(value.occurredAt)
    || value.overlayEligibleByDefault !== false
    || typeof value.providerEventName !== "string"
    || typeof value.receivedAt !== "string"
    || typeof value.reviewRef !== "string"
    || typeof value.reviewable !== "boolean"
    || typeof value.safeSummary !== "string"
    || !safetyFlags
  ) {
    return null;
  }

  return {
    catalogKnown: value.catalogKnown,
    category: value.category,
    internalTrigger: value.internalTrigger,
    mechanism: value.mechanism,
    occurredAt: value.occurredAt,
    overlayEligibleByDefault: false,
    processingStatus: processingStatus as ProcessingStatus,
    provider: provider as Provider,
    providerEventName: value.providerEventName,
    receivedAt: value.receivedAt,
    reviewRef: value.reviewRef,
    reviewable: value.reviewable,
    safeSummary: value.safeSummary,
    safetyFlags
  };
};

const parseProviderEventIntakeRows = (value: unknown[]): ProviderEventIntakeRow[] | null => {
  const rows: ProviderEventIntakeRow[] = [];

  for (const item of value) {
    const row = parseProviderEventIntakeRow(item);
    if (!row) return null;
    rows.push(row);
  }

  return rows;
};

const formatTime = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

const formatRelativeTime = (value: string): string => {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
};

const statusLabel = (status: ProcessingStatus): string => {
  if (status === "mapped_to_event_history") return "mapped";
  return status;
};

const getFailureState = (response: Response, reason?: string): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") return "signed-out";
  if (response.status === 403 || reason?.includes("forbidden")) return "forbidden";
  return "failed";
};

const safetyBadges = (row: ProviderEventIntakeRow): string[] => {
  const badges: string[] = [row.catalogKnown ? "known" : "unknown"];
  if (row.safetyFlags.moneyShaped) badges.push("money");
  if (row.safetyFlags.moderationShaped) badges.push("moderation");
  if (row.safetyFlags.authOrTokenShaped) badges.push("auth/token");
  if (row.safetyFlags.highVolume) badges.push("high-volume");
  return badges;
};

const ProviderIntakeRecentClient = ({
  source,
  onSourceChange
}: {
  source: ConnectionsSource;
  onSourceChange: (source: ConnectionsSource) => void;
}): React.ReactNode => {
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>("any");
  const [healthEntries, setHealthEntries] = useState<ProviderIntakeHealthEntry[]>([]);
  const [limit, setLimit] = useState<RowLimit>(25);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<ProviderEventIntakeRow[]>([]);
  const [safetyFilter, setSafetyFilter] = useState<SafetyFilter>("any");
  const [selectedReviewRef, setSelectedReviewRef] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("any");

  useEffect(() => {
    captureDevAuthTokenFromUrl();
  }, []);

  const hasProviderHistory = source === "any" || isProvider(source);

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({ limit: String(limit) });

    if (isProvider(source)) params.set("provider", source);
    if (statusFilter !== "any") params.set("processingStatus", statusFilter);
    if (catalogFilter !== "any") params.set("catalogKnown", String(catalogFilter === "known"));
    if (safetyFilter === "money") params.set("moneyShaped", "true");
    if (safetyFilter === "moderation") params.set("moderationShaped", "true");
    if (safetyFilter === "auth-token") params.set("authOrTokenShaped", "true");
    if (safetyFilter === "high-volume") params.set("highVolume", "true");

    return `${apiBaseUrl}/admin/connections/intake?${params.toString()}`;
  }, [catalogFilter, limit, safetyFilter, source, statusFilter]);

  const loadRows = useCallback(async () => {
    setLoadState("loading");
    setReviewMessage(null);

    if (!hasProviderHistory) {
      setRows([]);
      setSelectedReviewRef(null);
    }

    try {
      const headers = createApiHeaders();
      const healthRequest = fetch(`${apiBaseUrl}/admin/connections/intake/health`, {
        cache: "no-store",
        credentials: "include",
        headers
      });

      const rowsRequest = hasProviderHistory
        ? fetch(requestUrl, {
          cache: "no-store",
          credentials: "include",
          headers
        })
        : null;

      const healthResponse = await healthRequest;
      const healthPayload = await healthResponse.json() as IntakeHealthResponse;
      setHealthEntries(healthResponse.ok && healthPayload.ok ? healthPayload.entries : []);

      if (!rowsRequest) {
        setRows([]);
        setLoadState("ready");
        return;
      }

      const response = await rowsRequest;
      const payload = await response.json() as IntakeResponse;

      if (!response.ok || !payload.ok) {
        setRows([]);
        setLoadState(getFailureState(response, payload.ok ? undefined : payload.reason));
        return;
      }

      const parsedRows = parseProviderEventIntakeRows(payload.rows);

      if (!parsedRows) {
        setRows([]);
        setLoadState("failed");
        return;
      }

      setRows(parsedRows);
      setLoadState("ready");
    } catch {
      setHealthEntries([]);
      setRows([]);
      setLoadState("failed");
    }
  }, [hasProviderHistory, requestUrl]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const reviewRow = useCallback(async (
    row: ProviderEventIntakeRow,
    action: "map_internal" | "ignore"
  ) => {
    setReviewMessage(action === "map_internal"
      ? "Mapping the event to internal audit..."
      : "Marking the event ignored...");

    try {
      const response = await fetch(
        `${apiBaseUrl}/admin/connections/intake/${encodeURIComponent(row.reviewRef)}/review`,
        {
          body: JSON.stringify({ action }),
          cache: "no-store",
          credentials: "include",
          headers: createApiHeaders({ "Content-Type": "application/json" }),
          method: "POST"
        }
      );
      const payload = await response.json() as ReviewResponse;

      if (!response.ok || !payload.ok) {
        setReviewMessage(payload.ok
          ? `Review failed with ${response.status}.`
          : `Review blocked: ${payload.reason}`);
        return;
      }

      setRows((currentRows) => currentRows.map((currentRow) =>
        currentRow.reviewRef === row.reviewRef
          ? {
            ...currentRow,
            processingStatus: payload.processingStatus,
            reviewable: false
          }
          : currentRow
      ));
      setReviewMessage(payload.action === "map_internal"
        ? "Mapped to internal audit."
        : "Event marked ignored.");
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : "Review action failed.");
    }
  }, []);

  const selectedRow = rows.find((row) => row.reviewRef === selectedReviewRef) ?? rows[0] ?? null;
  const reviewDisabled = selectedRow ? !selectedRow.reviewable : true;

  return (
    <section className="connections-intake-panel" aria-label="Observed provider event intake">
      <div className="connections-health-heading">
        <h2>Mechanism health</h2>
        <p>Latest received event for each provider receiver.</p>
      </div>

      {healthEntries.length > 0 ? (
        <div className="connections-health-strip">
          {healthEntries.map((entry) => (
            <article key={`${entry.provider}:${entry.mechanism}`}>
              <div>
                <span className={`service-dot ${entry.status === "healthy" ? "connected" : entry.status === "stale" ? "warning" : "disconnected"}`} aria-hidden="true" />
                <strong>{entry.label}</strong>
              </div>
              <span>{entry.status}</span>
              <small>{entry.lastReceivedAt
                ? `${entry.lastProviderEventName ?? "event"} · ${formatRelativeTime(entry.lastReceivedAt)}`
                : "No rows captured"}</small>
              <small>{entry.rowCount.toLocaleString()} stored row{entry.rowCount === 1 ? "" : "s"}</small>
            </article>
          ))}
        </div>
      ) : (
        <div className="connections-health-empty">
          {loadState === "loading" ? "Loading mechanism health..." : "Mechanism health is unavailable."}
        </div>
      )}

      <div className="connections-intake-layout">
        <section className="connections-history" aria-labelledby="connections-history-title">
          <div className="connections-section-heading">
            <div>
              <h2 id="connections-history-title">Observed history</h2>
              <p>Latest received provider events.</p>
            </div>
          </div>

          <div className="connections-intake-controls">
            <select aria-label="Filter event source" value={source} onChange={(event) => onSourceChange(event.target.value as ConnectionsSource)}>
              <option value="any">All sources</option>
              <option value="twitch">Twitch</option>
              <option value="youtube">YouTube</option>
              <option value="discord">Discord</option>
              <option value="website">Website</option>
            </select>
            <select aria-label="Filter processing status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="any">All statuses</option>
              <option value="stored">Stored</option>
              <option value="normalized">Normalized</option>
              <option value="mapped_to_event_history">Mapped internal</option>
              <option value="ignored">Ignored</option>
              <option value="failed">Failed</option>
            </select>
            <select aria-label="Filter catalogue recognition" value={catalogFilter} onChange={(event) => setCatalogFilter(event.target.value as CatalogFilter)}>
              <option value="any">Known + unknown</option>
              <option value="known">Known only</option>
              <option value="unknown">Unknown only</option>
            </select>
            <select aria-label="Filter safety flags" value={safetyFilter} onChange={(event) => setSafetyFilter(event.target.value as SafetyFilter)}>
              <option value="any">All safety flags</option>
              <option value="money">Money-shaped</option>
              <option value="moderation">Moderation-shaped</option>
              <option value="auth-token">Auth/token-shaped</option>
              <option value="high-volume">High-volume</option>
            </select>
            <select aria-label="Number of intake rows" value={limit} onChange={(event) => setLimit(Number(event.target.value) as RowLimit)}>
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>
            <button aria-label="Refresh observed history" className="connections-icon-button" onClick={() => void loadRows()} type="button">
              <FiRefreshCw aria-hidden="true" />
            </button>
            <button className="connections-filter-link" onClick={() => setStatusFilter("failed")} type="button">Show failed</button>
          </div>

          {reviewMessage ? <p className="connections-review-message" role="status">{reviewMessage}</p> : null}

          {!hasProviderHistory ? (
            <div className="connections-empty-state">
              <strong>{nonProviderSourceLabels[source as "website"]} event types are registered in the catalogue.</strong>
              <span>The current provider-intake API does not expose observed history for this source yet.</span>
            </div>
          ) : null}
          {hasProviderHistory && loadState === "loading" ? <div className="connections-empty-state">Loading observed history...</div> : null}
          {hasProviderHistory && loadState === "signed-out" ? <div className="connections-empty-state warning">Sign in to view observed history.</div> : null}
          {hasProviderHistory && loadState === "forbidden" ? <div className="connections-empty-state warning">Your account cannot view observed history.</div> : null}
          {hasProviderHistory && loadState === "failed" ? <div className="connections-empty-state warning">Observed history is unavailable.</div> : null}
          {hasProviderHistory && loadState === "ready" && rows.length === 0 ? <div className="connections-empty-state">No intake rows match these filters.</div> : null}

          {hasProviderHistory && rows.length > 0 ? (
            <>
              <div className="connections-table-scroll">
                <table className="connections-data-table connections-history-table">
                  <thead><tr><th>Received</th><th>Source / event</th><th>Mechanism</th><th>Trigger</th><th>Safety</th><th>Status</th></tr></thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr className={selectedRow?.reviewRef === row.reviewRef ? "selected" : undefined} key={row.reviewRef}>
                        <td><time dateTime={row.receivedAt} title={formatDate(row.receivedAt)}>{formatTime(row.receivedAt)}</time></td>
                        <td>
                          <button className="connections-row-select" onClick={() => setSelectedReviewRef(row.reviewRef)} type="button">
                            <strong>{providerLabels[row.provider]}</strong>
                            <span>{row.providerEventName}</span>
                          </button>
                        </td>
                        <td>{row.mechanism}</td>
                        <td><code>{row.internalTrigger}</code></td>
                        <td><div className="connections-badges">{safetyBadges(row).map((badge) => <span key={badge}>{badge}</span>)}</div></td>
                        <td><span className={`connections-status ${row.processingStatus}`}>{statusLabel(row.processingStatus)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="connections-row-count">Showing the latest {rows.length} row{rows.length === 1 ? "" : "s"}</p>
            </>
          ) : null}
        </section>

        <aside className="connections-inspection" aria-labelledby="connections-inspection-title">
          <h2 id="connections-inspection-title">Safe inspection</h2>
          {selectedRow ? (
            <>
              <dl>
                <dt>Source</dt><dd>{providerLabels[selectedRow.provider]}</dd>
                <dt>Event</dt><dd>{selectedRow.providerEventName}</dd>
                <dt>Mechanism</dt><dd>{selectedRow.mechanism}</dd>
                <dt>Trigger</dt><dd><code>{selectedRow.internalTrigger}</code></dd>
                <dt>Category</dt><dd>{selectedRow.category}</dd>
                <dt>Received</dt><dd>{formatDate(selectedRow.receivedAt)}</dd>
                <dt>Occurred</dt><dd>{selectedRow.occurredAt ? formatDate(selectedRow.occurredAt) : "—"}</dd>
                <dt>Catalogue</dt><dd>{selectedRow.catalogKnown ? "known" : "unknown"}</dd>
                <dt>Processing</dt><dd><span className={`connections-status ${selectedRow.processingStatus}`}>{statusLabel(selectedRow.processingStatus)}</span></dd>
              </dl>

              <p className="connections-intake-summary">{selectedRow.safeSummary}</p>

              <div className="connections-badges connections-inspection-badges">
                {safetyBadges(selectedRow).map((badge) => <span key={badge}>{badge}</span>)}
              </div>

              <div className="connections-review-actions">
                <button className="connections-primary-action" disabled={reviewDisabled} onClick={() => void reviewRow(selectedRow, "map_internal")} type="button">Map internal</button>
                <button className="secondary-action" disabled={reviewDisabled} onClick={() => void reviewRow(selectedRow, "ignore")} type="button">Ignore</button>
              </div>
              <p>Internal review only. No public playback or provider write.</p>
            </>
          ) : (
            <div className="connections-inspection-empty">Select an observed event to inspect its sanitized fields.</div>
          )}
        </aside>
      </div>
    </section>
  );
};

export default ProviderIntakeRecentClient;
