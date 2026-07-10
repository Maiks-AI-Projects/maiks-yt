import { useEffect, useState, type ReactNode } from "react";

import { withDevAuthToken } from "../dev-auth-token.js";
import type { OverlayStatusResponse } from "../overlay/SurfaceStatus.types.js";

type ChatWindowHeaderProps = {
  apiBaseUrl: string;
};

export const ChatWindowHeader = ({ apiBaseUrl }: ChatWindowHeaderProps): ReactNode => {
  const [status, setStatus] = useState<string>("Ready");
  const [emergencyCleanModeEnabled, setEmergencyCleanModeEnabled] = useState<boolean | null>(null);

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
    void refreshEmergencyCleanMode();
    const intervalId = window.setInterval(refreshEmergencyCleanMode, 5_000);

    return () => window.clearInterval(intervalId);
  }, [apiBaseUrl]);

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
        headers: {
          "Content-Type": "application/json"
        },
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

  const openWindow = (value: string): void => {
    if (!value) {
      return;
    }

    window.location.assign(withDevAuthToken(value));
  };

  return (
    <div className="chat-window-toolbar" aria-label="Streamer chat window controls">
      <button
        type="button"
        className={`chat-emergency-clear${emergencyCleanModeEnabled ? " active" : ""}`}
        onClick={() => void setEmergencyCleanMode(!emergencyCleanModeEnabled)}
      >
        {emergencyCleanModeEnabled ? "Restore overlay" : "Emergency clear"}
      </button>
      <label>
        <span>Open</span>
        <select defaultValue="" onChange={(event) => openWindow(event.currentTarget.value)}>
          <option value="" disabled>Other window</option>
          <option value="/control">Control panel</option>
          <option value="/moderation">Applied rules</option>
          <option value="https://web-dev.maiks.yt/tools/notifications">Notifications</option>
          <option value="https://web-dev.maiks.yt/admin/provider-integrations">Provider admin</option>
          <option value="https://web-dev.maiks.yt/admin/live-helper">Live helper</option>
        </select>
      </label>
      <span>{status}</span>
    </div>
  );
};
