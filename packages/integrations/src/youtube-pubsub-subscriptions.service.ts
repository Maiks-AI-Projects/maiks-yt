import { resolveYouTubePubSubSubscriptionTarget } from "./youtube-pubsub-subscriptions.rules.js";
import type {
  YouTubePubSubHubTransport,
  YouTubePubSubSubscriptionMode,
  YouTubePubSubSubscriptionRequestResult,
  YouTubePubSubSubscriptionStatusResult
} from "./youtube-pubsub-subscriptions.types.js";

export const createYouTubePubSubHubTransport = (): YouTubePubSubHubTransport => ({
  async requestSubscription(input) {
    const body = new URLSearchParams({
      "hub.callback": input.callbackUrl,
      "hub.mode": input.mode,
      "hub.topic": input.topicUrl
    });
    const response = await fetch(input.hubUrl, {
      body,
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      method: "POST"
    });

    return response.ok;
  }
});

export class YouTubePubSubSubscriptionService {
  public constructor(
    private readonly options: {
      env?: Record<string, string | undefined>;
      transport?: YouTubePubSubHubTransport;
    } = {}
  ) {}

  public getStatus(input: { channelId: string | null }): YouTubePubSubSubscriptionStatusResult {
    const target = resolveYouTubePubSubSubscriptionTarget({
      channelId: input.channelId,
      env: this.options.env ?? process.env
    });

    if (!input.channelId) {
      return {
        ok: false,
        reason: "youtube_pubsub_channel_missing"
      };
    }

    if (!target) {
      return {
        ok: false,
        reason: "youtube_pubsub_config_missing"
      };
    }

    return {
      ok: true,
      callbackUrl: target.callbackUrl,
      channelId: target.channelId,
      hubUrl: target.hubUrl,
      readOnly: true,
      state: "ready",
      topicUrl: target.topicUrl
    };
  }

  public async request(input: {
    channelId: string | null;
    mode: YouTubePubSubSubscriptionMode;
  }): Promise<YouTubePubSubSubscriptionRequestResult> {
    const status = this.getStatus({
      channelId: input.channelId
    });

    if (!status.ok) {
      return status;
    }

    const transport = this.options.transport ?? createYouTubePubSubHubTransport();
    const requested = await transport.requestSubscription({
      callbackUrl: status.callbackUrl,
      hubUrl: status.hubUrl,
      mode: input.mode,
      topicUrl: status.topicUrl
    });

    if (!requested) {
      return {
        ok: false,
        reason: "youtube_pubsub_hub_unavailable"
      };
    }

    return {
      ok: true,
      callbackUrl: status.callbackUrl,
      channelId: status.channelId,
      hubUrl: status.hubUrl,
      mode: input.mode,
      readOnly: true,
      state: "requested",
      topicUrl: status.topicUrl
    };
  }
}
