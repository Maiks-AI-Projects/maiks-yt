import type {
  DiscordChatProjectedMessage,
  TwitchChatProjectedMessage,
  YouTubeLiveChatProjectedMessage
} from "@maiks-yt/integrations";
import type { NormalizedProviderEventIntake } from "@maiks-yt/domain/events";

export type ProviderEventIntakeLogRepository = {
  write(input: NormalizedProviderEventIntake): Promise<{ inserted: boolean }>;
};

export type ProviderEventIntakeLogResult =
  | { ok: true; inserted: boolean }
  | { ok: false; reason: "invalid_provider_event" | "write_failed" };

export type ProviderEventIntakeLogServiceOptions = {
  now?: () => Date;
  repository: ProviderEventIntakeLogRepository;
};

export type ProviderChatMessageForIntake =
  | TwitchChatProjectedMessage
  | DiscordChatProjectedMessage
  | YouTubeLiveChatProjectedMessage;
