import { useEffect, useState, type ReactNode } from "react";

import { formatChatTime } from "./chat-time.service.js";
import { withDevAuthToken } from "../dev-auth-token.js";
import { createWebUrl } from "../runtime-config.service.js";
import {
  discordIntakeStateLabels,
  getDiscordIntakeStatusCopy,
  getDiscordServiceTone,
  getServiceStatusLabel,
  getTwitchIntakeStatusCopy,
  getTwitchServiceTone,
  getYouTubeIntakeStatusCopy,
  getYouTubeServiceTone,
  twitchIntakeStateLabels,
  youtubeIntakeStateLabels
} from "./chat-service-status.service.js";
import type {
  ChatServiceStatusStripProps,
  DiscordChatIntakeStatus,
  DiscordChatStatusResponse,
  TwitchChatIntakeStatus,
  TwitchChatStatusResponse,
  YouTubeLiveChatIntakeStatus,
  YouTubeLiveChatStatusResponse
} from "./chat-service-status.types.js";

export const ChatServiceStatusStrip = ({ apiBaseUrl }: ChatServiceStatusStripProps): ReactNode => {
  const [status, setStatus] = useState<TwitchChatIntakeStatus | null>(null);
  const [discordStatus, setDiscordStatus] = useState<DiscordChatIntakeStatus | null>(null);
  const [youtubeStatus, setYouTubeStatus] = useState<YouTubeLiveChatIntakeStatus | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [discordCheckedAt, setDiscordCheckedAt] = useState<string | null>(null);
  const [youtubeCheckedAt, setYouTubeCheckedAt] = useState<string | null>(null);
  const [message, setMessage] = useState("Loading Twitch intake state.");
  const [discordMessage, setDiscordMessage] = useState("Loading Discord intake state.");
  const [youtubeMessage, setYouTubeMessage] = useState("Loading YouTube live-chat state.");
  const [actionPending, setActionPending] = useState(false);
  const [discordActionPending, setDiscordActionPending] = useState(false);
  const [youtubeActionPending, setYouTubeActionPending] = useState(false);
  const openProviderAdmin = (): void => {
    window.location.assign(withDevAuthToken(createWebUrl("/admin/provider-integrations")));
  };

  const loadStatus = async (isDisposed: () => boolean = () => false): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");
    if (!token) {
      setMessage("Control token missing.");
      return;
    }

    try {
      const url = new URL("/streamer-chat/twitch-status", apiBaseUrl);
      url.searchParams.set("accessToken", token);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Twitch intake status failed with ${response.status}.`);
      }

      const result = await response.json() as TwitchChatStatusResponse;

      if (!result.ok) {
        throw new Error(result.reason);
      }

      if (!isDisposed()) {
        setStatus(result.status);
        setCheckedAt(result.checkedAt);
        setMessage(getTwitchIntakeStatusCopy(result.status));
      }
    } catch (error) {
      if (!isDisposed()) {
        setMessage(error instanceof Error ? error.message : "Twitch intake status unavailable.");
      }
    }
  };

  const loadDiscordStatus = async (isDisposed: () => boolean = () => false): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");
    if (!token) {
      setDiscordMessage("Control token missing.");
      return;
    }

    try {
      const url = new URL("/streamer-chat/discord-status", apiBaseUrl);
      url.searchParams.set("accessToken", token);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Discord intake status failed with ${response.status}.`);
      }

      const result = await response.json() as DiscordChatStatusResponse;

      if (!result.ok) {
        throw new Error(result.reason);
      }

      if (!isDisposed()) {
        setDiscordStatus(result.status);
        setDiscordCheckedAt(result.checkedAt);
        setDiscordMessage(getDiscordIntakeStatusCopy(result.status));
      }
    } catch (error) {
      if (!isDisposed()) {
        setDiscordMessage(error instanceof Error ? error.message : "Discord intake status unavailable.");
      }
    }
  };

  const loadYouTubeStatus = async (isDisposed: () => boolean = () => false): Promise<void> => {
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");
    if (!token) {
      setYouTubeMessage("Control token missing.");
      return;
    }

    try {
      const url = new URL("/streamer-chat/youtube-status", apiBaseUrl);
      url.searchParams.set("accessToken", token);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`YouTube live-chat status failed with ${response.status}.`);
      }

      const result = await response.json() as YouTubeLiveChatStatusResponse;

      if (!result.ok) {
        throw new Error(result.reason);
      }

      if (!isDisposed()) {
        setYouTubeStatus(result.status);
        setYouTubeCheckedAt(result.checkedAt);
        setYouTubeMessage(getYouTubeIntakeStatusCopy(result.status));
      }
    } catch (error) {
      if (!isDisposed()) {
        setYouTubeMessage(error instanceof Error ? error.message : "YouTube live-chat status unavailable.");
      }
    }
  };

  useEffect(() => {
    let disposed = false;

    void loadStatus(() => disposed);
    void loadDiscordStatus(() => disposed);
    void loadYouTubeStatus(() => disposed);
    const intervalId = window.setInterval(() => {
      void loadStatus(() => disposed);
      void loadDiscordStatus(() => disposed);
      void loadYouTubeStatus(() => disposed);
    }, 10000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const handleTwitchServiceClick = async (): Promise<void> => {
    if (status?.state === "unconfigured" || status?.reconnectSuppressed) {
      openProviderAdmin();
      return;
    }

    if (status?.state === "connected" || status?.state === "connecting" || actionPending) {
      return;
    }

    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setMessage("Control token missing.");
      return;
    }

    setActionPending(true);
    setMessage("Trying to reconnect Twitch chat.");

    try {
      const response = await fetch(`${apiBaseUrl}/streamer-chat/twitch-reconnect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ accessToken: token })
      });

      if (!response.ok) {
        throw new Error(`Twitch reconnect failed with ${response.status}.`);
      }

      const result = await response.json() as TwitchChatStatusResponse;

      if (!result.ok) {
        throw new Error(result.reason);
      }

      setStatus(result.status);
      setCheckedAt(result.checkedAt);
      setMessage(getTwitchIntakeStatusCopy(result.status));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Twitch reconnect unavailable.");
    } finally {
      setActionPending(false);
      void loadStatus();
    }
  };

  const handleDiscordServiceClick = async (): Promise<void> => {
    if (discordStatus?.state === "unconfigured" || discordStatus?.reconnectSuppressed) {
      openProviderAdmin();
      return;
    }

    if (discordStatus?.state === "connected" || discordStatus?.state === "connecting" || discordActionPending) {
      return;
    }

    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setDiscordMessage("Control token missing.");
      return;
    }

    setDiscordActionPending(true);
    setDiscordMessage("Trying to reconnect Discord chat.");

    try {
      const response = await fetch(`${apiBaseUrl}/streamer-chat/discord-reconnect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ accessToken: token })
      });

      if (!response.ok) {
        throw new Error(`Discord reconnect failed with ${response.status}.`);
      }

      const result = await response.json() as DiscordChatStatusResponse;

      if (!result.ok) {
        throw new Error(result.reason);
      }

      setDiscordStatus(result.status);
      setDiscordCheckedAt(result.checkedAt);
      setDiscordMessage(getDiscordIntakeStatusCopy(result.status));
    } catch (error) {
      setDiscordMessage(error instanceof Error ? error.message : "Discord reconnect unavailable.");
    } finally {
      setDiscordActionPending(false);
      void loadDiscordStatus();
    }
  };

  const handleYouTubeServiceClick = async (): Promise<void> => {
    if (youtubeStatus?.state === "unconfigured") {
      openProviderAdmin();
      return;
    }

    if (youtubeStatus?.state === "connected" || youtubeStatus?.state === "connecting" || youtubeStatus?.state === "waiting" || youtubeActionPending) {
      return;
    }

    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    if (!token) {
      setYouTubeMessage("Control token missing.");
      return;
    }

    setYouTubeActionPending(true);
    setYouTubeMessage("Starting YouTube live-chat polling.");

    try {
      const response = await fetch(`${apiBaseUrl}/streamer-chat/youtube-reconnect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ accessToken: token })
      });

      if (!response.ok) {
        throw new Error(`YouTube live-chat start failed with ${response.status}.`);
      }

      const result = await response.json() as YouTubeLiveChatStatusResponse;

      if (!result.ok) {
        throw new Error(result.reason);
      }

      setYouTubeStatus(result.status);
      setYouTubeCheckedAt(result.checkedAt);
      setYouTubeMessage(getYouTubeIntakeStatusCopy(result.status));
    } catch (error) {
      setYouTubeMessage(error instanceof Error ? error.message : "YouTube live-chat start unavailable.");
    } finally {
      setYouTubeActionPending(false);
      void loadYouTubeStatus();
    }
  };

  const twitchTone = getTwitchServiceTone(status);
  const twitchDetail = [
    status ? twitchIntakeStateLabels[status.state] : "Loading",
    status?.channelName ? `#${status.channelName}` : null,
    status?.lastMessageAt ? `last ${formatChatTime(status.lastMessageAt)}` : null,
    status?.nextReconnectAt ? `retry ${formatChatTime(status.nextReconnectAt)}` : null,
    status?.disconnectsInWindow ? `${status.disconnectsInWindow}/10 disconnects` : null
  ].filter(Boolean).join(" - ");
  const twitchTitle = `${message}${checkedAt ? ` Checked ${formatChatTime(checkedAt)}.` : ""}`;
  const discordTone = getDiscordServiceTone(discordStatus);
  const discordDetail = [
    discordStatus ? discordIntakeStateLabels[discordStatus.state] : "Loading",
    discordStatus?.channelIds.length ? `${discordStatus.channelIds.length} channel(s)` : "guild-wide",
    discordStatus?.lastMessageAt ? `last ${formatChatTime(discordStatus.lastMessageAt)}` : null,
    discordStatus?.nextReconnectAt ? `retry ${formatChatTime(discordStatus.nextReconnectAt)}` : null,
    discordStatus?.disconnectsInWindow ? `${discordStatus.disconnectsInWindow}/10 disconnects` : null
  ].filter(Boolean).join(" - ");
  const discordTitle = `${discordMessage}${discordCheckedAt ? ` Checked ${formatChatTime(discordCheckedAt)}.` : ""}`;
  const youtubeTone = getYouTubeServiceTone(youtubeStatus);
  const youtubeDetail = [
    youtubeStatus ? youtubeIntakeStateLabels[youtubeStatus.state] : "Loading",
    youtubeStatus?.channelName ? youtubeStatus.channelName : null,
    youtubeStatus?.lastMessageAt ? `last ${formatChatTime(youtubeStatus.lastMessageAt)}` : null,
    youtubeStatus?.nextPollAt ? `next ${formatChatTime(youtubeStatus.nextPollAt)}` : null
  ].filter(Boolean).join(" - ");
  const youtubeTitle = `${youtubeMessage}${youtubeCheckedAt ? ` Checked ${formatChatTime(youtubeCheckedAt)}.` : ""}`;

  return (
    <section className="chat-service-status" aria-label="Connected chat services">
      <button
        className={`chat-service-indicator ${twitchTone}`}
        disabled={status?.state === "connected" || status?.state === "connecting" || actionPending}
        onClick={handleTwitchServiceClick}
        title={twitchTitle}
        type="button"
      >
        <span className="chat-service-dot" aria-hidden="true" />
        <span className="chat-service-name">Twitch</span>
        <small>{twitchDetail || getServiceStatusLabel(twitchTone)}</small>
      </button>
      <button
        className={`chat-service-indicator ${youtubeTone}`}
        disabled={youtubeStatus?.state === "connected" || youtubeStatus?.state === "connecting" || youtubeStatus?.state === "waiting" || youtubeActionPending}
        onClick={handleYouTubeServiceClick}
        title={youtubeTitle}
        type="button"
      >
        <span className="chat-service-dot" aria-hidden="true" />
        <span className="chat-service-name">YouTube</span>
        <small>{youtubeDetail || getServiceStatusLabel(youtubeTone)}</small>
      </button>
      <button
        className={`chat-service-indicator ${discordTone}`}
        disabled={discordStatus?.state === "connected" || discordStatus?.state === "connecting" || discordActionPending}
        onClick={handleDiscordServiceClick}
        title={discordTitle}
        type="button"
      >
        <span className="chat-service-dot" aria-hidden="true" />
        <span className="chat-service-name">Discord</span>
        <small>{discordDetail || getServiceStatusLabel(discordTone)}</small>
      </button>
    </section>
  );
};
