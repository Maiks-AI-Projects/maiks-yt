import type {
  DiscordChatProjectedMessage,
  TwitchChatProjectedMessage,
  YouTubeLiveChatProjectedMessage
} from "@maiks-yt/integrations";

export type AcceptedProviderChatMessage =
  | DiscordChatProjectedMessage
  | TwitchChatProjectedMessage
  | YouTubeLiveChatProjectedMessage;

export type ProviderChatMessageAcceptedEvent = {
  id: string;
  payload: AcceptedProviderChatMessage;
  type: "provider.chat.message.accepted";
};

export type ProviderChatMessageSubscriber = (
  event: ProviderChatMessageAcceptedEvent
) => void | Promise<void>;

type ProviderChatMessageDispatcherOptions = {
  maxRememberedEventIds?: number;
  onSubscriberError?: (input: {
    event: ProviderChatMessageAcceptedEvent;
    subscriberId: string;
  }) => void;
};

export type ProviderChatMessageDispatchResult = {
  deliveredSubscriberCount: number;
  duplicate: boolean;
  eventId: string;
};

const createEventId = (message: AcceptedProviderChatMessage): string =>
  `${message.source}:${message.providerMessageId}`;

export const isProviderChatMessageDispatcherEnabled = (
  env: Record<string, string | undefined>
): boolean => env.PROVIDER_CHAT_MESSAGE_DISPATCHER_ENABLED?.trim().toLowerCase() === "true";

export class ProviderChatMessageDispatcher {
  private readonly maxRememberedEventIds: number;
  private readonly onSubscriberError: ProviderChatMessageDispatcherOptions["onSubscriberError"];
  private readonly rememberedEventIds = new Set<string>();
  private readonly subscribers = new Map<string, ProviderChatMessageSubscriber>();

  public constructor(options: ProviderChatMessageDispatcherOptions = {}) {
    this.maxRememberedEventIds = Math.max(1, options.maxRememberedEventIds ?? 1_000);
    this.onSubscriberError = options.onSubscriberError;
  }

  public subscribe(subscriberId: string, subscriber: ProviderChatMessageSubscriber): () => void {
    if (this.subscribers.has(subscriberId)) {
      throw new Error(`Provider chat subscriber already registered: ${subscriberId}`);
    }

    this.subscribers.set(subscriberId, subscriber);

    return () => {
      this.subscribers.delete(subscriberId);
    };
  }

  public publish(message: AcceptedProviderChatMessage): ProviderChatMessageDispatchResult {
    const eventId = createEventId(message);

    if (this.rememberedEventIds.has(eventId)) {
      return {
        deliveredSubscriberCount: 0,
        duplicate: true,
        eventId
      };
    }

    this.rememberEventId(eventId);
    const event: ProviderChatMessageAcceptedEvent = {
      id: eventId,
      payload: structuredClone(message),
      type: "provider.chat.message.accepted"
    };
    let deliveredSubscriberCount = 0;

    for (const [subscriberId, subscriber] of this.subscribers) {
      try {
        const result = subscriber(structuredClone(event));
        deliveredSubscriberCount += 1;
        void Promise.resolve(result).catch(() => {
          this.reportSubscriberError(event, subscriberId);
        });
      } catch {
        this.reportSubscriberError(event, subscriberId);
      }
    }

    return {
      deliveredSubscriberCount,
      duplicate: false,
      eventId
    };
  }

  private rememberEventId(eventId: string): void {
    this.rememberedEventIds.add(eventId);

    while (this.rememberedEventIds.size > this.maxRememberedEventIds) {
      const oldest = this.rememberedEventIds.values().next().value as string | undefined;
      if (!oldest) {
        return;
      }
      this.rememberedEventIds.delete(oldest);
    }
  }

  private reportSubscriberError(event: ProviderChatMessageAcceptedEvent, subscriberId: string): void {
    try {
      this.onSubscriberError?.({
        event: structuredClone(event),
        subscriberId
      });
    } catch {
      // Diagnostic failure must not affect chat delivery or another subscriber.
    }
  }
}

export const dispatchOrDeliverProviderChatMessage = (input: {
  direct: (message: AcceptedProviderChatMessage) => void;
  dispatcher: ProviderChatMessageDispatcher;
  enabled: boolean;
  message: AcceptedProviderChatMessage;
}): void => {
  if (input.enabled) {
    input.dispatcher.publish(input.message);
    return;
  }

  input.direct(input.message);
};
