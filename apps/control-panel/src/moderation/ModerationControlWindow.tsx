import { useEffect, useState, type ReactNode } from "react";

import { StreamerChatViewer } from "../chat/StreamerChatViewer.js";
import { ModerationInfoPanel } from "./ModerationInfoPanel.js";
import { ModerationRulesWindow } from "./ModerationRulesWindow.js";
import { moderationPanelLabels, type ModerationControlWindowProps, type ModerationPanelKey, type StreamerChatModerationAccess, type StreamerChatModerationAccessResponse } from "./moderation-control.types.js";

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
