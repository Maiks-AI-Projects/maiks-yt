import type { StreamerChatLiveMessage, StreamerChatMessage } from "@maiks-yt/events";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { apiFetch } from "../dev-auth-token.js";
import { chatSourceLabels } from "./chat-source-labels.service.js";
import { formatChatTime } from "./chat-time.service.js";
import {
  canOpenStreamerChatOptions,
  createAuthenticatedWebSocketUrl,
  defaultProviderTimeoutDurationSeconds,
  noStreamerChatActionAccess
} from "./streamer-chat-viewer.service.js";
import { useChatAttention } from "./useChatAttention.js";
import type {
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

const getChatAvatarInitials = (authorName: string): string => {
  const cleanedParts = authorName
    .replaceAll("_", " ")
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);

  if (cleanedParts.length === 0) {
    return "?";
  }

  return cleanedParts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
};

const sourceGlyphs: Record<StreamerChatMessage["source"], string> = {
  discord: "◖",
  "fake-local": "◇",
  twitch: "▱",
  youtube: "▶"
};

export const StreamerChatViewer = ({
  actionAccess = noStreamerChatActionAccess,
  apiBaseUrl,
  maxMessages = 12,
  newestOnTop,
  onSelectedMessageChange,
  showUnavailableActions = false,
  variant = "embedded"
}: StreamerChatViewerProps): ReactNode => {
  const [messages, setMessages] = useState<StreamerChatMessage[]>([]);
  const [status, setStatus] = useState<string>("Loading streamer chat.");
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [openOptionsMessageId, setOpenOptionsMessageId] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [liveFollowPaused, setLiveFollowPaused] = useState(false);
  const [newWhilePausedCount, setNewWhilePausedCount] = useState(0);
  const messageListRef = useRef<HTMLOListElement | null>(null);
  const liveFollowPausedRef = useRef(false);
  const chatAttention = useChatAttention(variant === "standalone");
  const visibleMessages = newestOnTop
    ? messages.slice(0, maxMessages)
    : messages.slice(0, maxMessages).reverse();

  useEffect(() => {
    onSelectedMessageChange?.(messages.find((message) => message.id === selectedMessageId) ?? null);
  }, [messages, onSelectedMessageChange, selectedMessageId]);

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
    if (action === "ban" && !window.confirm(`Ban ${message.authorName} locally from Maiks.yt stream chat surfaces?`)) {
      return;
    }

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
      const response = await apiFetch(`${apiBaseUrl}/streamer-chat/moderation/${action}`, {
        body: JSON.stringify({
          accessToken: token,
          durationSeconds: action === "allow" && allowScope === "timed" ? 4 * 60 * 60 : null,
          scope: action === "allow" ? allowScope ?? "always" : undefined,
          targetMessageId: message.id
        }),
        headers: {
          "Content-Type": "application/json"
        },
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
      setSelectedMessageId(null);
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

  const executeProviderModeration = async (
    message: StreamerChatMessage,
    action: "delete_message" | "timeout_author" | "ban_author"
  ): Promise<void> => {
    if (message.source !== "discord" && message.source !== "twitch") {
      setActionStatus(`${chatSourceLabels[message.source]} provider actions are not available yet.`);
      return;
    }

    if (action === "ban_author" && !window.confirm(`Ban ${message.authorName} on ${chatSourceLabels[message.source]}?`)) {
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
      const response = await apiFetch(`${apiBaseUrl}/streamer-chat/moderation/provider-action`, {
        body: JSON.stringify({
          accessToken: token,
          action,
          durationSeconds: action === "timeout_author" ? defaultProviderTimeoutDurationSeconds : null,
          targetMessageId: message.id
        }),
        headers: {
          "Content-Type": "application/json"
        },
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
      setSelectedMessageId(null);
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
        const response = await apiFetch(url);

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
        if (variant === "standalone" && liveFollowPausedRef.current) {
          setNewWhilePausedCount((currentCount) => currentCount + 1);
        }
        setMessages((currentMessages) => [
          liveMessage.payload,
          ...currentMessages.filter((message) => message.id !== liveMessage.payload.id)
        ].slice(0, 75));
        window.requestAnimationFrame(() => {
          if (!disposed && variant === "standalone" && !liveFollowPausedRef.current) {
            messageListRef.current?.scrollTo({ top: 0 });
          }
        });
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
  }, [apiBaseUrl, chatAttention.baselineMessages, chatAttention.notifyMessage, variant]);

  const handleMessageListScroll = (): void => {
    if (variant !== "standalone") {
      return;
    }

    const listElement = messageListRef.current;

    if (!listElement) {
      return;
    }

    const paused = listElement.scrollTop > 12;

    liveFollowPausedRef.current = paused;
    setLiveFollowPaused(paused);
    if (!paused) {
      setNewWhilePausedCount(0);
    }
  };

  const resumeLiveFollow = (): void => {
    messageListRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    liveFollowPausedRef.current = false;
    setLiveFollowPaused(false);
    setNewWhilePausedCount(0);
  };

  return (
    <div className={`streamer-chat-viewer ${variant}`} aria-label="Streamer chat viewer">
      <div className="streamer-chat-header">
        <strong>{variant === "standalone" ? "Live Chat" : "Streamer chat"}</strong>
        <span>{status}</span>
        {actionStatus ? <span>{actionStatus}</span> : null}
        {variant === "standalone" ? (
          <div className="streamer-chat-header-actions">
            <button
              type="button"
              className={`chat-follow-toggle ${liveFollowPaused ? "paused" : ""}`}
              onClick={resumeLiveFollow}
            >
              {liveFollowPaused
                ? newWhilePausedCount > 0
                  ? `${newWhilePausedCount} new - resume`
                  : "Resume live"
                : "Live-follow"}
            </button>
            {chatAttention.controls}
          </div>
        ) : null}
      </div>
      {visibleMessages.length === 0 ? (
        <p className="streamer-chat-empty">No streamer chat messages yet.</p>
      ) : (
        <ol
          className={`streamer-chat-list ${newestOnTop ? "newest-on-top" : "newest-on-bottom"}`}
          onScroll={handleMessageListScroll}
          ref={messageListRef}
        >
          {visibleMessages.map((message) => {
            const optionsOpen = openOptionsMessageId === message.id;
            const selected = selectedMessageId === message.id;
            const primaryUnavailableReasons = getPrimaryUnavailableReasons(actionAccess, showUnavailableActions);
            const optionUnavailableReasons = getOptionUnavailableReasons(message, actionAccess, showUnavailableActions);

            return (
              <li
                className={[
                  message.visibleOnOverlayByDefault ? "overlay-visible" : "streamer-only",
                  `source-${message.source}`,
                  selected ? "selected" : ""
                ].join(" ")}
                key={message.id}
                onFocus={() => setSelectedMessageId(message.id)}
                onPointerDown={(event) => {
                  if (event.pointerType === "touch" || event.pointerType === "pen") {
                    setSelectedMessageId(message.id);
                  }
                }}
                tabIndex={0}
              >
                <span className="streamer-chat-avatar" aria-hidden="true">{getChatAvatarInitials(message.authorName)}</span>
                <strong className="streamer-chat-author" title={message.authorName}>{message.authorName}</strong>
                <time className="streamer-chat-time" dateTime={message.createdAt}>{formatChatTime(message.createdAt)}</time>
                <span className="streamer-chat-provider">
                  <span aria-hidden="true" className="streamer-chat-provider-glyph">{sourceGlyphs[message.source]}</span>
                  {chatSourceLabels[message.source]}
                </span>
                <p className="streamer-chat-message">{message.message}</p>
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
                  {canOpenStreamerChatOptions(actionAccess, message.source) || showUnavailableActions ? (
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
                    {actionAccess.canHide || showUnavailableActions ? (
                      <button
                        type="button"
                        className="touch-primary-action"
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
                        className="touch-primary-action"
                        disabled={!actionAccess.canBan}
                        onClick={() => void executeStreamerChatModeration(message, "ban")}
                        title={actionAccess.canBan
                          ? "Ban this author from Maiks.yt stream chat surfaces locally."
                          : "Missing chat:ban-user-local permission."}
                      >
                        Ban
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
