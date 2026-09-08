export const streamerChatAccessDeniedCloseCode = 1008;
export const streamerChatMaxReconnectDelayMs = 30_000;
export const streamerChatMinReconnectDelayMs = 1_000;

export const getStreamerChatReconnectDelayMs = (attempt: number): number => {
  const safeAttempt = Math.max(0, Math.min(attempt, 5));

  return Math.min(streamerChatMaxReconnectDelayMs, streamerChatMinReconnectDelayMs * 2 ** safeAttempt);
};

export const isStreamerChatAccessDeniedClose = ({
  code,
  reason
}: {
  code?: number;
  reason?: string;
}): boolean => {
  const normalizedReason = reason?.trim().toLowerCase() ?? "";

  return code === streamerChatAccessDeniedCloseCode
    || normalizedReason.includes("access_denied")
    || normalizedReason.includes("control_panel_access_denied")
    || normalizedReason.includes("invalid_request")
    || normalizedReason.includes("token_not_valid");
};

export const getStreamerChatReconnectMessage = (delayMs: number): string =>
  `Streamer chat live feed reconnecting in ${Math.ceil(delayMs / 1_000)}s.`;
