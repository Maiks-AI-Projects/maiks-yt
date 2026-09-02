export type ChatServiceStatusIssue = {
  code:
    | "discord_not_configured"
    | "discord_reconnect_suppressed"
    | "discord_runtime_problem"
    | "twitch_not_configured"
    | "twitch_reconnect_suppressed"
    | "twitch_runtime_problem"
    | "youtube_not_configured"
    | "youtube_runtime_problem";
  copy: string;
};

export type TwitchChatIntakeStatus = {
  provider: "twitch";
  state: "stopped" | "connecting" | "connected" | "unconfigured";
  targetLabel: string | null;
  joinedTargetLabel?: string | null;
  lastMessageAt: string | null;
  nextRetryAt: string | null;
  reconnectSuppressed: boolean;
  issue: ChatServiceStatusIssue | null;
};

export type DiscordChatIntakeStatus = {
  provider: "discord";
  state: "stopped" | "connecting" | "connected" | "unconfigured";
  targetLabel: string | null;
  lastMessageAt: string | null;
  nextRetryAt: string | null;
  reconnectSuppressed: boolean;
  issue: ChatServiceStatusIssue | null;
};

export type YouTubeLiveChatIntakeStatus = {
  provider: "youtube";
  state: "stopped" | "connecting" | "waiting" | "connected" | "unconfigured";
  targetLabel: string | null;
  lastMessageAt: string | null;
  nextPollAt: string | null;
  reconnectSuppressed: false;
  issue: ChatServiceStatusIssue | null;
};

export type TwitchChatStatusResponse = {
  ok: true;
  readOnly: true;
  status: TwitchChatIntakeStatus;
  checkedAt: string;
} | {
  ok: false;
  reason: string;
};

export type DiscordChatStatusResponse = {
  ok: true;
  readOnly: true;
  status: DiscordChatIntakeStatus;
  checkedAt: string;
} | {
  ok: false;
  reason: string;
};

export type YouTubeLiveChatStatusResponse = {
  ok: true;
  readOnly: true;
  status: YouTubeLiveChatIntakeStatus;
  checkedAt: string;
} | {
  ok: false;
  reason: string;
};

export type ServiceConnectionTone = "connected" | "problem" | "disconnected" | "loading";

export type ChatServiceStatusStripProps = {
  apiBaseUrl: string;
};
