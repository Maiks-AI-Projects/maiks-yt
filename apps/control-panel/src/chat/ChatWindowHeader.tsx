import { useState, type ReactNode } from "react";

type ChatWindowHeaderProps = {
  apiBaseUrl: string;
};

export const ChatWindowHeader = ({ apiBaseUrl }: ChatWindowHeaderProps): ReactNode => {
  const [status, setStatus] = useState<string>("Ready");

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

  const openWindow = (value: string): void => {
    if (!value) {
      return;
    }

    window.location.assign(value);
  };

  return (
    <div className="chat-window-toolbar" aria-label="Streamer chat window controls">
      <button type="button" className="chat-emergency-clear" onClick={() => void triggerEmergencyClear()}>
        Emergency clear
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
