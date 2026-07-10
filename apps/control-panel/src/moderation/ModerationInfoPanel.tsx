import { useEffect, useState, type ReactNode } from "react";

import { createApiHeaders } from "../dev-auth-token.js";

export const ModerationInfoPanel = ({
  apiBaseUrl,
  endpoint,
  title
}: {
  apiBaseUrl: string;
  endpoint: string;
  title: string;
}): ReactNode => {
  const [status, setStatus] = useState("Loading.");
  const [summary, setSummary] = useState<string[]>([]);

  const loadSummary = async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        credentials: "include",
        headers: createApiHeaders()
      });
      const result = await response.json() as unknown;

      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}.`);
      }

      const payload = result as {
        ok?: boolean;
        pendingApprovals?: unknown[];
        notificationCounts?: { warning?: number; critical?: number };
        activeHelperGrants?: unknown[];
        fakeLocalActiveModeration?: unknown[];
      };

      if (payload.ok === false) {
        throw new Error("Panel unavailable.");
      }

      const nextSummary = [
        `Pending approvals: ${Array.isArray(payload.pendingApprovals) ? payload.pendingApprovals.length : 0}`,
        `Open warnings: ${payload.notificationCounts?.warning ?? 0}`,
        `Open critical alerts: ${payload.notificationCounts?.critical ?? 0}`,
        `Active helper grants: ${Array.isArray(payload.activeHelperGrants) ? payload.activeHelperGrants.length : 0}`,
        `Active local moderation rules: ${Array.isArray(payload.fakeLocalActiveModeration) ? payload.fakeLocalActiveModeration.length : 0}`
      ];

      setSummary(nextSummary);
      setStatus("Ready");
    } catch (error) {
      setSummary([]);
      setStatus(error instanceof Error ? error.message : "Panel unavailable.");
    }
  };

  useEffect(() => {
    void loadSummary();
    const intervalId = window.setInterval(() => {
      void loadSummary();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [endpoint]);

  return (
    <section className="moderation-rules-window" aria-label={title}>
      <div className="section-heading">
        <h2>{title}</h2>
        <span>{status}</span>
      </div>
      {summary.length === 0 ? (
        <p>No summary available.</p>
      ) : (
        <ul className="moderation-summary-list">
          {summary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
};
