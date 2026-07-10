import { useEffect, useState, type ReactNode } from "react";

import { chatSourceLabels } from "../chat/chat-source-labels.service.js";
import { formatChatTime } from "../chat/chat-time.service.js";
import { createApiHeaders } from "../dev-auth-token.js";
import {
  moderationAuditActionLabels,
  type StreamerChatModerationAuditEntry,
  type StreamerChatModerationAuditResponse
} from "./moderation-control.types.js";

export const ModerationAuditWindow = ({
  apiBaseUrl
}: {
  apiBaseUrl: string;
}): ReactNode => {
  const [audit, setAudit] = useState<StreamerChatModerationAuditEntry[]>([]);
  const [status, setStatus] = useState("Loading moderation audit.");

  const loadAudit = async (): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setStatus("Control token missing.");
      return;
    }

    try {
      const url = new URL("/streamer-chat/moderation/audit", apiBaseUrl);
      url.searchParams.set("accessToken", token);
      const response = await fetch(url, {
        credentials: "include",
        headers: createApiHeaders()
      });
      const result = await response.json() as StreamerChatModerationAuditResponse;

      if (!response.ok) {
        throw new Error(`Audit request failed with ${response.status}.`);
      }

      if (!result.ok) {
        throw new Error(result.reason);
      }

      setAudit(result.audit);
      setStatus(`Ready. ${result.audit.length} recent audit item(s).`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Moderation audit unavailable.");
    }
  };

  useEffect(() => {
    void loadAudit();
    const intervalId = window.setInterval(() => {
      void loadAudit();
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <section className="moderation-rules-window" aria-label="Moderation audit history">
      <div className="section-heading">
        <h2>Audit History</h2>
        <span>{status}</span>
      </div>
      {audit.length === 0 ? (
        <p>No recent local moderation audit items.</p>
      ) : (
        <ul className="moderation-rules-list moderation-audit-list">
          {audit.map((entry) => (
            <li key={entry.id}>
              <div>
                <strong>{moderationAuditActionLabels[entry.action]}</strong>
                <span>
                  {chatSourceLabels[entry.source]} · {entry.targetAuthorName ?? "Unknown user"} · {entry.outcome.replaceAll("_", " ")}
                </span>
                {entry.reason ? <span>{entry.reason.replaceAll("_", " ")}</span> : null}
                {entry.note ? <p>{entry.note}</p> : null}
                <time dateTime={entry.at}>{formatChatTime(entry.at)}</time>
              </div>
              <span className={entry.providerAction ? "provider-action-flag warning" : "provider-action-flag"}>
                {entry.providerAction ? "provider action" : "local only"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
