import { useEffect, useState, type ReactNode } from "react";
import { chatSourceLabels } from "../chat/chat-source-labels.service.js";
import { formatChatTime } from "../chat/chat-time.service.js";
import { createApiHeaders } from "../dev-auth-token.js";
import { moderationRuleKindLabels, type StreamerChatModerationRule, type StreamerChatModerationRuleRetractResponse, type StreamerChatModerationRulesResponse } from "./moderation-control.types.js";

export const ModerationRulesWindow = ({
  apiBaseUrl,
  canRetract = true,
  title = "Applied Rules"
}: {
  apiBaseUrl: string;
  canRetract?: boolean;
  title?: string;
}): ReactNode => {
  const [rules, setRules] = useState<StreamerChatModerationRule[]>([]);
  const [status, setStatus] = useState("Loading applied rules.");

  const loadRules = async (): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setStatus("Control token missing.");
      return;
    }

    try {
      const url = new URL("/streamer-chat/moderation/rules", apiBaseUrl);
      url.searchParams.set("accessToken", token);
      const response = await fetch(url, {
        credentials: "include",
        headers: createApiHeaders()
      });
      const result = await response.json() as StreamerChatModerationRulesResponse;

      if (!response.ok) {
        throw new Error(`Rules request failed with ${response.status}.`);
      }

      if (!result.ok) {
        throw new Error(result.reason);
      }

      setRules(result.rules);
      setStatus(`Ready. ${result.rules.length} active rule(s).`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Applied rules unavailable.");
    }
  };

  const retractRule = async (rule: StreamerChatModerationRule): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setStatus("Control token missing.");
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/streamer-chat/moderation/rules/retract`, {
        body: JSON.stringify({
          accessToken: token,
          ruleId: rule.id
        }),
        credentials: "include",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        method: "POST"
      });
      const result = await response.json() as StreamerChatModerationRuleRetractResponse;

      if (!response.ok) {
        throw new Error("Rule retraction request failed.");
      }

      if (!result.ok) {
        throw new Error(result.reason);
      }

      setRules((currentRules) => currentRules.filter((currentRule) => currentRule.id !== rule.id));
      setStatus(`Retracted ${moderationRuleKindLabels[rule.kind].toLowerCase()} rule for ${rule.authorName}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Rule retraction failed.");
    }
  };

  useEffect(() => {
    void loadRules();
    const intervalId = window.setInterval(() => {
      void loadRules();
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <section className="moderation-rules-window" aria-label="Applied stream chat rules">
      <div className="section-heading">
        <h2>{title}</h2>
        <span>{status}</span>
      </div>
      {rules.length === 0 ? (
        <p>No active local chat rules.</p>
      ) : (
        <ul className="moderation-rules-list">
          {rules.map((rule) => (
            <li key={rule.id}>
              <div>
                <strong>{moderationRuleKindLabels[rule.kind]}</strong>
                <span>
                  {chatSourceLabels[rule.source]} · {rule.authorName}
                  {rule.kind === "author_warned" && typeof rule.count === "number" ? ` · ${rule.count}/3` : ""}
                  {rule.activeUntil ? ` · until ${formatChatTime(rule.activeUntil)}` : ""}
                </span>
                <time dateTime={rule.appliedAt}>{formatChatTime(rule.appliedAt)}</time>
              </div>
              {canRetract ? (
                <button type="button" onClick={() => void retractRule(rule)}>
                  Retract
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
