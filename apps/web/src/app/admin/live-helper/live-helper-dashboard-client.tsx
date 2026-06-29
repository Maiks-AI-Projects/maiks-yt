"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";

type LiveHelperPendingApprovalSummary = {
  id: string;
  eventHistoryId: string;
  eventKind: string;
  label: string;
  sourcePlatform: string;
  destination: string;
  notificationPriority: "low" | "normal" | "high" | "urgent";
  actorDisplayName: string | null;
  createdAt: string;
  occurredAt: string;
};

type LiveHelperNotificationSummary = {
  id: string;
  title: string;
  severity: "warning" | "critical";
  source: string;
  status: string;
  actionUrl: string | null;
  createdAt: string;
};

type LiveHelperActiveGrantSummary = {
  id: string;
  userId: string;
  displayName: string;
  roleKey: string;
  roleName: string;
  trustLevel: string;
  scopeKind: string;
  scopeId: string | null;
  availability: string;
  assignedAt: string;
  expiresAt: string | null;
};

type LiveHelperEventHistorySummary = {
  id: string;
  eventKind: string;
  label: string;
  sourcePlatform: string;
  routingOutcome: string;
  destination: string | null;
  actorDisplayName: string | null;
  isTest: boolean;
  isSimulated: boolean;
  occurredAt: string;
};

type LiveHelperFakeLocalModerationAuditSummary = {
  id: string;
  attemptedAt: string;
  source: "fake-local";
  actorDisplayName: string | null;
  action: string;
  outcome: string;
  reason: string | null;
  targetMessageId: string | null;
  targetAuthorName: string | null;
  durationSeconds: number | null;
  mutedUntil: string | null;
  note: string | null;
  providerAction: boolean;
};

type LiveHelperDashboardResponse =
  | {
    ok: true;
    generatedAt: string;
    readOnly: true;
    pendingApprovals: {
      count: number;
      items: readonly LiveHelperPendingApprovalSummary[];
    };
    notifications: {
      openWarningCount: number;
      openCriticalCount: number;
      items: readonly LiveHelperNotificationSummary[];
    };
    activeHelperGrants: {
      count: number;
      items: readonly LiveHelperActiveGrantSummary[];
    };
    recentSimulatedHistory: {
      items: readonly LiveHelperEventHistorySummary[];
    };
    fakeLocalModerationAudit: {
      items: readonly LiveHelperFakeLocalModerationAuditSummary[];
    };
    boundaries: readonly string[];
  }
  | {
    ok: false;
    reason: string;
  };

type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const formatDate = (value: string | null): string =>
  value
    ? new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value))
    : "None";

const formatCompactDate = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric"
  }).format(new Date(value));

const formatKey = (value: string): string =>
  value.replaceAll("_", " ").replaceAll("-", " ");

const getFailureMessage = (response: Response, reason?: string): string => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "Sign in before opening the live helper dashboard.";
  }

  if (response.status === 403 || reason === "live_helper_forbidden" || reason === "live_helper_user_unlinked") {
    return "Your account does not have live helper dashboard permission.";
  }

  return `Live helper dashboard request failed with ${response.status}.`;
};

const getLoadStateForFailure = (response: Response, reason?: string): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

  if (response.status === 403 || reason === "live_helper_forbidden" || reason === "live_helper_user_unlinked") {
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

const LiveHelperDashboardClient = (): React.ReactNode => {
  const [snapshot, setSnapshot] = useState<Extract<LiveHelperDashboardResponse, { ok: true }> | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string>("Loading live helper dashboard...");

  const totalOpenAlerts = useMemo(
    () => (snapshot?.notifications.openWarningCount ?? 0) + (snapshot?.notifications.openCriticalCount ?? 0),
    [snapshot]
  );

  const loadDashboard = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    setMessage("Loading live helper dashboard...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/live-helper`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<LiveHelperDashboardResponse>(response);

      if (response.ok && payload?.ok) {
        setSnapshot(payload);
        setLoadState("ready");
        setMessage("Read-only live helper dashboard loaded.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState(getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Live helper dashboard request failed.");
    }
  }, []);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <>
      <header className="project-admin-header">
        <p className="eyebrow">Read-only monitoring</p>
        <h1>Live Helper Dashboard</h1>
        <p>Monitor live queues, alerts, helper coverage, and safe simulated routing history without changing stream state.</p>
      </header>

      <section className={`project-admin-state ${loadState}`}>
        <div>
          <h2>{loadState === "ready" ? "Monitoring" : loadState === "loading" ? "Loading" : "Needs attention"}</h2>
          <p>{message}</p>
        </div>
        <div className="project-admin-actions">
          <button type="button" onClick={() => void loadDashboard()}>Refresh</button>
        </div>
      </section>

      {snapshot ? (
        <>
          <section className="live-helper-summary-grid" aria-label="Live helper summary">
            <div className="live-helper-kpi">
              <span>Pending approvals</span>
              <strong>{snapshot.pendingApprovals.count}</strong>
            </div>
            <div className="live-helper-kpi">
              <span>Open warnings</span>
              <strong>{snapshot.notifications.openWarningCount}</strong>
            </div>
            <div className="live-helper-kpi">
              <span>Open critical</span>
              <strong>{snapshot.notifications.openCriticalCount}</strong>
            </div>
            <div className="live-helper-kpi">
              <span>Active helpers</span>
              <strong>{snapshot.activeHelperGrants.count}</strong>
            </div>
          </section>

          <div className="project-admin-layout live-helper-layout">
            <section className="project-admin-workspace" aria-label="Live helper readout">
              <section className="project-admin-panel">
                <div className="project-admin-panel-heading">
                  <div>
                    <h2>Pending Event Approvals</h2>
                    <p>{snapshot.pendingApprovals.count} safe simulated/test item{snapshot.pendingApprovals.count === 1 ? "" : "s"} waiting.</p>
                  </div>
                  <span className="live-helper-pill">Read-only</span>
                </div>
                {snapshot.pendingApprovals.items.length === 0 ? (
                  <p className="project-admin-note">No pending safe simulated approvals.</p>
                ) : (
                  <ul className="project-admin-record-list">
                    {snapshot.pendingApprovals.items.map((approval) => (
                      <li key={approval.id}>
                        <div>
                          <strong>{approval.label}</strong>
                          <p>{approval.sourcePlatform} to {formatKey(approval.destination)} · {approval.notificationPriority} priority</p>
                          <p>{approval.actorDisplayName ?? "No public actor name"} · queued {formatCompactDate(approval.createdAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="project-admin-panel">
                <div className="project-admin-panel-heading">
                  <div>
                    <h2>Warning And Critical Alerts</h2>
                    <p>{totalOpenAlerts} open warning/critical notification{totalOpenAlerts === 1 ? "" : "s"}.</p>
                  </div>
                  <span className="live-helper-pill">Summaries only</span>
                </div>
                {snapshot.notifications.items.length === 0 ? (
                  <p className="project-admin-note">No current warning or critical notifications.</p>
                ) : (
                  <ul className="project-admin-record-list">
                    {snapshot.notifications.items.map((notification) => (
                      <li key={notification.id}>
                        <div>
                          <strong>{notification.title}</strong>
                          <p>{notification.severity} · {notification.source} · {notification.status}</p>
                          <p>{formatCompactDate(notification.createdAt)}{notification.actionUrl ? ` · ${notification.actionUrl}` : ""}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="project-admin-panel">
                <div className="project-admin-panel-heading">
                  <div>
                    <h2>Recent Simulated Routing</h2>
                    <p>Safe test/simulated history only; raw payloads are not shown.</p>
                  </div>
                </div>
                {snapshot.recentSimulatedHistory.items.length === 0 ? (
                  <p className="project-admin-note">No safe simulated routing history yet.</p>
                ) : (
                  <ul className="project-admin-record-list">
                    {snapshot.recentSimulatedHistory.items.map((event) => (
                      <li key={event.id}>
                        <div>
                          <strong>{event.label}</strong>
                          <p>{event.sourcePlatform} · {formatKey(event.routingOutcome)}{event.destination ? ` · ${formatKey(event.destination)}` : ""}</p>
                          <p>{event.actorDisplayName ?? "No public actor name"} · {formatCompactDate(event.occurredAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="project-admin-panel">
                <div className="project-admin-panel-heading">
                  <div>
                    <h2>Fake/Local Moderation Audit</h2>
                    <p>Local test command attempts only; no provider actions are shown or available.</p>
                  </div>
                  <span className="live-helper-pill">Read-only</span>
                </div>
                {snapshot.fakeLocalModerationAudit.items.length === 0 ? (
                  <p className="project-admin-note">No fake/local moderation command attempts yet.</p>
                ) : (
                  <ul className="project-admin-record-list">
                    {snapshot.fakeLocalModerationAudit.items.map((entry) => (
                      <li key={entry.id}>
                        <div>
                          <strong>{formatKey(entry.action)} · {formatKey(entry.outcome)}</strong>
                          <p>{entry.actorDisplayName ?? "Unknown actor"} · {entry.source} · provider action: {entry.providerAction ? "yes" : "no"}</p>
                          <p>
                            {entry.targetAuthorName ? `Author: ${entry.targetAuthorName}` : entry.targetMessageId ? `Message: ${entry.targetMessageId}` : "No target"}
                            {entry.durationSeconds ? ` · ${entry.durationSeconds}s` : ""}
                            {entry.mutedUntil ? ` · until ${formatCompactDate(entry.mutedUntil)}` : ""}
                          </p>
                          <p>{entry.note ?? entry.reason ?? "No note"}</p>
                          <p>{formatCompactDate(entry.attemptedAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </section>

            <aside className="project-admin-sidebar live-helper-sidebar" aria-label="Helper coverage and boundaries">
              <section className="project-admin-panel">
                <div className="project-admin-panel-heading">
                  <div>
                    <h2>Active Helper Grants</h2>
                    <p>Current non-owner helper/moderator access.</p>
                  </div>
                </div>
                {snapshot.activeHelperGrants.items.length === 0 ? (
                  <p className="project-admin-note">No active helper grants.</p>
                ) : (
                  <ul className="project-admin-record-list live-helper-compact-list">
                    {snapshot.activeHelperGrants.items.map((grant) => (
                      <li key={grant.id}>
                        <div>
                          <strong>{grant.displayName}</strong>
                          <p>{grant.roleName} · {formatKey(grant.trustLevel)}</p>
                          <p>{formatKey(grant.scopeKind)}{grant.scopeId ? ` / ${grant.scopeId}` : ""} · {formatKey(grant.availability)}</p>
                          <p>Expires: {formatDate(grant.expiresAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="project-admin-panel project-admin-note">
                <h2>Read-only Boundary</h2>
                <ul className="live-helper-boundary-list">
                  {snapshot.boundaries.map((boundary) => (
                    <li key={boundary}>{boundary}</li>
                  ))}
                </ul>
                <p>Snapshot generated {formatDate(snapshot.generatedAt)}.</p>
              </section>
            </aside>
          </div>
        </>
      ) : null}
    </>
  );
};

export default LiveHelperDashboardClient;
