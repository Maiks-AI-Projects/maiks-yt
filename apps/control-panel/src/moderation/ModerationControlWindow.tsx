import type { StreamerChatMessage } from "@maiks-yt/events";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { chatSourceLabels } from "../chat/chat-source-labels.service.js";
import { formatChatTime } from "../chat/chat-time.service.js";
import { StreamerChatViewer } from "../chat/StreamerChatViewer.js";
import { createApiHeaders } from "../dev-auth-token.js";
import { OperationNavIcon, type OperationNavIconName } from "../operations/OperationNavIcon.js";
import type { OverlayStatusResponse } from "../overlay/SurfaceStatus.types.js";
import { ModerationAuditWindow } from "./ModerationAuditWindow.js";
import { ModerationInfoPanel } from "./ModerationInfoPanel.js";
import { ModerationRulesWindow } from "./ModerationRulesWindow.js";
import {
  moderationAuditActionLabels,
  moderationPanelLabels,
  moderationRuleKindLabels,
  type ModerationControlWindowProps,
  type ModerationPanelKey,
  type StreamerChatModerationAccess,
  type StreamerChatModerationAccessResponse,
  type StreamerChatModerationAuditEntry,
  type StreamerChatModerationAuditResponse,
  type StreamerChatModerationRule,
  type StreamerChatModerationRulesResponse
} from "./moderation-control.types.js";

const moderationPageStorageKey = "maiks.yt.moderation.selectedPage";
const moderationSidebarStorageKey = "maiks.yt.moderation.sidebarCollapsed";

const moderationPagePathSegments: Record<ModerationPanelKey, string> = {
  active: "active",
  approvals: "approvals",
  audit: "audit",
  chat: "",
  rules: "rules",
  users: "users"
};

const moderationPageIcons: Record<ModerationPanelKey, OperationNavIconName> = {
  active: "providers",
  approvals: "approvals",
  audit: "audit",
  chat: "chat",
  rules: "rules",
  users: "users"
};

type ModerationContextSummary = {
  audit: StreamerChatModerationAuditEntry[];
  rules: StreamerChatModerationRule[];
  status: string;
};

const getInitialModerationPanel = (): ModerationPanelKey => {
  const segment = window.location.pathname.replace(/\/+$/, "").split("/")[2] ?? "";
  const routePanel = (Object.entries(moderationPagePathSegments).find(([, pathSegment]) => pathSegment === segment)?.[0] ?? null) as ModerationPanelKey | null;

  if (routePanel) {
    return routePanel;
  }

  const storedPanel = window.localStorage.getItem(moderationPageStorageKey);

  return storedPanel === "active"
    || storedPanel === "approvals"
    || storedPanel === "audit"
    || storedPanel === "chat"
    || storedPanel === "rules"
    || storedPanel === "users"
    ? storedPanel
    : "chat";
};

export const ModerationControlWindow = ({ apiBaseUrl }: ModerationControlWindowProps): ReactNode => {
  const [access, setAccess] = useState<StreamerChatModerationAccess | null>(null);
  const [emergencyCleanModeEnabled, setEmergencyCleanModeEnabled] = useState<boolean | null>(null);
  const [status, setStatus] = useState("Loading moderation access.");
  const [selectedPanel, setSelectedPanel] = useState<ModerationPanelKey>(getInitialModerationPanel);
  const [selectedMessage, setSelectedMessage] = useState<StreamerChatMessage | null>(null);
  const [selectedContext, setSelectedContext] = useState<ModerationContextSummary>({
    audit: [],
    rules: [],
    status: "Select a message."
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    window.localStorage.getItem(moderationSidebarStorageKey) === "true"
  );

  const availablePanels: ModerationPanelKey[] = [
    ...(access?.panels.chat ? ["chat" as const] : []),
    ...(access?.panels.appliedRules ? ["active" as const] : []),
    ...(access?.panels.appliedRules ? ["rules" as const] : []),
    ...(access?.panels.pendingApprovals ? ["approvals" as const] : []),
    ...(access?.panels.chat ? ["users" as const] : []),
    ...(access?.panels.auditHistory ? ["audit" as const] : [])
  ];
  const activePanel = availablePanels.includes(selectedPanel)
    ? selectedPanel
    : availablePanels[0] ?? "chat";

  const loadSelectedMessageContext = useCallback(async (message: StreamerChatMessage): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token || !access) {
      setSelectedContext({ audit: [], rules: [], status: "Context requires an active token." });
      return;
    }

    const normalizedAuthorName = message.authorName.trim().toLowerCase();

    try {
      const [rulesResult, auditResult] = await Promise.all([
        access.actions.canViewRules ? (async (): Promise<StreamerChatModerationRule[]> => {
          const url = new URL("/streamer-chat/moderation/rules", apiBaseUrl);
          url.searchParams.set("accessToken", token);
          const response = await fetch(url, {
            credentials: "include",
            headers: createApiHeaders()
          });
          const result = await response.json() as StreamerChatModerationRulesResponse;

          if (!response.ok || !result.ok) {
            return [];
          }

          return result.rules.filter((rule) =>
            rule.source === message.source
            && rule.authorName.trim().toLowerCase() === normalizedAuthorName
          );
        })() : Promise.resolve([]),
        access.actions.canViewAudit ? (async (): Promise<StreamerChatModerationAuditEntry[]> => {
          const url = new URL("/streamer-chat/moderation/audit", apiBaseUrl);
          url.searchParams.set("accessToken", token);
          const response = await fetch(url, {
            credentials: "include",
            headers: createApiHeaders()
          });
          const result = await response.json() as StreamerChatModerationAuditResponse;

          if (!response.ok || !result.ok) {
            return [];
          }

          return result.audit.filter((entry) =>
            entry.source === message.source
            && (
              entry.messageId === message.id
              || entry.targetAuthorName?.trim().toLowerCase() === normalizedAuthorName
            )
          ).slice(0, 4);
        })() : Promise.resolve([])
      ]);

      setSelectedContext({
        audit: auditResult,
        rules: rulesResult,
        status: `Loaded ${rulesResult.length} rule(s), ${auditResult.length} audit item(s).`
      });
    } catch {
      setSelectedContext({ audit: [], rules: [], status: "Context summary unavailable." });
    }
  }, [access, apiBaseUrl]);

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
        credentials: "include",
        headers: createApiHeaders()
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

  const choosePanel = (panel: ModerationPanelKey): void => {
    setSelectedPanel(panel);
    window.localStorage.setItem(moderationPageStorageKey, panel);
    const segment = moderationPagePathSegments[panel];
    const nextPath = segment ? `/moderation/${segment}` : "/moderation";

    window.history.replaceState(null, "", nextPath);
  };

  const toggleSidebar = (): void => {
    setSidebarCollapsed((currentValue) => {
      const nextValue = !currentValue;

      window.localStorage.setItem(moderationSidebarStorageKey, String(nextValue));
      return nextValue;
    });
  };

  const refreshEmergencyCleanMode = async (): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setEmergencyCleanModeEnabled(null);
      return;
    }

    try {
      const url = new URL("/overlay/status", apiBaseUrl);
      url.searchParams.set("accessToken", token);
      const response = await fetch(url);
      const result = await response.json() as OverlayStatusResponse;

      if (response.ok && result.ok) {
        setEmergencyCleanModeEnabled(result.emergencyCleanModeEnabled);
      }
    } catch {
      setEmergencyCleanModeEnabled(null);
    }
  };

  useEffect(() => {
    void loadAccess();
  }, []);

  useEffect(() => {
    void refreshEmergencyCleanMode();
    const intervalId = window.setInterval(refreshEmergencyCleanMode, 5_000);

    return () => window.clearInterval(intervalId);
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!selectedMessage || activePanel !== "chat") {
      setSelectedContext({ audit: [], rules: [], status: selectedMessage ? "Open Chat to view message context." : "Select a message." });
      return;
    }

    void loadSelectedMessageContext(selectedMessage);
  }, [activePanel, loadSelectedMessageContext, selectedMessage]);

  const setEmergencyCleanMode = async (enabled: boolean): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setStatus("Control token missing.");
      return;
    }

    setStatus(enabled ? "Turning emergency clean mode on." : "Restoring overlay.");

    try {
      const response = await fetch(`${apiBaseUrl}/overlay/emergency-clean-mode`, {
        body: JSON.stringify({
          accessToken: token,
          enabled
        }),
        credentials: "include",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(`Emergency clear failed with ${response.status}.`);
      }

      setEmergencyCleanModeEnabled(enabled);
      setStatus(enabled ? "Emergency clean mode on." : "Overlay restored.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Emergency clear failed.");
    }
  };

  const renderPanel = (): ReactNode => {
    if (!access) {
      return (
        <section className="moderation-rules-window">
          <p>{status}</p>
        </section>
      );
    }

    if (activePanel === "chat") {
      return (
        <div className="moderation-chat-workspace">
          <StreamerChatViewer
            actionAccess={access.actions}
            apiBaseUrl={apiBaseUrl}
            newestOnTop
            maxMessages={80}
            onSelectedMessageChange={setSelectedMessage}
            variant="standalone"
          />
          <aside className={`moderation-context-drawer ${selectedMessage ? "open" : ""}`} aria-label="Selected message context">
            {selectedMessage ? (
              <>
                <div className="moderation-context-header">
                  <span className="streamer-chat-avatar" aria-hidden="true">{selectedMessage.authorName.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <strong>{selectedMessage.authorName}</strong>
                    <span>{chatSourceLabels[selectedMessage.source]} · {selectedMessage.authorKind}</span>
                  </div>
                  <button type="button" onClick={() => setSelectedMessage(null)} aria-label="Close selected message context">×</button>
                </div>
                <dl className="moderation-context-facts">
                  <div><dt>Message time</dt><dd>{formatChatTime(selectedMessage.createdAt)}</dd></div>
                  <div><dt>Overlay default</dt><dd>{selectedMessage.visibleOnOverlayByDefault ? "Visible" : "Private feed"}</dd></div>
                  <div><dt>Context</dt><dd>{selectedContext.status}</dd></div>
                </dl>
                <section>
                  <h3>Active rules</h3>
                  {selectedContext.rules.length === 0 ? (
                    <p>No matching active local rules.</p>
                  ) : (
                    <ul>
                      {selectedContext.rules.map((rule) => (
                        <li key={rule.id}>
                          <strong>{moderationRuleKindLabels[rule.kind]}</strong>
                          <span>{rule.activeUntil ? `until ${formatChatTime(rule.activeUntil)}` : "until retracted"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section>
                  <h3>Recent audit</h3>
                  {selectedContext.audit.length === 0 ? (
                    <p>No matching recent audit items.</p>
                  ) : (
                    <ul>
                      {selectedContext.audit.map((entry) => (
                        <li key={entry.id}>
                          <strong>{moderationAuditActionLabels[entry.action]}</strong>
                          <span>{entry.outcome.replaceAll("_", " ")} · {formatChatTime(entry.at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section>
                  <h3>Allowed by this role</h3>
                  <div className="moderation-context-actions">
                    {access.actions.canHide ? <span>Hide</span> : null}
                    {access.actions.canWarn ? <span>Warn in Options</span> : null}
                    {access.actions.canBan ? <span>Ban after confirm</span> : null}
                    {!access.actions.canHide && !access.actions.canWarn && !access.actions.canBan ? <span>No direct actions</span> : null}
                  </div>
                </section>
              </>
            ) : (
              <p>Select or focus a chat row to inspect provider, rules, audit, and permission-filtered actions.</p>
            )}
          </aside>
        </div>
      );
    }

    if (activePanel === "active" || activePanel === "rules") {
      return <ModerationRulesWindow apiBaseUrl={apiBaseUrl} canRetract={access.actions.canRetractRules} title={moderationPanelLabels[activePanel]} />;
    }

    if (activePanel === "audit") {
      return <ModerationAuditWindow apiBaseUrl={apiBaseUrl} />;
    }

    if (activePanel === "approvals") {
      return <ModerationInfoPanel apiBaseUrl={apiBaseUrl} endpoint="/admin/live-helper" title="Approvals & Queues" variant="approvals" />;
    }

    return (
      <section className="moderation-rules-window moderation-user-context" aria-label="User context">
        <div className="section-heading">
          <h2>User Context</h2>
          <span>Ready</span>
        </div>
        <p>Select a chat message to keep provider identity, active rules, and recent audit context in one permission-filtered drawer. The richer redacted user projection is still backend work.</p>
      </section>
    );
  };

  return (
    <div className={`operations-app-shell moderation-app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="operations-sidebar" aria-label="Moderation pages">
        <button type="button" className="sidebar-collapse-button" onClick={toggleSidebar} aria-pressed={sidebarCollapsed}>
          {sidebarCollapsed ? ">" : "<"}
        </button>
        <nav className="operations-nav">
          {availablePanels.map((panel) => (
            <button
              type="button"
              className={panel === activePanel ? "active" : ""}
              key={panel}
              onClick={() => choosePanel(panel)}
              title={moderationPanelLabels[panel]}
            >
              <span className="nav-icon" aria-hidden="true"><OperationNavIcon name={moderationPageIcons[panel]} /></span>
              <span className="nav-label">{moderationPanelLabels[panel]}</span>
            </button>
          ))}
        </nav>
      </aside>
      <section className="operations-page">
        <div className="operations-page-header">
          <div>
            <h2>{moderationPanelLabels[activePanel]}</h2>
            <p>{status}</p>
          </div>
          {access?.actions.canEmergencyClear ? (
            <button
              type="button"
              className={`chat-emergency-clear${emergencyCleanModeEnabled ? " active" : ""}`}
              onClick={() => void setEmergencyCleanMode(!emergencyCleanModeEnabled)}
            >
              {emergencyCleanModeEnabled ? "Restore overlay" : "Emergency clear"}
            </button>
          ) : null}
        </div>
        {renderPanel()}
      </section>
    </div>
  );
};
