import type { StreamerChatMessage } from "@maiks-yt/events";
import type { ReactNode } from "react";

export type ChatAttentionPreferences = {
  cueEnabled: boolean;
  speechEnabled: boolean;
  desktopEnabled: boolean;
};

export type ChatAttentionControlsProps = {
  baselineMessages: (messages: readonly StreamerChatMessage[]) => void;
  notifyMessage: (message: StreamerChatMessage) => void;
  controls: ReactNode;
};
