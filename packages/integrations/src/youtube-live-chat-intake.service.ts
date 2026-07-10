import { google } from "googleapis";

import { projectYouTubeLiveChatMessage } from "./youtube-live-chat-intake.rules.js";
import type {
  YouTubeActiveLiveChat,
  YouTubeLiveChatApi,
  YouTubeLiveChatContext,
  YouTubeLiveChatIntakeStatus,
  YouTubeLiveChatMessageBatch,
  YouTubeLiveChatProjectedMessage
} from "./youtube-live-chat-intake.types.js";

type YouTubeLiveChatReadOnlyIntakeOptions = {
  clearTimeoutFn?: (handle: unknown) => void;
  contextResolver: () => Promise<YouTubeLiveChatContext | null>;
  liveChatApi?: YouTubeLiveChatApi;
  maxRecentMessages?: number;
  onMessage?: (message: YouTubeLiveChatProjectedMessage) => void;
  now?: () => Date;
  pollWhenNoActiveChatMs?: number;
  setTimeoutFn?: (callback: () => void, ms: number) => unknown;
};

const sanitizeError = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim().slice(0, 180);
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim().slice(0, 180);
  }

  return "YouTube live chat intake unavailable.";
};

const createYouTubeClient = (context: YouTubeLiveChatContext) => {
  const client = new google.auth.OAuth2(
    context.config.clientId,
    context.config.clientSecret,
    context.config.redirectUri
  );

  client.setCredentials({
    ...(context.credential.accessToken ? { access_token: context.credential.accessToken } : {}),
    refresh_token: context.credential.refreshToken,
    ...(context.credential.accessTokenExpiresAt ? { expiry_date: context.credential.accessTokenExpiresAt.getTime() } : {})
  });

  return google.youtube({
    version: "v3",
    auth: client
  });
};

export const createGoogleYouTubeLiveChatApi = (): YouTubeLiveChatApi => ({
  async findActiveLiveChat({ context }) {
    const youtube = createYouTubeClient(context);
    const response = await youtube.liveBroadcasts.list({
      part: ["snippet"],
      broadcastStatus: "active",
      broadcastType: "all",
      mine: true
    });
    const broadcast = response.data.items?.find((item) =>
      item.snippet?.liveChatId
      && (!item.snippet.channelId || item.snippet.channelId === context.selectedChannel.id)
    );

    if (!broadcast?.snippet?.liveChatId) {
      return null;
    }

    return {
      liveChatId: broadcast.snippet.liveChatId,
      title: broadcast.snippet.title ?? null
    };
  },
  async listMessages({ context, liveChatId, pageToken }) {
    const youtube = createYouTubeClient(context);
    const response = await youtube.liveChatMessages.list({
      liveChatId,
      part: ["snippet", "authorDetails"],
      ...(pageToken ? { pageToken } : {})
    });

    return {
      messages: (response.data.items ?? []).map((item) => ({
        authorChannelId: item.authorDetails?.channelId ?? null,
        authorName: item.authorDetails?.displayName ?? null,
        createdAt: item.snippet?.publishedAt ?? null,
        id: item.id ?? null,
        text: item.snippet?.displayMessage ?? ""
      })),
      nextPageToken: response.data.nextPageToken ?? null,
      pollingIntervalMs: response.data.pollingIntervalMillis ?? null
    };
  }
});

export class YouTubeLiveChatReadOnlyIntakeService {
  private readonly clearTimeoutFn: (handle: unknown) => void;
  private readonly contextResolver: () => Promise<YouTubeLiveChatContext | null>;
  private readonly liveChatApi: YouTubeLiveChatApi;
  private readonly maxRecentMessages: number;
  private readonly now: () => Date;
  private readonly onProjectedMessage: ((message: YouTubeLiveChatProjectedMessage) => void) | undefined;
  private readonly pollWhenNoActiveChatMs: number;
  private readonly setTimeoutFn: (callback: () => void, ms: number) => unknown;
  private activeLiveChatId: string | null = null;
  private channelId: string | null = null;
  private channelName: string | null = null;
  private connectedAt: string | null = null;
  private lastError: string | null = null;
  private lastMessageAt: string | null = null;
  private manualStopRequested = true;
  private nextPageToken: string | null = null;
  private nextPollAt: string | null = null;
  private readonly processedProviderMessageIds = new Set<string>();
  private readonly recentMessages: YouTubeLiveChatProjectedMessage[] = [];
  private state: YouTubeLiveChatIntakeStatus["state"] = "stopped";
  private timer: unknown | null = null;

  public constructor(options: YouTubeLiveChatReadOnlyIntakeOptions) {
    this.clearTimeoutFn = options.clearTimeoutFn ?? ((handle) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    });
    this.contextResolver = options.contextResolver;
    this.liveChatApi = options.liveChatApi ?? createGoogleYouTubeLiveChatApi();
    this.maxRecentMessages = options.maxRecentMessages ?? 25;
    this.now = options.now ?? (() => new Date());
    this.onProjectedMessage = options.onMessage;
    this.pollWhenNoActiveChatMs = options.pollWhenNoActiveChatMs ?? 60_000;
    this.setTimeoutFn = options.setTimeoutFn ?? ((callback, ms) => setTimeout(callback, ms));
  }

  public getStatus(): YouTubeLiveChatIntakeStatus {
    if (this.state === "unconfigured") {
      return {
        activeLiveChatId: null,
        channelId: this.channelId,
        channelName: this.channelName,
        connectedAt: null,
        lastError: this.lastError ?? "YouTube live-chat channel is not selected.",
        lastMessageAt: null,
        nextPollAt: null,
        recentMessages: [],
        state: "unconfigured"
      };
    }

    return {
      activeLiveChatId: this.activeLiveChatId,
      channelId: this.channelId ?? "",
      channelName: this.channelName ?? "",
      connectedAt: this.connectedAt,
      lastError: this.lastError,
      lastMessageAt: this.lastMessageAt,
      nextPollAt: this.nextPollAt,
      recentMessages: this.recentMessages.map((message) => ({ ...message })),
      state: this.state
    };
  }

  public start(): YouTubeLiveChatIntakeStatus {
    if (this.state === "connected" || this.state === "connecting" || this.state === "waiting") {
      return this.getStatus();
    }

    this.manualStopRequested = false;
    this.state = "connecting";
    this.lastError = null;
    this.clearTimer();
    void this.pollOnce();

    return this.getStatus();
  }

  public stop(): YouTubeLiveChatIntakeStatus {
    this.manualStopRequested = true;
    this.clearTimer();
    this.activeLiveChatId = null;
    this.connectedAt = null;
    this.nextPageToken = null;
    this.nextPollAt = null;
    this.state = "stopped";

    return this.getStatus();
  }

  private async pollOnce(): Promise<void> {
    if (this.manualStopRequested) {
      return;
    }

    try {
      const context = await this.contextResolver();

      if (!context) {
        this.state = "unconfigured";
        this.activeLiveChatId = null;
        this.connectedAt = null;
        this.nextPageToken = null;
        this.nextPollAt = null;
        this.lastError = "No selected YouTube live-chat channel or active credential.";
        return;
      }

      this.channelId = context.selectedChannel.id;
      this.channelName = context.selectedChannel.title;

      if (!this.activeLiveChatId) {
        const active = await this.liveChatApi.findActiveLiveChat({ context });
        this.setActiveLiveChat(active);
      }

      if (!this.activeLiveChatId) {
        this.state = "waiting";
        this.lastError = null;
        this.scheduleNext(this.pollWhenNoActiveChatMs);
        return;
      }

      const batch = await this.liveChatApi.listMessages({
        context,
        liveChatId: this.activeLiveChatId,
        pageToken: this.nextPageToken
      });

      this.recordBatch(batch, context);
      this.state = "connected";
      this.connectedAt ??= this.now().toISOString();
      this.lastError = null;
      this.scheduleNext(batch.pollingIntervalMs ?? 5_000);
    } catch (error) {
      this.lastError = sanitizeError(error);
      this.state = this.activeLiveChatId ? "connected" : "waiting";
      this.scheduleNext(this.pollWhenNoActiveChatMs);
    }
  }

  private setActiveLiveChat(active: YouTubeActiveLiveChat | null): void {
    if (active?.liveChatId && active.liveChatId !== this.activeLiveChatId) {
      this.processedProviderMessageIds.clear();
      this.nextPageToken = null;
      this.connectedAt = this.now().toISOString();
    }

    this.activeLiveChatId = active?.liveChatId ?? null;
  }

  private recordBatch(
    batch: YouTubeLiveChatMessageBatch,
    context: YouTubeLiveChatContext
  ): void {
    this.nextPageToken = batch.nextPageToken;

    for (const readable of batch.messages) {
      const providerMessageId = readable.id ?? "";
      if (providerMessageId && this.processedProviderMessageIds.has(providerMessageId)) {
        continue;
      }

      const projected = projectYouTubeLiveChatMessage({
        authorChannelId: readable.authorChannelId,
        authorName: readable.authorName,
        channelName: context.selectedChannel.title,
        createdAt: readable.createdAt,
        messageId: readable.id,
        text: readable.text
      });

      if (!projected.ok) {
        continue;
      }

      this.processedProviderMessageIds.add(projected.message.providerMessageId);
      this.lastMessageAt = projected.message.createdAt;
      this.recentMessages.unshift(projected.message);
      this.recentMessages.splice(this.maxRecentMessages);
      while (this.processedProviderMessageIds.size > this.maxRecentMessages * 4) {
        const oldest = this.processedProviderMessageIds.values().next().value as string | undefined;
        if (!oldest) {
          break;
        }
        this.processedProviderMessageIds.delete(oldest);
      }
      this.onProjectedMessage?.({ ...projected.message });
    }
  }

  private scheduleNext(delayMs: number): void {
    if (this.manualStopRequested) {
      return;
    }

    const safeDelayMs = Math.max(2_000, Math.min(delayMs, 120_000));
    this.nextPollAt = new Date(this.now().getTime() + safeDelayMs).toISOString();
    this.clearTimer();
    this.timer = this.setTimeoutFn(() => {
      void this.pollOnce();
    }, safeDelayMs);
  }

  private clearTimer(): void {
    if (this.timer) {
      this.clearTimeoutFn(this.timer);
      this.timer = null;
    }
  }
}
