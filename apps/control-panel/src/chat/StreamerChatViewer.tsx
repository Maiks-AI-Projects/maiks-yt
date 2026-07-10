import type { StreamerChatLiveMessage, StreamerChatMessage } from "@maiks-yt/events";
import { useEffect, useState, type ReactNode } from "react";

import { createApiHeaders } from "../dev-auth-token.js";
import { chatSourceLabels } from "./chat-source-labels.service.js";
import { formatChatTime } from "./chat-time.service.js";
import { createAuthenticatedWebSocketUrl, defaultActionAccess, defaultTemporaryMuteDurationSeconds } from "./streamer-chat-viewer.service.js";
import type { FakeLocalModerationResponse, StreamerChatMessagesResponse, StreamerChatModerationResponse, StreamerChatViewerProps } from "./streamer-chat-viewer.types.js";

const getPrimaryUnavailableReasons = (
  actionAccess: StreamerChatViewerProps["actionAccess"],
  showUnavailableActions: boolean
): string[] => {
  if (!showUnavailableActions || !actionAccess) {
    return [];
  }

  return [
    !actionAccess.canHide ? "Hide needs chat:hide-message." : null,
    !actionAccess.canBan ? "Ban needs chat:ban-user-local." : null
  ].filter((reason): reason is string => reason !== null);
};

const getOptionUnavailableReasons = (
  message: StreamerChatMessage,
  actionAccess: StreamerChatViewerProps["actionAccess"],
  showUnavailableActions: boolean
): string[] => {
  if (!showUnavailableActions || !actionAccess) {
    return [];
  }

  return [
    !actionAccess.canWarn ? "Warn needs chat:warn-user." : null,
    message.source !== "fake-local" ? "Note and Mute are fake/local drills until provider-write moderation is reviewed." : null,
    "Provider warn/timeout are gated until provider-write clients and permission checks exist.",
    "Allow controls need reviewed allowlist persistence."
  ].filter((reason): reason is string => reason !== null);
};

const ActionUnavailableHint = ({ reasons }: { reasons: readonly string[] }): ReactNode => reasons.length > 0 ? (
  <p className="streamer-chat-action-hint">
    {reasons.join(" ")}
  </p>
) : null;

export const StreamerChatViewer = ({
  actionAccess = defaultActionAccess,
  apiBaseUrl,
  maxMessages = 12,
  newestOnTop,
  showUnavailableActions = false,
  variant = "embedded"
}: StreamerChatViewerProps): ReactNode => {
  const [messages, setMessages] = useState<StreamerChatMessage[]>([]);
  const [status, setStatus] = useState<string>("Loading streamer chat.");
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [openOptionsMessageId, setOpenOptionsMessageId] = useState<string | null>(null);
  const visibleMessages = newestOnTop
    ? messages.slice(0, maxMessages)
    : messages.slice(0, maxMessages).reverse();

  const executeStreamerChatModeration = async (
    message: StreamerChatMessage,
    action: "hide" | "ban" | "warn"
  ): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setActionStatus("Control token missing.");
      return;
    }

    setActionStatus(
      action === "hide"
        ? "Hiding message locally."
        : action === "ban"
          ? "Banning author locally."
          : "Warning author locally."
    );

    try {
      const response = await fetch(`${apiBaseUrl}/streamer-chat/moderation/${action}`, {
        body: JSON.stringify({
          accessToken: token,
          targetMessageId: message.id
        }),
        credentials: "include",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        method: "POST"
      });
      const result = await response.json() as StreamerChatModerationResponse;

      if (!response.ok) {
        throw new Error("Streamer chat moderation request failed.");
      }

      if (!result.ok) {
        throw new Error(result.reason);
      }

      if (action === "hide" || (action === "warn" && result.autoBanned) || action === "ban") {
        setMessages((currentMessages) => action === "hide"
          ? currentMessages.filter((currentMessage) => currentMessage.id !== message.id)
          : currentMessages.filter((currentMessage) =>
            currentMessage.source !== message.source
            || currentMessage.authorName.trim().toLowerCase() !== message.authorName.trim().toLowerCase()
          ));
      }
      setOpenOptionsMessageId(null);
      setActionStatus(
        action === "hide"
          ? `Message hidden locally. ${result.affectedCount} affected.`
          : action === "ban"
            ? `${message.authorName} banned locally from stream surfaces. ${result.affectedCount} message(s) hidden.`
            : result.autoBanned
              ? `${message.authorName} reached warning ${result.warningCount}/${result.warningThreshold} and was locally banned.`
              : `${message.authorName} warned locally. ${result.warningCount}/${result.warningThreshold}.`
      );
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "Streamer chat moderation failed.");
    }
  };

  const executeFakeLocalModeration = async (
    message: StreamerChatMessage,
    action: "hide_message" | "temporary_mute_author" | "warn_author" | "note_author",
    note: string
  ): Promise<void> => {
    if (message.source !== "fake-local") {
      setActionStatus(`${chatSourceLabels[message.source]} provider moderation is not wired yet.`);
      return;
    }

    setActionStatus("Sending local moderation command.");

    try {
      const response = await fetch(`${apiBaseUrl}/fake-local-chat/moderation/commands`, {
        body: JSON.stringify({
          action,
          targetMessageId: action === "hide_message" ? message.id : null,
          targetAuthorName: action === "hide_message" ? null : message.authorName,
          durationSeconds: action === "temporary_mute_author" ? defaultTemporaryMuteDurationSeconds : null,
          note
        }),
        credentials: "include",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        method: "POST"
      });
      const result = await response.json() as FakeLocalModerationResponse;

      if (!response.ok) {
        throw new Error("Local moderation request failed.");
      }

      if (!result.ok) {
        throw new Error(result.reason);
      }

      if (action === "hide_message") {
        setMessages((currentMessages) => currentMessages.filter((currentMessage) => currentMessage.id !== message.id));
      }

      setOpenOptionsMessageId(null);
      setActionStatus(
        action === "temporary_mute_author" && result.auditEntry.mutedUntil
          ? `${message.authorName} muted locally until ${formatChatTime(result.auditEntry.mutedUntil)}.`
          : `Local moderation command applied to ${message.authorName}.`
      );
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "Local moderation command failed.");
    }
  };

  useEffect(() => {
    let disposed = false;
    let webSocket: WebSocket | null = null;
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    const loadMessages = async (): Promise<void> => {
      if (!token) {
        setStatus("Control token missing.");
        return;
      }

      try {
        const url = new URL("/streamer-chat/messages", apiBaseUrl);
        url.searchParams.set("accessToken", token);
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Streamer chat failed with ${response.status}.`);
        }

        const result = await response.json() as StreamerChatMessagesResponse;

        if (!result.ok) {
          throw new Error(result.reason);
        }

        if (!disposed) {
          setMessages(result.messages);
          setStatus(`Streamer chat ready. ${result.messages.length} message(s) loaded.`);
        }
      } catch (error) {
        if (!disposed) {
          setStatus(error instanceof Error ? error.message : "Streamer chat unavailable.");
        }
      }
    };

    void loadMessages();

    if (token) {
      webSocket = new WebSocket(createAuthenticatedWebSocketUrl(apiBaseUrl, "/streamer-chat/live", token));
      webSocket.addEventListener("open", () => {
        if (!disposed) {
          setStatus("Streamer chat live.");
        }
      });
      webSocket.addEventListener("message", (event) => {
        const liveMessage = JSON.parse(String(event.data)) as StreamerChatLiveMessage;

        if (liveMessage.type === "streamer-chat.snapshot") {
          setMessages(liveMessage.payload.messages);
          return;
        }

        setMessages((currentMessages) => [
          liveMessage.payload,
          ...currentMessages.filter((message) => message.id !== liveMessage.payload.id)
        ].slice(0, 75));
      });
      webSocket.addEventListener("close", () => {
        if (!disposed) {
          setStatus("Streamer chat live feed closed.");
        }
      });
      webSocket.addEventListener("error", () => {
        if (!disposed) {
          setStatus("Streamer chat live feed unavailable.");
        }
      });
    }

    return () => {
      disposed = true;
      webSocket?.close();
    };
  }, [apiBaseUrl]);

  return (
    <div className={`streamer-chat-viewer ${variant}`} aria-label="Streamer chat viewer">
      <div className="streamer-chat-header">
        <strong>{variant === "standalone" ? "Live Chat" : "Streamer chat"}</strong>
        <span>{status}</span>
        {actionStatus ? <span>{actionStatus}</span> : null}
      </div>
      {visibleMessages.length === 0 ? (
        <p className="streamer-chat-empty">No streamer chat messages yet.</p>
      ) : (
        <ol className={`streamer-chat-list ${newestOnTop ? "newest-on-top" : "newest-on-bottom"}`}>
          {visibleMessages.map((message) => {
            const optionsOpen = openOptionsMessageId === message.id;
            const primaryUnavailableReasons = getPrimaryUnavailableReasons(actionAccess, showUnavailableActions);
            const optionUnavailableReasons = getOptionUnavailableReasons(message, actionAccess, showUnavailableActions);

            return (
              <li
                className={[
                  message.visibleOnOverlayByDefault ? "overlay-visible" : "streamer-only",
                  `source-${message.source}`
                ].join(" ")}
                key={message.id}
              >
                <div>
                  <strong>{message.authorName}</strong>
                  <span>{chatSourceLabels[message.source]} · {message.authorKind}</span>
                  <time dateTime={message.createdAt}>{formatChatTime(message.createdAt)}</time>
                </div>
                <p>{message.message}</p>
                <div className="streamer-chat-actions" aria-label={`Moderation controls for ${message.authorName}`}>
                  {actionAccess.canHide || showUnavailableActions ? (
                    <button
                      type="button"
                      disabled={!actionAccess.canHide}
                      onClick={() => void executeStreamerChatModeration(message, "hide")}
                      title={actionAccess.canHide
                        ? "Hide this message from Maiks.yt stream chat surfaces locally."
                        : "Missing chat:hide-message permission."}
                    >
                      Hide
                    </button>
                  ) : null}
                  {actionAccess.canBan || showUnavailableActions ? (
                    <button
                      type="button"
                      disabled={!actionAccess.canBan}
                      onClick={() => void executeStreamerChatModeration(message, "ban")}
                      title={actionAccess.canBan
                        ? "Ban this author from Maiks.yt stream chat surfaces locally."
                        : "Missing chat:ban-user-local permission."}
                    >
                      Ban
                    </button>
                  ) : null}
                  {actionAccess.canWarn || showUnavailableActions || message.source === "fake-local" ? (
                    <button
                      type="button"
                      aria-expanded={optionsOpen}
                      onClick={() => setOpenOptionsMessageId(optionsOpen ? null : message.id)}
                      title="Show local moderation options and gated follow-up actions."
                    >
                      Options
                    </button>
                  ) : null}
                </div>
                <ActionUnavailableHint reasons={primaryUnavailableReasons} />
                {optionsOpen ? (
                  <div className="streamer-chat-options">
                    {actionAccess.canWarn || showUnavailableActions ? (
                      <button
                        type="button"
                        disabled={!actionAccess.canWarn}
                        onClick={() => void executeStreamerChatModeration(message, "warn")}
                        title={actionAccess.canWarn
                          ? "Warn this author locally. A third warning applies a local stream-surface ban."
                          : "Missing chat:warn-user permission."}
                      >
                        Warn
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void executeFakeLocalModeration(message, "note_author", "Noted from streamer chat options.")}
                      disabled={message.source !== "fake-local"}
                      title={message.source !== "fake-local" ? "Provider notes need the provider moderation phase." : "Add a local note drill."}
                    >
                      Note
                    </button>
                    <button
                      type="button"
                      onClick={() => void executeFakeLocalModeration(message, "temporary_mute_author", "Muted for 10 minutes from streamer chat options.")}
                      disabled={message.source !== "fake-local"}
                      title={message.source !== "fake-local" ? "Provider timeouts need the provider-write moderation phase." : "Mute this fake/local author for 10 minutes."}
                    >
                      Mute 10m
                    </button>
                    {showUnavailableActions ? (
                      <>
                        <button type="button" disabled title="Provider warning messages need the provider-write moderation phase.">
                          Provider warn
                        </button>
                        <button type="button" disabled title="Provider timeouts need audited provider-write clients and permission checks.">
                          Provider timeout
                        </button>
                      </>
                    ) : null}
                    <button type="button" disabled title="Needs a reviewed moderation allowlist model.">
                      Allow always
                    </button>
                    <button type="button" disabled title="Needs stream-scoped moderation state.">
                      Allow this stream
                    </button>
                    <button type="button" disabled title="Needs timed allowlist persistence.">
                      Allow x hours
                    </button>
                    <ActionUnavailableHint reasons={optionUnavailableReasons} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
