import type { StreamerChatLiveMessage, StreamerChatMessage } from "@maiks-yt/events";
import { useEffect, useState, type ReactNode } from "react";

import { createApiHeaders } from "../dev-auth-token.js";
import { chatSourceLabels } from "./chat-source-labels.service.js";
import { formatChatTime } from "./chat-time.service.js";
import { createAuthenticatedWebSocketUrl, defaultActionAccess, defaultTemporaryMuteDurationSeconds } from "./streamer-chat-viewer.service.js";
import { useChatAttention } from "./useChatAttention.js";
import type {
  FakeLocalModerationResponse,
  StreamerChatMessagesResponse,
  StreamerChatModerationResponse,
  StreamerChatProviderModerationResponse,
  StreamerChatViewerProps
} from "./streamer-chat-viewer.types.js";

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
    !actionAccess.canAllow ? "Allow needs chat:allow-message." : null,
    !actionAccess.canProviderModerate && (message.source === "discord" || message.source === "twitch")
      ? "Provider actions need chat:provider-moderate."
      : null,
    message.source !== "fake-local" ? "Note is a fake/local drill." : null,
    message.source === "discord" || message.source === "twitch" || message.source === "youtube"
      ? `${chatSourceLabels[message.source]} provider warning is attempted by the Warn action.`
      : "Provider warning messages are gated until provider-write clients and permission checks exist.",
    message.source === "youtube" ? "YouTube provider delete/timeout/ban are still gated." : null
  ].filter((reason): reason is string => reason !== null);
};

const ActionUnavailableHint = ({ reasons }: { reasons: readonly string[] }): ReactNode => reasons.length > 0 ? (
  <p className="streamer-chat-action-hint">
    {reasons.join(" ")}
  </p>
) : null;

const getProviderWarningStatusText = (
  message: StreamerChatMessage,
  result: Extract<StreamerChatModerationResponse, { ok: true }>
): string => {
  if (message.source !== "discord" && message.source !== "twitch" && message.source !== "youtube") {
    return "Provider warning messages are still gated.";
  }

  if (result.providerMessageSent) {
    return `${chatSourceLabels[message.source]} warning message sent.`;
  }

  if (result.providerAction) {
    return `${chatSourceLabels[message.source]} warning message failed${result.providerWarningReason ? `: ${result.providerWarningReason}.` : "."}`;
  }

  return `${chatSourceLabels[message.source]} warning message skipped because provider context or write credentials were missing.`;
};

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
  const chatAttention = useChatAttention(variant === "standalone");
  const visibleMessages = newestOnTop
    ? messages.slice(0, maxMessages)
    : messages.slice(0, maxMessages).reverse();

  const executeStreamerChatModeration = async (
    message: StreamerChatMessage,
    action: "hide" | "ban" | "warn",
    allowScope?: never
  ): Promise<void> => executeStreamerChatAction(message, action, allowScope);

  const executeStreamerChatAllow = async (
    message: StreamerChatMessage,
    allowScope: "message" | "always" | "stream" | "timed"
  ): Promise<void> => executeStreamerChatAction(message, "allow", allowScope);

  const executeStreamerChatAction = async (
    message: StreamerChatMessage,
    action: "hide" | "ban" | "warn" | "allow",
    allowScope?: "message" | "always" | "stream" | "timed"
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
          : action === "allow"
            ? "Allowing message locally."
            : "Warning author locally."
    );

    try {
      const response = await fetch(`${apiBaseUrl}/streamer-chat/moderation/${action}`, {
        body: JSON.stringify({
          accessToken: token,
          durationSeconds: action === "allow" && allowScope === "timed" ? 4 * 60 * 60 : null,
          scope: action === "allow" ? allowScope ?? "always" : undefined,
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
          : action === "allow"
            ? allowScope === "message"
              ? `Message allowed locally. Retract it from the moderation window when needed.`
              : allowScope === "timed"
                ? `${message.authorName} allowed locally until ${result.activeUntil ? formatChatTime(result.activeUntil) : "later"}.`
                : `${message.authorName} allowed locally${allowScope === "stream" ? " for this stream" : ""}. Retract it from the moderation window when needed.`
          : action === "ban"
            ? `${message.authorName} banned locally from stream surfaces. ${result.affectedCount} message(s) hidden.`
            : result.autoBanned
              ? `${message.authorName} reached warning ${result.warningCount}/${result.warningThreshold} and was locally banned.`
              : `${message.authorName} warned locally. ${result.warningCount}/${result.warningThreshold}. ${getProviderWarningStatusText(message, result)}`
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

  const executeProviderModeration = async (
    message: StreamerChatMessage,
    action: "delete_message" | "timeout_author" | "ban_author"
  ): Promise<void> => {
    if (message.source !== "discord" && message.source !== "twitch") {
      setActionStatus(`${chatSourceLabels[message.source]} provider actions are not available yet.`);
      return;
    }

    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setActionStatus("Control token missing.");
      return;
    }

    setActionStatus(
      action === "delete_message"
        ? `Deleting ${chatSourceLabels[message.source]} message.`
        : action === "timeout_author"
          ? `Timing out ${message.authorName} on ${chatSourceLabels[message.source]}.`
          : `Banning ${message.authorName} on ${chatSourceLabels[message.source]}.`
    );

    try {
      const response = await fetch(`${apiBaseUrl}/streamer-chat/moderation/provider-action`, {
        body: JSON.stringify({
          accessToken: token,
          action,
          durationSeconds: action === "timeout_author" ? defaultTemporaryMuteDurationSeconds : null,
          targetMessageId: message.id
        }),
        credentials: "include",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        method: "POST"
      });
      const result = await response.json() as StreamerChatProviderModerationResponse;

      if (!response.ok) {
        throw new Error("Provider moderation request failed.");
      }

      if (!result.ok) {
        throw new Error(result.reason);
      }

      if (result.providerActionSent) {
        if (action === "delete_message") {
          setMessages((currentMessages) => currentMessages.filter((currentMessage) => currentMessage.id !== message.id));
        }

        if (action === "ban_author") {
          setMessages((currentMessages) => currentMessages.filter((currentMessage) =>
            currentMessage.source !== message.source
            || currentMessage.authorName.trim().toLowerCase() !== message.authorName.trim().toLowerCase()
          ));
        }
      }

      setOpenOptionsMessageId(null);
      setActionStatus(
        result.providerActionSent
          ? action === "delete_message"
            ? `${chatSourceLabels[message.source]} message delete sent.`
            : action === "timeout_author"
              ? `${message.authorName} timeout sent to ${chatSourceLabels[message.source]}.`
              : `${message.authorName} ban sent to ${chatSourceLabels[message.source]}.`
          : `${chatSourceLabels[message.source]} provider action skipped${result.providerActionReason ? `: ${result.providerActionReason}.` : "."}`
      );
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "Provider moderation failed.");
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
          chatAttention.baselineMessages(result.messages);
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
          chatAttention.baselineMessages(liveMessage.payload.messages);
          setMessages(liveMessage.payload.messages);
          return;
        }

        chatAttention.notifyMessage(liveMessage.payload);
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
  }, [apiBaseUrl, chatAttention.baselineMessages, chatAttention.notifyMessage]);

  return (
    <div className={`streamer-chat-viewer ${variant}`} aria-label="Streamer chat viewer">
      <div className="streamer-chat-header">
        <strong>{variant === "standalone" ? "Live Chat" : "Streamer chat"}</strong>
        <span>{status}</span>
        {actionStatus ? <span>{actionStatus}</span> : null}
      </div>
      {variant === "standalone" ? chatAttention.controls : null}
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
                    {message.source === "fake-local" ? (
                      <button
                        type="button"
                        onClick={() => void executeFakeLocalModeration(message, "temporary_mute_author", "Muted for 10 minutes from streamer chat options.")}
                        title="Mute this fake/local author for 10 minutes."
                      >
                        Mute 10m
                      </button>
                    ) : null}
                    {message.source === "discord" || message.source === "twitch" || showUnavailableActions ? (
                      <>
                        <button
                          type="button"
                          disabled={!actionAccess.canProviderModerate || (message.source !== "discord" && message.source !== "twitch")}
                          onClick={() => void executeProviderModeration(message, "delete_message")}
                          title={actionAccess.canProviderModerate ? "Delete the origin provider message." : "Missing chat:provider-moderate permission."}
                        >
                          Provider delete
                        </button>
                        <button
                          type="button"
                          disabled={!actionAccess.canProviderModerate || (message.source !== "discord" && message.source !== "twitch")}
                          onClick={() => void executeProviderModeration(message, "timeout_author")}
                          title={actionAccess.canProviderModerate ? "Timeout the origin provider user for 10 minutes." : "Missing chat:provider-moderate permission."}
                        >
                          Provider timeout 10m
                        </button>
                        <button
                          type="button"
                          disabled={!actionAccess.canProviderModerate || (message.source !== "discord" && message.source !== "twitch")}
                          onClick={() => void executeProviderModeration(message, "ban_author")}
                          title={actionAccess.canProviderModerate ? "Ban the origin provider user." : "Missing chat:provider-moderate permission."}
                        >
                          Provider ban
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      disabled={!actionAccess.canAllow}
                      onClick={() => void executeStreamerChatAllow(message, "always")}
                      title={actionAccess.canAllow ? "Allow this author on Maiks.yt stream surfaces until retracted." : "Missing chat:allow-message permission."}
                    >
                      Allow always
                    </button>
                    <button
                      type="button"
                      disabled={!actionAccess.canAllow}
                      onClick={() => void executeStreamerChatAllow(message, "stream")}
                      title={actionAccess.canAllow ? "Allow this author for the current stream/testing window." : "Missing chat:allow-message permission."}
                    >
                      Allow this stream
                    </button>
                    <button
                      type="button"
                      disabled={!actionAccess.canAllow}
                      onClick={() => void executeStreamerChatAllow(message, "timed")}
                      title={actionAccess.canAllow ? "Allow this author for four hours." : "Missing chat:allow-message permission."}
                    >
                      Allow 4h
                    </button>
                    <button
                      type="button"
                      disabled={!actionAccess.canAllow}
                      onClick={() => void executeStreamerChatAllow(message, "message")}
                      title={actionAccess.canAllow ? "Allow only this message on Maiks.yt stream surfaces." : "Missing chat:allow-message permission."}
                    >
                      Allow message
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
