import type {
  DiscordChatIntakeStatus,
  TwitchChatIntakeStatus,
  YouTubeLiveChatIntakeStatus
} from "@maiks-yt/integrations";

export type StreamerChatProviderStatusIssueCode =
  | "discord_not_configured"
  | "discord_reconnect_suppressed"
  | "discord_runtime_problem"
  | "twitch_not_configured"
  | "twitch_reconnect_suppressed"
  | "twitch_runtime_problem"
  | "youtube_not_configured"
  | "youtube_runtime_problem";

export type StreamerChatProviderStatusIssue = {
  code: StreamerChatProviderStatusIssueCode;
  copy: string;
};

export type TwitchStreamerChatStatusProjection = {
  provider: "twitch";
  state: TwitchChatIntakeStatus["state"];
  targetLabel: string | null;
  lastMessageAt: string | null;
  nextRetryAt: string | null;
  reconnectSuppressed: boolean;
  issue: StreamerChatProviderStatusIssue | null;
};

export type DiscordStreamerChatStatusProjection = {
  provider: "discord";
  state: DiscordChatIntakeStatus["state"];
  targetLabel: string | null;
  lastMessageAt: string | null;
  nextRetryAt: string | null;
  reconnectSuppressed: boolean;
  issue: StreamerChatProviderStatusIssue | null;
};

export type YouTubeStreamerChatStatusProjection = {
  provider: "youtube";
  state: YouTubeLiveChatIntakeStatus["state"];
  targetLabel: string | null;
  lastMessageAt: string | null;
  nextPollAt: string | null;
  reconnectSuppressed: false;
  issue: StreamerChatProviderStatusIssue | null;
};

const safeLabelPart = (value: string | null | undefined): string | null => {
  const normalized = value?.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim() ?? "";
  return normalized.length > 0 ? normalized.slice(0, 80) : null;
};

const formatTwitchTargetLabel = (status: TwitchChatIntakeStatus): string | null => {
  const names = status.channelNames
    .map((name) => safeLabelPart(name))
    .filter((name): name is string => name !== null);
  const labelNames = names.length > 0
    ? names
    : [safeLabelPart(status.channelName)].filter((name): name is string => name !== null);

  if (labelNames.length === 0) {
    return null;
  }

  return labelNames.map((name) => `#${name}`).join(" + ");
};

const formatDiscordTargetLabel = (status: DiscordChatIntakeStatus): string | null => {
  if (status.channelIds.length > 0) {
    return status.channelIds.length === 1 ? "1 selected channel" : `${Math.min(status.channelIds.length, 999)} selected channels`;
  }

  return status.guildId ? "Guild-wide intake" : null;
};

const issueForRealtimeProvider = (
  provider: "discord" | "twitch",
  status: DiscordChatIntakeStatus | TwitchChatIntakeStatus
): StreamerChatProviderStatusIssue | null => {
  if (status.reconnectSuppressed) {
    return {
      code: `${provider}_reconnect_suppressed`,
      copy: "Auto reconnect is paused after repeated disconnects. Open provider admin or retry manually."
    };
  }

  if (status.state === "unconfigured") {
    return {
      code: `${provider}_not_configured`,
      copy: `${provider === "twitch" ? "Twitch chat" : "Discord chat"} intake is not configured.`
    };
  }

  if (status.lastError) {
    return {
      code: `${provider}_runtime_problem`,
      copy: `${provider === "twitch" ? "Twitch chat" : "Discord chat"} intake needs attention. Open provider admin for details.`
    };
  }

  return null;
};

const issueForYouTube = (status: YouTubeLiveChatIntakeStatus): StreamerChatProviderStatusIssue | null => {
  if (status.state === "unconfigured") {
    return {
      code: "youtube_not_configured",
      copy: "YouTube live-chat polling is not configured."
    };
  }

  if (status.lastError) {
    return {
      code: "youtube_runtime_problem",
      copy: "YouTube live-chat polling needs attention. Open provider admin for details."
    };
  }

  return null;
};

export const projectTwitchStreamerChatStatus = (status: TwitchChatIntakeStatus): TwitchStreamerChatStatusProjection => ({
  provider: "twitch",
  state: status.state,
  targetLabel: formatTwitchTargetLabel(status),
  lastMessageAt: status.lastMessageAt,
  nextRetryAt: status.nextReconnectAt,
  reconnectSuppressed: status.reconnectSuppressed,
  issue: issueForRealtimeProvider("twitch", status)
});

export const projectDiscordStreamerChatStatus = (status: DiscordChatIntakeStatus): DiscordStreamerChatStatusProjection => ({
  provider: "discord",
  state: status.state,
  targetLabel: formatDiscordTargetLabel(status),
  lastMessageAt: status.lastMessageAt,
  nextRetryAt: status.nextReconnectAt,
  reconnectSuppressed: status.reconnectSuppressed,
  issue: issueForRealtimeProvider("discord", status)
});

export const projectYouTubeStreamerChatStatus = (status: YouTubeLiveChatIntakeStatus): YouTubeStreamerChatStatusProjection => ({
  provider: "youtube",
  state: status.state,
  targetLabel: safeLabelPart(status.channelName),
  lastMessageAt: status.lastMessageAt,
  nextPollAt: status.nextPollAt,
  reconnectSuppressed: false,
  issue: issueForYouTube(status)
});
