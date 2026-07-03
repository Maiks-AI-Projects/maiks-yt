import { formatChatTime } from "./chat-time.service.js";
import type { DiscordChatIntakeStatus, ServiceConnectionTone, TwitchChatIntakeStatus } from "./chat-service-status.types.js";

export const twitchIntakeStateLabels: Record<TwitchChatIntakeStatus["state"], string> = {
  connected: "Connected",
  connecting: "Connecting",
  stopped: "Stopped",
  unconfigured: "Not configured"
};
export const discordIntakeStateLabels: Record<DiscordChatIntakeStatus["state"], string> = twitchIntakeStateLabels;

export const getTwitchIntakeStatusCopy = (status: TwitchChatIntakeStatus | null): string => {
  if (!status) {
    return "Loading Twitch intake state.";
  }

  if (status.reconnectSuppressed) {
    return "Auto reconnect paused after repeated disconnects. Open provider admin or retry manually.";
  }

  if (status.lastError) {
    return status.lastError;
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
    return "Auto reconnect paused after repeated Discord disconnects. Open provider admin or retry manually.";
  }

  if (status.lastError) {
    return status.lastError;
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

export const getTwitchServiceTone = (status: TwitchChatIntakeStatus | null): ServiceConnectionTone => {
  if (!status) {
    return "loading";
  }

  if (status.state === "connected" && !status.lastError && !status.reconnectSuppressed) {
    return "connected";
  }

  if (status.state === "connecting" || status.lastError || status.reconnectSuppressed) {
    return "problem";
  }

  return "disconnected";
};

export const getDiscordServiceTone = (status: DiscordChatIntakeStatus | null): ServiceConnectionTone => {
  if (!status) {
    return "loading";
  }

  if (status.state === "connected" && !status.lastError && !status.reconnectSuppressed) {
    return "connected";
  }

  if (status.state === "connecting" || status.lastError || status.reconnectSuppressed) {
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

