import { normalizeProviderEventIntake } from "@maiks-yt/domain/events";

import type {
  ProviderChatMessageForIntake,
  ProviderEventIntakeLogRepository,
  ProviderEventIntakeLogResult,
  ProviderEventIntakeLogServiceOptions
} from "./provider-event-intake-log.types.js";

export class ProviderEventIntakeLogService {
  private readonly now: () => Date;
  private readonly repository: ProviderEventIntakeLogRepository;

  public constructor(options: ProviderEventIntakeLogServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.repository = options.repository;
  }

  public async recordChatMessage(message: ProviderChatMessageForIntake): Promise<ProviderEventIntakeLogResult> {
    const normalized = normalizeProviderEventIntake({
      actorDisplayName: message.authorName,
      mechanism: this.resolveMechanism(message),
      occurredAt: message.createdAt,
      provider: message.source,
      providerChannelId: this.resolveProviderChannelId(message),
      providerEventName: this.resolveProviderEventName(message),
      providerMessageId: message.providerMessageId,
      receivedAt: this.now(),
      redactedPayload: this.toRedactedPayload(message),
      sourceEventId: message.providerMessageId
    });

    if (!normalized.ok) {
      return {
        ok: false,
        reason: "invalid_provider_event"
      };
    }

    try {
      const result = await this.repository.write(normalized.value);
      return {
        inserted: result.inserted,
        ok: true
      };
    } catch {
      return {
        ok: false,
        reason: "write_failed"
      };
    }
  }

  private resolveProviderEventName(message: ProviderChatMessageForIntake): string {
    if (message.source === "twitch") {
      return "PRIVMSG";
    }

    if (message.source === "youtube") {
      return "textMessageEvent";
    }

    return "MESSAGE_CREATE";
  }

  private resolveMechanism(message: ProviderChatMessageForIntake) {
    if (message.source === "twitch") {
      return "twitch-irc";
    }

    if (message.source === "youtube") {
      return "youtube-live-chat";
    }

    return "discord-gateway";
  }

  private resolveProviderChannelId(message: ProviderChatMessageForIntake): string {
    if (message.source === "discord") {
      return message.channelId;
    }

    return message.channelName;
  }

  private toRedactedPayload(message: ProviderChatMessageForIntake): Record<string, unknown> {
    const basePayload = {
      authorKind: message.authorKind,
      authorName: message.authorName,
      createdAt: message.createdAt,
      message: message.message,
      providerMessageId: message.providerMessageId,
      source: message.source,
      visibleOnOverlayByDefault: message.visibleOnOverlayByDefault
    };

    if (message.source === "discord") {
      return {
        ...basePayload,
        channelId: message.channelId,
        channelName: message.channelName,
        guildId: message.guildId
      };
    }

    return {
      ...basePayload,
      channelName: message.channelName
    };
  }
}
