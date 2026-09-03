import { credentials, loadPackageDefinition, Metadata, type Client, type ClientReadableStream } from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

import { projectYouTubeLiveChatMessage } from "./youtube-live-chat-intake.rules.js";
import type {
  YouTubeActiveLiveChat,
  YouTubeLiveChatApi,
  YouTubeLiveChatContext,
  YouTubeLiveChatIntakeStatus,
  YouTubeLiveChatMessageBatch,
  YouTubeLiveChatMessageStream,
  YouTubeLiveChatQuotaGuard,
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
  quotaGuard?: YouTubeLiveChatQuotaGuard;
  random?: () => number;
  setTimeoutFn?: (callback: () => void, ms: number) => unknown;
  streamReconnectBaseMs?: number;
  streamReconnectJitterRatio?: number;
  streamReconnectMaxMs?: number;
  streamStableAfterMs?: number;
};

type YouTubeLiveChatStartOptions = {
  resetQuotaBlock?: boolean;
};

const unblockedQuotaGuard: YouTubeLiveChatQuotaGuard = {
  isBlocked: async () => false,
  block: async () => undefined,
  clear: async () => undefined
};

const collectErrorReasons = (error: unknown): string[] => {
  if (typeof error !== "object" || error === null) {
    return typeof error === "string" ? [error] : [];
  }

  const candidate = error as {
    message?: unknown;
    response?: {
      data?: {
        error?: {
          errors?: Array<{ reason?: unknown }>;
          status?: unknown;
        };
      };
    };
  };

  return [
    candidate.message,
    candidate.response?.data?.error?.status,
    ...(candidate.response?.data?.error?.errors?.map((item) => item.reason) ?? [])
  ].filter((value): value is string => typeof value === "string");
};

export const isYouTubeQuotaExceededError = (error: unknown): boolean =>
  collectErrorReasons(error).some((value) =>
    /(?:quota[\s_-]*exceeded|daily[\s_-]*limit[\s_-]*exceeded)/i.test(value)
  );

export const isYouTubeStreamRateLimitedError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; details?: unknown; message?: unknown };
  return candidate.code === 8
    && [candidate.details, candidate.message].some((value) =>
      typeof value === "string" && /resource[_\s-]*exhausted/i.test(value)
    );
};

export const isYouTubeTerminalLiveChatError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown };
  return candidate.code === 5 || candidate.code === 9;
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

const createYouTubeOAuthClient = (context: YouTubeLiveChatContext) => {
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

  return client;
};

export const createCachedYouTubeClientResolver = <Client>(
  createClient: (context: YouTubeLiveChatContext) => Client
) => {
  let cached: {
    client: Client;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    refreshToken: string;
  } | null = null;

  return (context: YouTubeLiveChatContext) => {
    if (
      cached
      && cached.clientId === context.config.clientId
      && cached.clientSecret === context.config.clientSecret
      && cached.redirectUri === context.config.redirectUri
      && cached.refreshToken === context.credential.refreshToken
    ) {
      return cached.client;
    }

    const client = createClient(context);
    cached = {
      client,
      clientId: context.config.clientId,
      clientSecret: context.config.clientSecret,
      redirectUri: context.config.redirectUri,
      refreshToken: context.credential.refreshToken
    };

    return client;
  };
};

export const createSingletonClientLease = <Client extends { close(): void }>(
  createClient: () => Client
) => {
  let client: Client | null = null;

  return {
    close(): void {
      client?.close();
      client = null;
    },
    get(): Client {
      client ??= createClient();
      return client;
    }
  };
};

type StreamListGrpcResponse = {
  items?: Array<{
    author_details?: StreamListAuthorDetails;
    authorDetails?: StreamListAuthorDetails;
    id?: string;
    snippet?: {
      display_message?: string;
      published_at?: string;
      displayMessage?: string;
      publishedAt?: string;
    };
  }>;
  nextPageToken?: string;
  next_page_token?: string;
};

type StreamListAuthorDetails = {
  channel_id?: string;
  display_name?: string;
  profile_image_url?: string;
  channelId?: string;
  displayName?: string;
  profileImageUrl?: string;
};

type StreamListGrpcClient = Client & {
  streamList(
    input: {
      live_chat_id: string;
      page_token?: string;
      part: string[];
      profile_image_size: number;
    },
    metadata: Metadata
  ): ClientReadableStream<StreamListGrpcResponse>;
};

type StreamListGrpcClientConstructor = new (
  address: string,
  channelCredentials: ReturnType<typeof credentials.createSsl>
) => StreamListGrpcClient;

const adjacentStreamListProtoPath = fileURLToPath(
  new URL("./youtube-live-chat-stream.proto", import.meta.url)
);
const sourceStreamListProtoPath = fileURLToPath(
  new URL("../src/youtube-live-chat-stream.proto", import.meta.url)
);
const streamListDefinition = loadSync(
  existsSync(adjacentStreamListProtoPath) ? adjacentStreamListProtoPath : sourceStreamListProtoPath,
  {
    defaults: false,
    keepCase: true,
    longs: String,
    oneofs: true
  }
);
const streamListPackage = loadPackageDefinition(streamListDefinition) as unknown as {
  youtube: {
    api: {
      v3: {
        V3DataLiveChatMessageService: StreamListGrpcClientConstructor;
      };
    };
  };
};

export const projectYouTubeLiveChatStreamResponse = (
  response: StreamListGrpcResponse
): YouTubeLiveChatMessageBatch => ({
  messages: (response.items ?? []).map((item) => {
    const authorDetails = item.author_details ?? item.authorDetails;

    return {
      authorChannelId: authorDetails?.channel_id ?? authorDetails?.channelId ?? null,
      authorName: authorDetails?.display_name ?? authorDetails?.displayName ?? null,
      avatarUrl: authorDetails?.profile_image_url ?? authorDetails?.profileImageUrl ?? null,
      createdAt: item.snippet?.published_at ?? item.snippet?.publishedAt ?? null,
      id: item.id ?? null,
      text: item.snippet?.display_message ?? item.snippet?.displayMessage ?? ""
    };
  }),
  nextPageToken: response.next_page_token ?? response.nextPageToken ?? null
});

export const createYouTubeActiveBroadcastListRequest = () => ({
  part: ["snippet"],
  broadcastStatus: "active" as const,
  broadcastType: "all" as const
});

export const createGoogleYouTubeLiveChatApi = (): YouTubeLiveChatApi => {
  const resolveOAuthClient = createCachedYouTubeClientResolver(createYouTubeOAuthClient);
  const streamListClientLease = createSingletonClientLease(() => {
    const StreamListClient = streamListPackage.youtube.api.v3.V3DataLiveChatMessageService;
    return new StreamListClient("youtube.googleapis.com:443", credentials.createSsl());
  });

  return {
    close() {
      streamListClientLease.close();
    },
    async findActiveLiveChat({ context }) {
      const youtube = google.youtube({
        version: "v3",
        auth: resolveOAuthClient(context)
      });
      const response = await youtube.liveBroadcasts.list(createYouTubeActiveBroadcastListRequest());
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
    async openMessageStream({ context, liveChatId, onBatch, pageToken }) {
      const accessToken = await resolveOAuthClient(context).getAccessToken();
      if (!accessToken.token) {
        throw new Error("YouTube live-chat access token is unavailable.");
      }

      const metadata = new Metadata();
      metadata.set("authorization", `Bearer ${accessToken.token}`);
      const client = streamListClientLease.get();
      const call = client.streamList({
        live_chat_id: liveChatId,
        ...(pageToken ? { page_token: pageToken } : {}),
        part: ["snippet", "authorDetails"],
        profile_image_size: 88
      }, metadata);
      let settled = false;
      let resolveCompletion: (() => void) | undefined;
      let rejectCompletion: ((error: unknown) => void) | undefined;
      const completion = new Promise<void>((resolve, reject) => {
        resolveCompletion = resolve;
        rejectCompletion = reject;
      });
      const finish = (error?: unknown): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (error) {
          rejectCompletion?.(error);
        } else {
          resolveCompletion?.();
        }
      };

      call.on("data", (response) => {
        onBatch(projectYouTubeLiveChatStreamResponse(response));
      });
      call.on("error", (error) => finish(error));
      call.on("end", () => finish());

      return {
        cancel() {
          call.cancel();
          finish();
        },
        completion
      };
    }
  };
};

export class YouTubeLiveChatReadOnlyIntakeService {
  private readonly clearTimeoutFn: (handle: unknown) => void;
  private readonly contextResolver: () => Promise<YouTubeLiveChatContext | null>;
  private readonly liveChatApi: YouTubeLiveChatApi;
  private readonly maxRecentMessages: number;
  private readonly now: () => Date;
  private readonly onProjectedMessage: ((message: YouTubeLiveChatProjectedMessage) => void) | undefined;
  private readonly pollWhenNoActiveChatMs: number;
  private readonly quotaGuard: YouTubeLiveChatQuotaGuard;
  private readonly random: () => number;
  private readonly setTimeoutFn: (callback: () => void, ms: number) => unknown;
  private readonly streamReconnectBaseMs: number;
  private readonly streamReconnectJitterRatio: number;
  private readonly streamReconnectMaxMs: number;
  private readonly streamStableAfterMs: number;
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
  private operationGeneration = 0;
  private state: YouTubeLiveChatIntakeStatus["state"] = "stopped";
  private activeStream: YouTubeLiveChatMessageStream | null = null;
  private streamReconnectAttempt = 0;
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
    this.pollWhenNoActiveChatMs = options.pollWhenNoActiveChatMs ?? 30 * 60_000;
    this.quotaGuard = options.quotaGuard ?? unblockedQuotaGuard;
    this.random = options.random ?? Math.random;
    this.setTimeoutFn = options.setTimeoutFn ?? ((callback, ms) => setTimeout(callback, ms));
    this.streamReconnectBaseMs = options.streamReconnectBaseMs ?? 2_000;
    this.streamReconnectJitterRatio = Math.min(0.5, Math.max(0, options.streamReconnectJitterRatio ?? 0.2));
    this.streamReconnectMaxMs = options.streamReconnectMaxMs ?? 60_000;
    this.streamStableAfterMs = options.streamStableAfterMs ?? 5 * 60_000;
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

  public start(options: YouTubeLiveChatStartOptions = {}): YouTubeLiveChatIntakeStatus {
    if (this.state === "connected" || this.state === "connecting") {
      return this.getStatus();
    }

    if (this.state === "quota_exhausted" && !options.resetQuotaBlock) {
      return this.getStatus();
    }

    this.manualStopRequested = false;
    this.state = "connecting";
    this.lastError = null;
    this.clearTimer();
    this.clearActiveStream();
    this.streamReconnectAttempt = 0;
    const generation = ++this.operationGeneration;
    void this.startOnce(generation, options.resetQuotaBlock === true);

    return this.getStatus();
  }

  public stop(): YouTubeLiveChatIntakeStatus {
    this.manualStopRequested = true;
    this.operationGeneration += 1;
    this.clearTimer();
    this.clearActiveStream();
    this.liveChatApi.close?.();
    this.activeLiveChatId = null;
    this.connectedAt = null;
    this.nextPageToken = null;
    this.nextPollAt = null;
    this.streamReconnectAttempt = 0;
    this.state = "stopped";

    return this.getStatus();
  }

  private async startOnce(generation: number, resetQuotaBlock: boolean): Promise<void> {
    try {
      if (resetQuotaBlock) {
        await this.quotaGuard.clear();
      } else if (await this.quotaGuard.isBlocked()) {
        if (!this.isCurrentOperation(generation)) {
          return;
        }
        this.setQuotaExhausted();
        return;
      }
    } catch (error) {
      if (!this.isCurrentOperation(generation)) {
        return;
      }
      this.lastError = sanitizeError(error);
      this.state = "waiting";
      this.scheduleNext(this.pollWhenNoActiveChatMs, generation, () => {
        void this.startOnce(generation, false);
      });
      return;
    }

    await this.pollOnce(generation);
  }

  private async pollOnce(generation: number): Promise<void> {
    if (!this.isCurrentOperation(generation)) {
      return;
    }

    try {
      const context = await this.contextResolver();

      if (!this.isCurrentOperation(generation)) {
        return;
      }

      if (!context) {
        this.liveChatApi.close?.();
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
        if (!this.isCurrentOperation(generation)) {
          return;
        }
        this.setActiveLiveChat(active);
      }

      if (!this.activeLiveChatId) {
        this.state = "waiting";
        this.lastError = null;
        this.scheduleNext(this.pollWhenNoActiveChatMs, generation);
        return;
      }

      const streamStartedAtMs = this.now().getTime();
      const stream = await this.liveChatApi.openMessageStream({
        context,
        liveChatId: this.activeLiveChatId,
        onBatch: (batch) => {
          if (!this.isCurrentOperation(generation)) {
            return;
          }
          this.recordBatch(batch, context);
          this.state = "connected";
          this.connectedAt ??= this.now().toISOString();
          this.lastError = null;
          this.nextPollAt = null;
        },
        pageToken: this.nextPageToken
      });

      if (!this.isCurrentOperation(generation)) {
        stream.cancel();
        return;
      }

      this.activeStream = stream;
      this.state = "connected";
      this.connectedAt ??= this.now().toISOString();
      this.lastError = null;
      this.nextPollAt = null;
      try {
        await stream.completion;
      } finally {
        if (this.activeStream === stream) {
          this.activeStream = null;
        }
      }
      if (!this.isCurrentOperation(generation)) {
        return;
      }
      this.state = "connected";
      this.scheduleStreamReconnect(
        generation,
        0,
        Math.max(0, this.now().getTime() - streamStartedAtMs)
      );
    } catch (error) {
      if (!this.isCurrentOperation(generation)) {
        return;
      }

      if (isYouTubeQuotaExceededError(error)) {
        try {
          await this.quotaGuard.block();
        } catch {
          // The in-process circuit still stops provider calls for this runtime.
        }
        if (this.isCurrentOperation(generation)) {
          this.setQuotaExhausted();
        }
        return;
      }

      if (isYouTubeStreamRateLimitedError(error)) {
        this.lastError = sanitizeError(error);
        this.state = "connecting";
        this.clearActiveStream();
        this.scheduleStreamReconnect(generation, this.streamReconnectMaxMs);
        return;
      }

      if (isYouTubeTerminalLiveChatError(error)) {
        this.lastError = sanitizeError(error);
        this.clearActiveStream();
        this.liveChatApi.close?.();
        this.clearActiveLiveChat();
        this.state = "waiting";
        this.scheduleNext(this.pollWhenNoActiveChatMs, generation);
        return;
      }

      this.lastError = sanitizeError(error);
      this.state = this.activeLiveChatId ? "connecting" : "waiting";
      if (this.activeLiveChatId) {
        this.clearActiveStream();
        this.scheduleStreamReconnect(generation);
      } else {
        this.scheduleNext(this.pollWhenNoActiveChatMs, generation);
      }
    }
  }

  private setActiveLiveChat(active: YouTubeActiveLiveChat | null): void {
    if (active?.liveChatId && active.liveChatId !== this.activeLiveChatId) {
      this.processedProviderMessageIds.clear();
      this.nextPageToken = null;
      this.connectedAt = this.now().toISOString();
      this.streamReconnectAttempt = 0;
    }

    this.activeLiveChatId = active?.liveChatId ?? null;
  }

  private recordBatch(
    batch: YouTubeLiveChatMessageBatch,
    context: YouTubeLiveChatContext
  ): void {
    if (batch.nextPageToken) {
      this.nextPageToken = batch.nextPageToken;
    }

    for (const readable of batch.messages) {
      const providerMessageId = readable.id ?? "";
      if (providerMessageId && this.processedProviderMessageIds.has(providerMessageId)) {
        continue;
      }

      const projected = projectYouTubeLiveChatMessage({
        authorChannelId: readable.authorChannelId,
        authorName: readable.authorName,
        avatarUrl: readable.avatarUrl,
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

  private scheduleStreamReconnect(
    generation: number,
    minimumDelayMs = 0,
    completedStreamDurationMs = 0
  ): void {
    if (completedStreamDurationMs >= this.streamStableAfterMs) {
      this.streamReconnectAttempt = 0;
    }
    const exponent = Math.min(this.streamReconnectAttempt, 10);
    const baseDelayMs = Math.max(minimumDelayMs, Math.min(
      this.streamReconnectBaseMs * (2 ** exponent),
      this.streamReconnectMaxMs
    ));
    const jitterMultiplier = 1 - this.streamReconnectJitterRatio
      + (2 * this.streamReconnectJitterRatio * this.random());
    const delayMs = Math.min(
      this.streamReconnectMaxMs,
      Math.max(minimumDelayMs, Math.round(baseDelayMs * jitterMultiplier))
    );
    this.streamReconnectAttempt += 1;
    this.scheduleNext(delayMs, generation);
  }

  private scheduleNext(
    delayMs: number,
    generation: number,
    callback: () => void = () => {
      void this.pollOnce(generation);
    }
  ): void {
    if (!this.isCurrentOperation(generation)) {
      return;
    }

    const safeDelayMs = Math.max(2_000, Math.min(delayMs, 24 * 60 * 60_000));
    this.nextPollAt = new Date(this.now().getTime() + safeDelayMs).toISOString();
    this.clearTimer();
    this.timer = this.setTimeoutFn(() => {
      this.timer = null;
      callback();
    }, safeDelayMs);
  }

  private clearTimer(): void {
    if (this.timer) {
      this.clearTimeoutFn(this.timer);
      this.timer = null;
    }
  }

  private clearActiveStream(): void {
    const stream = this.activeStream;
    this.activeStream = null;
    stream?.cancel();
  }

  private clearActiveLiveChat(): void {
    this.activeLiveChatId = null;
    this.connectedAt = null;
    this.nextPageToken = null;
    this.streamReconnectAttempt = 0;
  }

  private isCurrentOperation(generation: number): boolean {
    return !this.manualStopRequested && generation === this.operationGeneration;
  }

  private setQuotaExhausted(): void {
    this.clearTimer();
    this.clearActiveStream();
    this.liveChatApi.close?.();
    this.connectedAt = null;
    this.nextPollAt = null;
    this.lastError = "YouTube API quota is exhausted. Retry manually after the quota resets.";
    this.state = "quota_exhausted";
  }
}
