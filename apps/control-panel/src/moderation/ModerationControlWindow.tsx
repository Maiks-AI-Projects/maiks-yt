import type { StreamerChatMessage } from "@maiks-yt/events";
import { useEffect, useState, type ReactNode } from "react";

import { StreamerChatViewer } from "../chat/StreamerChatViewer.js";
import { chatSourceLabels } from "../chat/chat-source-labels.service.js";
import { formatChatTime } from "../chat/chat-time.service.js";

type StreamerChatModerationRule = {
  appliedAt: string;
  authorName: string;
  count?: number;
  id: string;
  kind: "message_hidden" | "author_banned" | "author_warned";
  messageId: string | null;
  source: StreamerChatMessage["source"];
};

type StreamerChatModerationRulesResponse = {
  ok: true;
  rules: StreamerChatModerationRule[];
  providerAction: false;
  checkedAt: string;
} | {
  ok: false;
  reason: string;
  providerAction: false;
};

type StreamerChatModerationRuleRetractResponse = {
  ok: true;
  retractedRule: StreamerChatModerationRule | null;
  providerAction: false;
} | {
  ok: false;
  reason: string;
  providerAction: false;
};

type StreamerChatModerationAccess = {
  actions: {
    canBan: boolean;
    canEmergencyClear: boolean;
    canHide: boolean;
    canRetractRules: boolean;
    canViewRules: boolean;
    canWarn: boolean;
  };
  panels: {
    appliedRules: boolean;
    chat: boolean;
    liveHelper: boolean;
    pendingApprovals: boolean;
  };
};

type StreamerChatModerationAccessResponse = {
  ok: true;
  actions: StreamerChatModerationAccess["actions"];
  panels: StreamerChatModerationAccess["panels"];
  providerAction: false;
  checkedAt: string;
} | {
  ok: false;
  reason: string;
  providerAction: false;
};

type ModerationPanelKey = "chat" | "rules" | "approvals" | "helper";

type ModerationControlWindowProps = {
  apiBaseUrl: string;
};

const moderationRuleKindLabels: Record<StreamerChatModerationRule["kind"], string> = {
  author_banned: "Ban",
  author_warned: "Warning",
  message_hidden: "Hide"
};

const moderationPanelLabels: Record<ModerationPanelKey, string> = {
  approvals: "Pending Approvals",
  chat: "Chat",
  helper: "Live Helper Summary",
  rules: "Applied Rules"
};

const ModerationRulesWindow = ({
  apiBaseUrl,
  canRetract = true
}: {
  apiBaseUrl: string;
  canRetract?: boolean;
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
        credentials: "include"
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
        headers: {
          "Content-Type": "application/json"
        },
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
        <h2>Applied Rules</h2>
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

const ModerationInfoPanel = ({
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
        credentials: "include"
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

export const ModerationControlWindow = ({ apiBaseUrl }: ModerationControlWindowProps): ReactNode => {
  const [access, setAccess] = useState<StreamerChatModerationAccess | null>(null);
  const [status, setStatus] = useState("Loading moderation access.");
  const [selectedPanel, setSelectedPanel] = useState<ModerationPanelKey>("chat");

  const availablePanels: ModerationPanelKey[] = [
    ...(access?.panels.chat ? ["chat" as const] : []),
    ...(access?.panels.appliedRules ? ["rules" as const] : []),
    ...(access?.panels.pendingApprovals ? ["approvals" as const] : []),
    ...(access?.panels.liveHelper ? ["helper" as const] : [])
  ];
  const activePanel = availablePanels.includes(selectedPanel)
    ? selectedPanel
    : availablePanels[0] ?? "chat";

  const loadAccess = async (): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setStatus("Control token missing.");
      return;
    }

    try {
      const url = new URL("/streamer-chat/moderation/access", apiBaseUrl);
      url.searchParams.set("accessToken", token);
      const response = await fetch(url, {
        credentials: "include"
      });
      const result = await response.json() as StreamerChatModerationAccessResponse;

      if (!response.ok) {
        throw new Error(`Moderation access failed with ${response.status}.`);
      }

      if (!result.ok) {
        throw new Error(result.reason);
      }

      setAccess({
        actions: result.actions,
        panels: result.panels
      });
      setStatus("Ready");
    } catch (error) {
      setAccess(null);
      setStatus(error instanceof Error ? error.message : "Moderation access unavailable.");
    }
  };

  useEffect(() => {
    void loadAccess();
  }, []);

  const triggerEmergencyClear = async (): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setStatus("Control token missing.");
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/overlay/emergency-clean-mode`, {
        body: JSON.stringify({
          accessToken: token,
          enabled: true
        }),
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(`Emergency clear failed with ${response.status}.`);
      }

      setStatus("Emergency clean mode on.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Emergency clear failed.");
    }
  };

  return (
    <>
      <div className="chat-window-toolbar moderation-window-toolbar" aria-label="Moderator window controls">
        {access?.actions.canEmergencyClear ? (
          <button type="button" className="chat-emergency-clear" onClick={() => void triggerEmergencyClear()}>
            Emergency clear
          </button>
        ) : null}
        <label>
          <span>Panel</span>
          <select
            value={activePanel}
            onChange={(event) => setSelectedPanel(event.currentTarget.value as ModerationPanelKey)}
          >
            {availablePanels.map((panel) => (
              <option key={panel} value={panel}>{moderationPanelLabels[panel]}</option>
            ))}
          </select>
        </label>
        <span>{status}</span>
      </div>
      {!access ? (
        <section className="moderation-rules-window">
          <p>{status}</p>
        </section>
      ) : activePanel === "chat" ? (
        <StreamerChatViewer
          actionAccess={access.actions}
          apiBaseUrl={apiBaseUrl}
          newestOnTop
          maxMessages={80}
          variant="standalone"
        />
      ) : activePanel === "rules" ? (
        <ModerationRulesWindow apiBaseUrl={apiBaseUrl} canRetract={access.actions.canRetractRules} />
      ) : activePanel === "approvals" ? (
        <ModerationInfoPanel apiBaseUrl={apiBaseUrl} endpoint="/admin/live-helper" title="Pending Approvals" />
      ) : (
        <ModerationInfoPanel apiBaseUrl={apiBaseUrl} endpoint="/admin/live-helper" title="Live Helper Summary" />
      )}
    </>
  );
};
