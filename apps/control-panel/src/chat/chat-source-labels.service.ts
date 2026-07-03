import type { StreamerChatMessage } from "@maiks-yt/events";

export const chatSourceLabels: Record<StreamerChatMessage["source"], string> = {
  "fake-local": "Local",
  twitch: "Twitch",
  youtube: "YouTube",
  discord: "Discord"
};
