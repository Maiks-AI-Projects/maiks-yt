"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ActionItem,
  ActionItemDecision,
  ActionItemStatus
} from "@maiks-yt/domain/actions";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../dev-auth-token";

type ActionPanelItem = ActionItem & {
  updatedAt: string;
  canDecide: boolean;
  allowedDecisions: ActionItemDecision[];
};

type ActionPanelHistoryEntry = {
  id: string;
  actionId: string;
  actionTitle: string;
  decision: ActionItemDecision;
  previousStatus: ActionItemStatus;
  newStatus: ActionItemStatus;
  actor: {
    id: string;
    displayName: string;
  };
  note?: string;
  createdAt: string;
};

type ActionPanelListSuccess = {
  ok: true;
  live: boolean;
  active: ActionPanelItem[];
  history: ActionPanelHistoryEntry[];
  historyLimit: number;
};

type ActionPanelFailureReason =
  | "action_panel_user_unlinked"
  | "action_panel_view_forbidden"
  | "action_panel_unavailable"
  | "action_item_decision_forbidden"
  | "action_item_not_found"
  | "action_item_status_conflict"
  | "action_item_transition_conflict"
  | "action_item_decision_unavailable"
  | "invalid_action_decision_request"
  | "invalid_action_query"
  | "not_authenticated";

type ActionPanelFailure = {
  ok: false;
  reason: ActionPanelFailureReason;
};

type ActionPanelDecisionSuccess = {
  ok: true;
  item: ActionPanelItem;
};

type ActionPanelResponse = ActionPanelListSuccess | ActionPanelFailure;
type ActionPanelDecisionResponse = ActionPanelDecisionSuccess | ActionPanelFailure;

type LoadState = "loading" | "ready" | "signed-out" | "unlinked" | "forbidden" | "failed";

type ActionPanelClientProps = {
  liveMode: boolean;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const actionStatusLabels = {
  approved: "Approved",
  completed: "Completed",
  deferred: "Deferred",
  open: "Open",
  rejected: "Rejected"
} satisfies Record<ActionItemStatus, string>;

const actionDecisionLabels = {
  approve: "Approve",
  defer: "Defer",
  reject: "Reject"
} satisfies Record<ActionItemDecision, string>;

const actionDecisionPastLabels = {
  approve: "approved",
  defer: "deferred",
  reject: "rejected"
} satisfies Record<ActionItemDecision, string>;

const actionDecisionOrder = ["approve", "defer", "reject"] satisfies ActionItemDecision[];

const getLiveModeHref = (liveMode: boolean): string => liveMode ? "/actions" : "/actions?live=1";

const formatDateTime = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
};

const getFailureMessage = (reason: ActionPanelFailureReason): string => {
  switch (reason) {
    case "not_authenticated":
      return "Sign in to review Action Panel items.";
    case "action_panel_user_unlinked":
      return "Your signed-in account is not linked to a Maiks.yt domain user yet.";
    case "action_panel_view_forbidden":
      return "Your account is linked, but it does not have permission to view the Action Panel.";
    case "action_item_decision_forbidden":
      return "That decision is no longer allowed for your account.";
    case "action_item_not_found":
      return "That action item no longer exists.";
    case "action_item_status_conflict":
    case "action_item_transition_conflict":
      return "That action changed before your decision was saved. The list has been refreshed.";
    case "invalid_action_decision_request":
      return "The decision could not be saved because the request was invalid.";
    case "invalid_action_query":
      return "The Action Panel filter is invalid.";
    case "action_item_decision_unavailable":
    case "action_panel_unavailable":
      return "The Action Panel API is temporarily unavailable.";
  }
};

const getLoadStateForFailure = (response: Response, reason?: ActionPanelFailureReason): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

  if (reason === "action_panel_user_unlinked") {
    return "unlinked";
  }

  if (response.status === 403 || reason === "action_panel_view_forbidden") {
    return "forbidden";
  }

  return "failed";
};

const parseActionPanelResponse = async <ResponseBody,>(response: Response): Promise<ResponseBody | null> => {
  try {
    return await response.json() as ResponseBody;
  } catch {
    return null;
  }
};

const ActionPanelClient = ({ liveMode }: ActionPanelClientProps): React.ReactNode => {
  const [panel, setPanel] = useState<ActionPanelListSuccess | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string>("Loading Action Panel...");
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [busyDecision, setBusyDecision] = useState<string | null>(null);
  const [staleMessage, setStaleMessage] = useState<string | null>(null);

  const loadActions = useCallback(async (options: {
    keepPanel?: boolean;
    preserveStaleMessage?: boolean;
  } = {}): Promise<void> => {
    const keepPanel = options.keepPanel === true;
    const preserveStaleMessage = options.preserveStaleMessage === true;

    if (keepPanel) {
      setRefreshing(true);
    } else {
      setLoadState("loading");
      setMessage("Loading Action Panel...");
    }

    try {
      const response = await fetch(`${apiBaseUrl}/actions?live=${liveMode ? "true" : "false"}`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const data = await parseActionPanelResponse<ActionPanelResponse>(response);

      if (response.ok && data?.ok) {
        setPanel(data);
        if (!preserveStaleMessage) {
          setStaleMessage(null);
        }
        setLoadState("ready");
        setMessage(data.active.length === 0 ? "No active actions for this view." : "Action Panel loaded.");
        return;
      }

      const reason = data?.ok === false ? data.reason : undefined;
      setPanel(null);
      setLoadState(getLoadStateForFailure(response, reason));
      setMessage(reason ? getFailureMessage(reason) : `Action Panel request failed with ${response.status}.`);
    } catch (error) {
      setPanel(null);
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Action Panel request failed.");
    } finally {
      setRefreshing(false);
    }
  }, [liveMode]);

  const decideAction = async (item: ActionPanelItem, decision: ActionItemDecision): Promise<void> => {
    const decisionKey = `${item.id}:${decision}`;
    setBusyDecision(decisionKey);
    setStaleMessage(null);
    setMessage(`Saving ${actionDecisionPastLabels[decision]} decision...`);

    try {
      const response = await fetch(`${apiBaseUrl}/actions/${encodeURIComponent(item.id)}/decision`, {
        method: "POST",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        credentials: "include",
        body: JSON.stringify({
          decision,
          expectedStatus: item.status
        })
      });
      const data = await parseActionPanelResponse<ActionPanelDecisionResponse>(response);

      if (response.ok && data?.ok) {
        setMessage("Decision saved. Refreshing the persisted inbox...");
        await loadActions({ keepPanel: true });
        return;
      }

      const reason = data?.ok === false ? data.reason : undefined;
      const nextMessage = reason ? getFailureMessage(reason) : `Decision failed with ${response.status}.`;

      if (response.status === 409) {
        setStaleMessage(nextMessage);
        setMessage(nextMessage);
        await loadActions({ keepPanel: true, preserveStaleMessage: true });
        return;
      }

      if (response.status === 403 && reason === "action_item_decision_forbidden") {
        setMessage(nextMessage);
        await loadActions({ keepPanel: true });
        return;
      }

      if (response.status === 401 || response.status === 403) {
        setLoadState(getLoadStateForFailure(response, reason));
        setPanel(null);
      }

      setMessage(nextMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Decision request failed.");
    } finally {
      setBusyDecision(null);
    }
  };

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadActions();
  }, [loadActions]);

  const visibleCountLabel = useMemo(() => {
    const count = panel?.active.length ?? 0;
    return `${count} visible ${count === 1 ? "action" : "actions"}`;
  }, [panel]);

  const renderStatePanel = (): React.ReactNode => {
    if (loadState === "ready") {
      return null;
    }

    const title = loadState === "loading"
      ? "Loading"
      : loadState === "signed-out"
        ? "Sign In Required"
        : loadState === "unlinked"
          ? "Account Not Linked"
          : loadState === "forbidden"
            ? "Action Panel Forbidden"
            : "Action Panel Unavailable";

    return (
      <section className={`action-state-card ${loadState}`} aria-labelledby="action-state-title">
        <h2 id="action-state-title">{title}</h2>
        <p>{message}</p>
        {loadState !== "loading" ? (
          <button type="button" className="secondary-action" onClick={() => void loadActions()} disabled={refreshing}>
            Retry
          </button>
        ) : null}
      </section>
    );
  };

  return (
    <>
      <header className="links-header">
        <p className="eyebrow">Action Panel</p>
        <h1>Approval Inbox</h1>
        <p>Review urgent stream-safe actions separately from slower admin work.</p>
      </header>
      <section className="action-panel" aria-labelledby="action-panel-title">
        <div className="action-panel-toolbar">
          <div>
            <h2 id="action-panel-title">Persistent Actions</h2>
            <p aria-live="polite">{message}</p>
          </div>
          <div className="action-toolbar-controls">
            <a
              className={`button-link secondary-action action-live-toggle ${liveMode ? "enabled" : ""}`}
              href={getLiveModeHref(liveMode)}
              aria-current={liveMode ? "page" : undefined}
            >
              {liveMode ? "Live-safe view on" : "Live-safe view off"}
            </a>
            <button type="button" className="secondary-action" onClick={() => void loadActions({ keepPanel: true })} disabled={refreshing}>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <span className="action-count">{visibleCountLabel}</span>
        </div>

        {staleMessage ? (
          <div className="action-alert stale" role="status">
            {staleMessage}
          </div>
        ) : null}

        {renderStatePanel()}

        {loadState === "ready" && panel ? (
          <>
            {panel.active.length > 0 ? (
              <div className="action-list">
                {panel.active.map((action) => (
                  <article className="action-item-card" key={action.id}>
                    <div className="action-item-heading">
                      <span className={`action-priority ${action.priority}`}>{action.priority}</span>
                      <span>{action.category}</span>
                      <span>{action.decisionKind}</span>
                    </div>
                    <h2>{action.title}</h2>
                    <p>{action.description}</p>
                    <dl>
                      <div>
                        <dt>Status</dt>
                        <dd>{actionStatusLabels[action.status]}</dd>
                      </div>
                      <div>
                        <dt>Stream relevant</dt>
                        <dd>{action.streamRelevant ? "Yes" : "No"}</dd>
                      </div>
                      <div>
                        <dt>Live safe</dt>
                        <dd>{action.liveSafe ? "Yes" : "No"}</dd>
                      </div>
                      <div>
                        <dt>Updated</dt>
                        <dd>
                          <time dateTime={action.updatedAt}>{formatDateTime(action.updatedAt)}</time>
                        </dd>
                      </div>
                    </dl>
                    {action.canDecide && action.allowedDecisions.length > 0 ? (
                      <div className="action-item-actions" aria-label={`Decision controls for ${action.title}`}>
                        {actionDecisionOrder.map((decision) => {
                          const allowed = action.allowedDecisions.includes(decision);
                          const decisionKey = `${action.id}:${decision}`;

                          return (
                            <button
                              key={decision}
                              type="button"
                              className={decision === "reject" ? "danger-action" : decision === "defer" ? "secondary-action" : undefined}
                              onClick={() => void decideAction(action, decision)}
                              disabled={!allowed || busyDecision !== null}
                              aria-disabled={!allowed || busyDecision !== null}
                            >
                              {busyDecision === decisionKey ? "Saving..." : actionDecisionLabels[decision]}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="action-decision-note">You can view this item, but no decisions are currently available.</p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <section className="action-state-card empty" aria-labelledby="action-empty-title">
                <h2 id="action-empty-title">No Active Actions</h2>
                <p>
                  {liveMode
                    ? "No live-safe actions are waiting right now."
                    : "No active Action Panel items are waiting right now."}
                </p>
              </section>
            )}

            <section className="action-history" aria-labelledby="action-history-title">
              <div className="action-history-heading">
                <h2 id="action-history-title">Recent Decision History</h2>
                <span>Latest {panel.historyLimit}</span>
              </div>
              {panel.history.length > 0 ? (
                <ol className="action-history-list">
                  {panel.history.map((entry) => (
                    <li key={entry.id}>
                      <div>
                        <strong>{entry.actionTitle}</strong>
                        <p>
                          {entry.actor.displayName} {actionDecisionPastLabels[entry.decision]} this item from{" "}
                          {actionStatusLabels[entry.previousStatus].toLowerCase()} to{" "}
                          {actionStatusLabels[entry.newStatus].toLowerCase()}.
                        </p>
                        {entry.note ? <p className="action-history-note">{entry.note}</p> : null}
                      </div>
                      <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="action-decision-note">No decisions have been recorded yet.</p>
              )}
            </section>
          </>
        ) : null}
      </section>
    </>
  );
};

export default ActionPanelClient;
