import { useEffect, useState, type ReactNode } from "react";

import { apiFetch } from "../dev-auth-token.js";
import { StreamerChatViewer } from "./StreamerChatViewer.js";
import {
  createStreamerChatModerationAccessUrl,
  noStreamerChatActionAccess
} from "./streamer-chat-viewer.service.js";
import type { StreamerChatActionAccess } from "./streamer-chat-viewer.types.js";

type StreamerChatModerationAccessResponse = {
  ok: true;
  actions: StreamerChatActionAccess;
} | {
  ok: false;
  reason: string;
};

export const StandaloneStreamerChatViewer = ({ apiBaseUrl }: { apiBaseUrl: string }): ReactNode => {
  const [actionAccess, setActionAccess] = useState<StreamerChatActionAccess>(noStreamerChatActionAccess);

  useEffect(() => {
    let disposed = false;
    const accessToken = window.localStorage.getItem("maiks.yt.control.accessToken");

    setActionAccess(noStreamerChatActionAccess);

    if (!accessToken) {
      return () => {
        disposed = true;
      };
    }

    const loadActionAccess = async (): Promise<void> => {
      try {
        const response = await apiFetch(createStreamerChatModerationAccessUrl(apiBaseUrl, accessToken));
        const result = await response.json() as StreamerChatModerationAccessResponse;

        if (!response.ok || !result.ok) {
          throw new Error("streamer_chat_action_access_unavailable");
        }

        if (!disposed) {
          setActionAccess(result.actions);
        }
      } catch {
        if (!disposed) {
          setActionAccess(noStreamerChatActionAccess);
        }
      }
    };

    void loadActionAccess();

    return () => {
      disposed = true;
    };
  }, [apiBaseUrl]);

  return (
    <StreamerChatViewer
      actionAccess={actionAccess}
      apiBaseUrl={apiBaseUrl}
      newestOnTop
      maxMessages={80}
      variant="standalone"
    />
  );
};
