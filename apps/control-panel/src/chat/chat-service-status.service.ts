import { formatChatTime } from "./chat-time.service.js";
import type {
  DiscordChatIntakeStatus,
  ServiceConnectionTone,
  TwitchChatIntakeStatus,
  YouTubeLiveChatIntakeStatus
} from "./chat-service-status.types.js";

export const twitchIntakeStateLabels: Record<TwitchChatIntakeStatus["state"], string> = {
  connected: "Connected",
  connecting: "Connecting",
  stopped: "Stopped",
  unconfigured: "Not configured"
};
export const discordIntakeStateLabels: Record<DiscordChatIntakeStatus["state"], string> = twitchIntakeStateLabels;
export const youtubeIntakeStateLabels: Record<YouTubeLiveChatIntakeStatus["state"], string> = {
  connected: "Connected",
  connecting: "Checking",
  quota_exhausted: "Quota exhausted",
  stopped: "Stopped",
  unconfigured: "Not configured",
  waiting: "Waiting"
};

export const getTwitchIntakeStatusCopy = (status: TwitchChatIntakeStatus | null): string => {
  if (!status) {
    return "Loading Twitch intake state.";
  }

  if (status.reconnectSuppressed) {
    return status.issue?.copy ?? "Auto reconnect paused after repeated disconnects. Open provider admin or retry manually.";
  }

  if (status.issue) {
    return status.issue.copy;
  }

  switch (status.state) {
    case "connected":
      return status.lastMessageAt
        ? `Last message ${formatChatTime(status.lastMessageAt)}.`
        : "Waiting for the next Twitch message.";
    case "connecting":
      return "Connecting to Twitch chat.";
    case "stopped":
      return "Twitch chat intake is stopped.";
    case "unconfigured":
      return "Twitch channel is not configured.";
  }
};

export const getDiscordIntakeStatusCopy = (status: DiscordChatIntakeStatus | null): string => {
  if (!status) {
    return "Loading Discord intake state.";
  }

  if (status.reconnectSuppressed) {
    return status.issue?.copy ?? "Auto reconnect paused after repeated Discord disconnects. Open provider admin or retry manually.";
  }

  if (status.issue) {
    return status.issue.copy;
  }

  switch (status.state) {
    case "connected":
      return status.lastMessageAt
        ? `Last Discord message ${formatChatTime(status.lastMessageAt)}.`
        : "Waiting for the next Discord message.";
    case "connecting":
      return "Connecting to Discord Gateway.";
    case "stopped":
      return "Discord chat intake is stopped.";
    case "unconfigured":
      return "Discord bot or guild is not configured.";
  }
};

export const getYouTubeIntakeStatusCopy = (status: YouTubeLiveChatIntakeStatus | null): string => {
  if (!status) {
    return "Loading YouTube live-chat state.";
  }

  if (status.issue) {
    return status.issue.copy;
  }

  switch (status.state) {
    case "connected":
      return status.lastMessageAt
        ? `Last YouTube message ${formatChatTime(status.lastMessageAt)}.`
        : "Connected to YouTube live chat.";
    case "connecting":
      return "Checking for active YouTube live chat.";
    case "waiting":
      return "Waiting for an active YouTube live chat.";
    case "stopped":
      return "YouTube live-chat streaming is stopped.";
    case "quota_exhausted":
      return "YouTube API quota is exhausted. Retry after the quota resets.";
    case "unconfigured":
      return "YouTube credential or selected channel is missing.";
  }
};

export const getTwitchServiceTone = (status: TwitchChatIntakeStatus | null): ServiceConnectionTone => {
  if (!status) {
    return "loading";
  }

  if (status.state === "connected" && !status.issue && !status.reconnectSuppressed) {
    return "connected";
  }

  if (status.state === "connecting" || status.issue || status.reconnectSuppressed) {
    return "problem";
  }

  return "disconnected";
};

export const getDiscordServiceTone = (status: DiscordChatIntakeStatus | null): ServiceConnectionTone => {
  if (!status) {
    return "loading";
  }

  if (status.state === "connected" && !status.issue && !status.reconnectSuppressed) {
    return "connected";
  }

  if (status.state === "connecting" || status.issue || status.reconnectSuppressed) {
    return "problem";
  }

  return "disconnected";
};

export const getYouTubeServiceTone = (status: YouTubeLiveChatIntakeStatus | null): ServiceConnectionTone => {
  if (!status) {
    return "loading";
  }

  if (status.state === "connected" && !status.issue) {
    return "connected";
  }

  if (status.state === "connecting" || status.state === "waiting" || status.state === "quota_exhausted" || status.issue) {
    return "problem";
  }

  return "disconnected";
};

export const getServiceStatusLabel = (tone: ServiceConnectionTone): string => {
  switch (tone) {
    case "connected":
      return "connected";
    case "problem":
      return "problem";
    case "disconnected":
      return "disconnected";
    case "loading":
      return "checking";
  }
};
