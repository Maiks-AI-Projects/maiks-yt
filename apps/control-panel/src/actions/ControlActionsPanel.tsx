import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "../dev-auth-token.js";

type ActionItemDecision = "approve" | "reject" | "defer";
type ActionItemStatus = "approved" | "completed" | "deferred" | "open" | "rejected";

type ControlActionItem = {
  readonly allowedDecisions: readonly ActionItemDecision[];
  readonly canDecide: boolean;
  readonly category: string;
  readonly createdAt: string;
  readonly decisionKind: string;
  readonly description: string | null;
  readonly id: string;
  readonly priority: "urgent" | "high" | "normal" | "low";
  readonly status: ActionItemStatus;
  readonly title: string;
  readonly updatedAt: string;
};

type ControlActionHistoryEntry = {
  readonly actionTitle: string;
  readonly createdAt: string;
  readonly decision: ActionItemDecision;
  readonly id: string;
  readonly newStatus: ActionItemStatus;
};

type ControlActionsResponse = {
  readonly ok: true;
  readonly active: readonly ControlActionItem[];
  readonly history: readonly ControlActionHistoryEntry[];
  readonly live: boolean;
} | {
  readonly ok: false;
  readonly reason: string;
};

type ControlActionDecisionResponse = {
  readonly ok: true;
  readonly item: ControlActionItem;
} | {
  readonly ok: false;
  readonly reason: string;
};

type ControlActionsPanelProps = {
  readonly apiBaseUrl: string;
};

const decisionLabels = {
  approve: "Approve",
  defer: "Defer",
  reject: "Reject"
} satisfies Record<ActionItemDecision, string>;

const formatDateTime = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
};

export const ControlActionsPanel = ({ apiBaseUrl }: ControlActionsPanelProps): React.ReactNode => {
  const [items, setItems] = useState<readonly ControlActionItem[]>([]);
  const [history, setHistory] = useState<readonly ControlActionHistoryEntry[]>([]);
  const [status, setStatus] = useState("Loading actions.");
  const [busyDecision, setBusyDecision] = useState<string | null>(null);

  const loadActions = useCallback(async (): Promise<void> => {
    try {
      const response = await apiFetch(`${apiBaseUrl}/actions?live=true`);
      const result = await response.json() as ControlActionsResponse;

      if (!response.ok) {
        throw new Error(`Actions failed with ${response.status}.`);
      }

      if (!result.ok) {
        throw new Error(result.reason);
      }

      setItems(result.active);
      setHistory(result.history.slice(0, 5));
      setStatus(result.active.length === 0 ? "No active live-safe actions." : `${result.active.length} active action(s).`);
    } catch (error) {
      setItems([]);
      setHistory([]);
      setStatus(error instanceof Error ? error.message : "Actions unavailable.");
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void loadActions();
  }, [loadActions]);

  const decideAction = async (item: ControlActionItem, decision: ActionItemDecision): Promise<void> => {
    const decisionKey = `${item.id}:${decision}`;

    setBusyDecision(decisionKey);
    setStatus(`Saving ${decision} decision.`);

    try {
      const response = await apiFetch(`${apiBaseUrl}/actions/${encodeURIComponent(item.id)}/decision`, {
        body: JSON.stringify({
          decision,
          expectedStatus: item.status
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const result = await response.json() as ControlActionDecisionResponse;

      if (!response.ok) {
        throw new Error(`Decision failed with ${response.status}.`);
      }

      if (!result.ok) {
        throw new Error(result.reason);
      }

      setStatus("Decision saved.");
      await loadActions();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Decision failed.");
    } finally {
      setBusyDecision(null);
    }
  };

  return (
    <section className="control-actions-panel" aria-label="Actions">
      <div className="section-heading">
        <h2>Live Actions</h2>
        <span>{status}</span>
      </div>
      {items.length === 0 ? (
        <p className="operation-empty-state">No active actions need attention.</p>
      ) : (
        <ol className="control-action-list">
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.category} · {item.priority} · {formatDateTime(item.updatedAt)}</span>
                {item.description ? <p>{item.description}</p> : null}
              </div>
              {item.canDecide ? (
                <div className="control-action-buttons">
                  {item.allowedDecisions.map((decision) => (
                    <button
                      type="button"
                      key={decision}
                      disabled={busyDecision !== null}
                      onClick={() => void decideAction(item, decision)}
                    >
                      {busyDecision === `${item.id}:${decision}` ? "Saving" : decisionLabels[decision]}
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {history.length > 0 ? (
        <details className="operation-compact-details">
          <summary>Recent decisions</summary>
          <ol>
            {history.map((entry) => (
              <li key={entry.id}>
                <span>{entry.actionTitle}</span>
                <small>{decisionLabels[entry.decision]} · {entry.newStatus} · {formatDateTime(entry.createdAt)}</small>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
};
