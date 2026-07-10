import type { ProviderChatModerationAction } from "./provider-chat-moderation.types.js";

const maxReasonLength = 500;

export const normalizeProviderModerationText = (value: string | null | undefined, maxLength = 191): string =>
  (value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
    .trim();

export const normalizeProviderModerationReason = (value: string): string =>
  normalizeProviderModerationText(value, maxReasonLength) || "Moderated from Maiks.yt streamer chat.";

export const normalizeProviderModerationDurationSeconds = (value: number | null | undefined): number =>
  Number.isInteger(value) && value && value > 0
    ? Math.min(value, 28 * 24 * 60 * 60)
    : 10 * 60;

export const createProviderModerationActionId = (
  provider: "discord" | "twitch",
  action: ProviderChatModerationAction,
  status: number | "ok" | "unavailable"
): string => `${provider}-${action}-${status}-${Date.now()}`;
