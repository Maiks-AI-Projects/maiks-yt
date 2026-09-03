import { describe, expect, it, vi } from "vitest";

import { projectYouTubeLiveChatMessage } from "./youtube-live-chat-intake.rules.js";
import {
  createCachedYouTubeClientResolver,
  createYouTubeActiveBroadcastListRequest,
  isYouTubeQuotaExceededError,
  isYouTubeStreamRateLimitedError,
  isYouTubeTerminalLiveChatError,
  projectYouTubeLiveChatStreamResponse,
  YouTubeLiveChatReadOnlyIntakeService
} from "./youtube-live-chat-intake.service.js";
import type {
  YouTubeLiveChatContext,
  YouTubeLiveChatMessageStream
} from "./youtube-live-chat-intake.types.js";

const context: YouTubeLiveChatContext = {
  config: {
    ok: true,
    clientId: "google-client",
    clientSecret: "google-secret",
    redirectUri: "https://api-dev.maiks.yt/admin/provider-integrations/youtube/callback"
  },
  credential: {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    accessTokenExpiresAt: null,
    scopes: ["https://www.googleapis.com/auth/youtube.readonly"]
  },
  selectedChannel: {
    id: "youtube-channel-1",
    title: "MaiksMC",
    customUrl: "@maiksmc"
  }
};

const flushAsyncWork = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const createDeferredStream = () => {
  let resolveCompletion: (() => void) | undefined;
  let rejectCompletion: ((error: unknown) => void) | undefined;
  const completion = new Promise<void>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });
  const cancel = vi.fn(() => resolveCompletion?.());
  const stream: YouTubeLiveChatMessageStream = { cancel, completion };

  return {
    cancel,
    reject(error: unknown) {
      rejectCompletion?.(error);
    },
    resolve() {
      resolveCompletion?.();
    },
    stream
  };
};

describe("projectYouTubeLiveChatMessage", () => {
  it("sanitizes YouTube live chat messages for private streamer chat", () => {
    const result = projectYouTubeLiveChatMessage({
      avatarUrl: "https://yt3.ggpht.com/avatar=s88-c-k-c0x00ffffff-no-rj",
      authorName: " Michael \n ",
      authorChannelId: " author-channel-1 ",
      channelName: " MaiksMC ",
      createdAt: "2026-07-04T12:00:00Z",
      messageId: " provider-message-1 ",
      text: " Hello \u0000 stream "
    });

    expect(result).toEqual({
      ok: true,
      message: expect.objectContaining({
        authorKind: "human",
        authorChannelId: "author-channel-1",
        authorName: "Michael",
        avatarUrl: "https://yt3.ggpht.com/avatar=s88-c-k-c0x00ffffff-no-rj",
        channelName: "MaiksMC",
        createdAt: "2026-07-04T12:00:00.000Z",
        message: "Hello stream",
        providerMessageId: "provider-message-1",
        source: "youtube",
        visibleOnOverlayByDefault: true
      })
    });
  });

  it("drops unsafe avatar URLs without dropping the chat message", () => {
    expect(projectYouTubeLiveChatMessage({
      authorName: "Michael",
      avatarUrl: "javascript:alert(1)",
      channelName: "MaiksMC",
      text: "Hello"
    })).toEqual({
      ok: true,
      message: expect.not.objectContaining({ avatarUrl: expect.anything() })
    });
  });

  it("rejects empty live chat messages", () => {
    expect(projectYouTubeLiveChatMessage({
      authorName: "Michael",
      channelName: "MaiksMC",
      text: " "
    })).toEqual({
      ok: false,
      reason: "empty_message"
    });
  });
});

describe("YouTubeLiveChatReadOnlyIntakeService", () => {
  it("classifies quota exhaustion without treating ordinary rate limiting as terminal", () => {
    expect(isYouTubeQuotaExceededError({
      response: { data: { error: { errors: [{ reason: "quotaExceeded" }] } } }
    })).toBe(true);
    expect(isYouTubeQuotaExceededError(new Error("Quota exceeded for quota metric"))).toBe(true);
    expect(isYouTubeQuotaExceededError({
      response: { data: { error: { errors: [{ reason: "rateLimitExceeded" }] } } }
    })).toBe(false);
  });

  it("classifies the documented streamList RESOURCE_EXHAUSTED response as rate limited", () => {
    expect(isYouTubeStreamRateLimitedError({
      code: 8,
      details: "Resource has been exhausted (e.g. check quota).",
      message: "8 RESOURCE_EXHAUSTED: Resource has been exhausted (e.g. check quota)."
    })).toBe(true);
    expect(isYouTubeStreamRateLimitedError({ code: 7, details: "Permission denied" })).toBe(false);
  });

  it("classifies ended or invalid live-chat identities as terminal", () => {
    expect(isYouTubeTerminalLiveChatError({ code: 5 })).toBe(true);
    expect(isYouTubeTerminalLiveChatError({ code: 9 })).toBe(true);
    expect(isYouTubeTerminalLiveChatError({ code: 8 })).toBe(false);
  });

  it("reuses one OAuth client until its provider identity or refresh token changes", () => {
    const createClient = vi.fn(() => ({}));
    const resolveClient = createCachedYouTubeClientResolver(createClient);
    const first = resolveClient(context);
    const refreshedAccessToken = resolveClient({
      ...context,
      credential: {
        ...context.credential,
        accessToken: "rotated-access-token",
        accessTokenExpiresAt: new Date("2026-07-04T13:00:00Z")
      }
    });
    const rotatedRefreshToken = resolveClient({
      ...context,
      credential: {
        ...context.credential,
        refreshToken: "rotated-refresh-token"
      }
    });

    expect(refreshedAccessToken).toBe(first);
    expect(rotatedRefreshToken).not.toBe(first);
    expect(createClient).toHaveBeenCalledTimes(2);
  });

  it("uses one compatible active-broadcast filter", () => {
    expect(createYouTubeActiveBroadcastListRequest()).toEqual({
      part: ["snippet"],
      broadcastStatus: "active",
      broadcastType: "all"
    });
    expect(createYouTubeActiveBroadcastListRequest()).not.toHaveProperty("mine");
  });

  it("projects official streamList responses including author avatars", () => {
    expect(projectYouTubeLiveChatStreamResponse({
      items: [{
        author_details: {
          channel_id: "author-channel-1",
          display_name: "Viewer",
          profile_image_url: "https://yt3.ggpht.com/viewer=s88"
        },
        id: "message-1",
        snippet: {
          display_message: "Hello",
          published_at: "2026-07-04T12:00:00Z"
        }
      }],
      next_page_token: "resume-1"
    })).toEqual({
      messages: [{
        authorChannelId: "author-channel-1",
        authorName: "Viewer",
        avatarUrl: "https://yt3.ggpht.com/viewer=s88",
        createdAt: "2026-07-04T12:00:00Z",
        id: "message-1",
        text: "Hello"
      }],
      nextPageToken: "resume-1"
    });
  });

  it("projects author avatars from lower-camel protobuf objects", () => {
    expect(projectYouTubeLiveChatStreamResponse({
      items: [{
        authorDetails: {
          channelId: "author-channel-1",
          displayName: "Viewer",
          profileImageUrl: "https://yt3.ggpht.com/viewer=s88"
        },
        id: "message-1",
        snippet: {
          displayMessage: "Hello",
          publishedAt: "2026-07-04T12:00:00Z"
        }
      }],
      nextPageToken: "resume-1"
    })).toEqual({
      messages: [{
        authorChannelId: "author-channel-1",
        authorName: "Viewer",
        avatarUrl: "https://yt3.ggpht.com/viewer=s88",
        createdAt: "2026-07-04T12:00:00Z",
        id: "message-1",
        text: "Hello"
      }],
      nextPageToken: "resume-1"
    });
  });

  it("backs off a documented streamList rate limit at the maximum interval", async () => {
    const deferred = createDeferredStream();
    const delays: number[] = [];
    const service = new YouTubeLiveChatReadOnlyIntakeService({
      contextResolver: async () => context,
      liveChatApi: {
        findActiveLiveChat: async () => ({ liveChatId: "live-chat-1", title: "Live stream" }),
        openMessageStream: async () => deferred.stream
      },
      streamReconnectBaseMs: 2_000,
      streamReconnectMaxMs: 60_000,
      setTimeoutFn: (_callback, delayMs) => {
        delays.push(delayMs);
        return 1;
      },
      clearTimeoutFn: () => undefined
    });

    service.start();
    await flushAsyncWork();
    deferred.reject({
      code: 8,
      details: "Resource has been exhausted (e.g. check quota).",
      message: "8 RESOURCE_EXHAUSTED: Resource has been exhausted (e.g. check quota)."
    });
    await flushAsyncWork();

    expect(delays).toEqual([60_000]);
    expect(service.getStatus()).toMatchObject({
      state: "connecting",
      nextPollAt: expect.any(String)
    });
  });

  it("streams active live chat and emits projected messages", async () => {
    const emitted: unknown[] = [];
    const scheduled: Array<() => void> = [];
    const deferred = createDeferredStream();
    const service = new YouTubeLiveChatReadOnlyIntakeService({
      contextResolver: async () => context,
      liveChatApi: {
        findActiveLiveChat: async () => ({
          liveChatId: "live-chat-1",
          title: "Live stream"
        }),
        openMessageStream: async ({ onBatch }) => {
          onBatch({
            messages: [{
              authorChannelId: "author-channel-1",
              authorName: "Viewer",
              avatarUrl: "https://yt3.ggpht.com/viewer=s88-c-k-c0x00ffffff-no-rj",
              createdAt: "2026-07-04T12:00:00Z",
              id: "message-1",
              text: "First"
            }],
            nextPageToken: "next-page"
          });
          return deferred.stream;
        }
      },
      now: () => new Date("2026-07-04T12:00:00.000Z"),
      onMessage: (message) => emitted.push(message),
      setTimeoutFn: (callback) => {
        scheduled.push(callback);
        return callback;
      },
      clearTimeoutFn: () => undefined
    });

    service.start();
    await flushAsyncWork();

    expect(service.getStatus()).toMatchObject({
      activeLiveChatId: "live-chat-1",
      channelId: "youtube-channel-1",
      channelName: "MaiksMC",
      state: "connected"
    });
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      avatarUrl: "https://yt3.ggpht.com/viewer=s88-c-k-c0x00ffffff-no-rj"
    });
    expect(scheduled).toHaveLength(0);

    service.stop();
    expect(deferred.cancel).toHaveBeenCalledTimes(1);
  });

  it("waits without error when no active live chat exists", async () => {
    const service = new YouTubeLiveChatReadOnlyIntakeService({
      contextResolver: async () => context,
      liveChatApi: {
        findActiveLiveChat: async () => null,
        openMessageStream: async () => {
          throw new Error("should not stream messages without live chat");
        }
      },
      now: () => new Date("2026-07-04T12:00:00.000Z"),
      setTimeoutFn: () => 1,
      clearTimeoutFn: () => undefined
    });

    service.start();
    await flushAsyncWork();

    expect(service.getStatus()).toMatchObject({
      activeLiveChatId: null,
      channelId: "youtube-channel-1",
      channelName: "MaiksMC",
      lastError: null,
      state: "waiting"
    });
  });

  it("opens the durable quota circuit breaker without scheduling a retry storm", async () => {
    const scheduled: Array<() => void> = [];
    let blocked = false;
    const service = new YouTubeLiveChatReadOnlyIntakeService({
      contextResolver: async () => context,
      liveChatApi: {
        findActiveLiveChat: async () => {
          throw {
            response: { data: { error: { errors: [{ reason: "quotaExceeded" }] } } }
          };
        },
        openMessageStream: async () => {
          throw new Error("should not stream messages");
        }
      },
      quotaGuard: {
        isBlocked: async () => blocked,
        block: async () => {
          blocked = true;
        },
        clear: async () => {
          blocked = false;
        }
      },
      setTimeoutFn: (callback) => {
        scheduled.push(callback);
        return callback;
      },
      clearTimeoutFn: () => undefined
    });

    service.start();
    await flushAsyncWork();

    expect(service.getStatus()).toMatchObject({
      lastError: "YouTube API quota is exhausted. Retry manually after the quota resets.",
      nextPollAt: null,
      state: "quota_exhausted"
    });
    expect(blocked).toBe(true);
    expect(scheduled).toHaveLength(0);
  });

  it("does not call YouTube after restart while blocked and clears only on manual start", async () => {
    let blocked = true;
    let discoveryCalls = 0;
    const service = new YouTubeLiveChatReadOnlyIntakeService({
      contextResolver: async () => context,
      liveChatApi: {
        findActiveLiveChat: async () => {
          discoveryCalls += 1;
          return null;
        },
        openMessageStream: async () => {
          throw new Error("should not stream messages");
        }
      },
      quotaGuard: {
        isBlocked: async () => blocked,
        block: async () => {
          blocked = true;
        },
        clear: async () => {
          blocked = false;
        }
      },
      setTimeoutFn: () => 1,
      clearTimeoutFn: () => undefined
    });

    service.start();
    await flushAsyncWork();
    expect(service.getStatus().state).toBe("quota_exhausted");
    expect(discoveryCalls).toBe(0);

    service.start({ resetQuotaBlock: true });
    await flushAsyncWork();
    expect(blocked).toBe(false);
    expect(discoveryCalls).toBe(1);
    expect(service.getStatus().state).toBe("waiting");
  });

  it("rechecks the durable quota guard after a transient guard read failure", async () => {
    const scheduled: Array<() => void> = [];
    let guardReads = 0;
    let discoveryCalls = 0;
    const service = new YouTubeLiveChatReadOnlyIntakeService({
      contextResolver: async () => context,
      liveChatApi: {
        findActiveLiveChat: async () => {
          discoveryCalls += 1;
          return null;
        },
        openMessageStream: async () => {
          throw new Error("should not stream messages");
        }
      },
      quotaGuard: {
        isBlocked: async () => {
          guardReads += 1;
          if (guardReads === 1) {
            throw new Error("quota state unavailable");
          }
          return true;
        },
        block: async () => undefined,
        clear: async () => undefined
      },
      setTimeoutFn: (callback) => {
        scheduled.push(callback);
        return callback;
      },
      clearTimeoutFn: () => undefined
    });

    service.start();
    await flushAsyncWork();
    expect(discoveryCalls).toBe(0);
    expect(scheduled).toHaveLength(1);

    scheduled.shift()?.();
    await flushAsyncWork();
    expect(guardReads).toBe(2);
    expect(discoveryCalls).toBe(0);
    expect(service.getStatus().state).toBe("quota_exhausted");
  });

  it("resumes streamList from the last token with bounded backoff and no duplicate delivery", async () => {
    const emitted: Array<{ providerMessageId: string; avatarUrl?: string }> = [];
    const scheduled: Array<{ callback: () => void; ms: number }> = [];
    const first = createDeferredStream();
    const second = createDeferredStream();
    const pageTokens: Array<string | null> = [];
    let discoveryCalls = 0;
    let streamCalls = 0;
    const service = new YouTubeLiveChatReadOnlyIntakeService({
      contextResolver: async () => context,
      liveChatApi: {
        findActiveLiveChat: async () => {
          discoveryCalls += 1;
          return { liveChatId: "live-chat-1", title: "Live stream" };
        },
        openMessageStream: async ({ onBatch, pageToken }) => {
          pageTokens.push(pageToken);
          streamCalls += 1;
          if (streamCalls === 1) {
            onBatch({
              messages: [{
                authorChannelId: "author-1",
                authorName: "First viewer",
                avatarUrl: "https://yt3.ggpht.com/first=s88",
                createdAt: "2026-07-04T12:00:00Z",
                id: "message-1",
                text: "First"
              }],
              nextPageToken: "resume-1"
            });
            return first.stream;
          }
          onBatch({
            messages: [{
              authorChannelId: "author-1",
              authorName: "First viewer",
              avatarUrl: "https://yt3.ggpht.com/first=s88",
              createdAt: "2026-07-04T12:00:00Z",
              id: "message-1",
              text: "First"
            }, {
              authorChannelId: "author-2",
              authorName: "Second viewer",
              avatarUrl: "https://yt3.ggpht.com/second=s88",
              createdAt: "2026-07-04T12:00:01Z",
              id: "message-2",
              text: "Second"
            }],
            nextPageToken: "resume-2"
          });
          return second.stream;
        }
      },
      onMessage: (message) => emitted.push(message),
      setTimeoutFn: (callback, ms) => {
        scheduled.push({ callback, ms });
        return callback;
      },
      clearTimeoutFn: () => undefined,
      streamReconnectBaseMs: 2_000,
      random: () => 0.5
    });

    service.start();
    await flushAsyncWork();
    first.reject(new Error("stream disconnected"));
    await flushAsyncWork();

    expect(scheduled).toEqual([{ callback: expect.any(Function), ms: 2_000 }]);
    scheduled.shift()?.callback();
    await flushAsyncWork();

    expect(discoveryCalls).toBe(1);
    expect(pageTokens).toEqual([null, "resume-1"]);
    expect(emitted).toEqual([
      expect.objectContaining({
        avatarUrl: "https://yt3.ggpht.com/first=s88",
        providerMessageId: "message-1"
      }),
      expect.objectContaining({
        avatarUrl: "https://yt3.ggpht.com/second=s88",
        providerMessageId: "message-2"
      })
    ]);
    expect(service.getStatus()).toMatchObject({
      lastError: null,
      state: "connected"
    });

    service.stop();
    expect(second.cancel).toHaveBeenCalledTimes(1);
  });

  it("backs off repeated nine-second clean stream ends without rediscovery or losing resume tokens", async () => {
    const scheduled: Array<{ callback: () => void; ms: number }> = [];
    const streams = Array.from({ length: 8 }, () => createDeferredStream());
    const pageTokens: Array<string | null> = [];
    let discoveryCalls = 0;
    let streamCalls = 0;
    let nowMs = Date.parse("2026-07-04T12:00:00Z");
    const service = new YouTubeLiveChatReadOnlyIntakeService({
      contextResolver: async () => context,
      liveChatApi: {
        findActiveLiveChat: async () => {
          discoveryCalls += 1;
          return { liveChatId: "live-chat-1", title: "Live stream" };
        },
        openMessageStream: async ({ onBatch, pageToken }) => {
          const callIndex = streamCalls;
          streamCalls += 1;
          pageTokens.push(pageToken);
          onBatch({
            messages: [],
            nextPageToken: `resume-${streamCalls}`
          });
          return streams[callIndex]!.stream;
        }
      },
      now: () => new Date(nowMs),
      random: () => 0.5,
      setTimeoutFn: (callback, ms) => {
        scheduled.push({ callback, ms });
        return callback;
      },
      clearTimeoutFn: () => undefined,
      streamReconnectBaseMs: 2_000,
      streamReconnectMaxMs: 60_000,
      streamStableAfterMs: 5 * 60_000
    });

    service.start();
    await flushAsyncWork();

    const expectedDelays = [2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000];
    for (const [index, expectedDelay] of expectedDelays.entries()) {
      nowMs += 9_000;
      streams[index]!.resolve();
      await flushAsyncWork();
      expect(scheduled[0]?.ms).toBe(expectedDelay);
      scheduled.shift()?.callback();
      await flushAsyncWork();
    }

    expect(discoveryCalls).toBe(1);
    expect(streamCalls).toBe(8);
    expect(pageTokens).toEqual([
      null,
      "resume-1",
      "resume-2",
      "resume-3",
      "resume-4",
      "resume-5",
      "resume-6",
      "resume-7"
    ]);
    expect(service.getStatus()).toMatchObject({
      activeLiveChatId: "live-chat-1",
      state: "connected"
    });

    service.stop();
  });

  it("retains the latest resume token when a later batch omits one", async () => {
    const scheduled: Array<() => void> = [];
    const first = createDeferredStream();
    const second = createDeferredStream();
    const pageTokens: Array<string | null> = [];
    let streamCalls = 0;
    const service = new YouTubeLiveChatReadOnlyIntakeService({
      contextResolver: async () => context,
      liveChatApi: {
        findActiveLiveChat: async () => ({ liveChatId: "live-chat-1", title: "Live stream" }),
        openMessageStream: async ({ onBatch, pageToken }) => {
          pageTokens.push(pageToken);
          streamCalls += 1;
          if (streamCalls === 1) {
            onBatch({ messages: [], nextPageToken: "resume-1" });
            onBatch({ messages: [], nextPageToken: null });
            return first.stream;
          }
          return second.stream;
        }
      },
      random: () => 0.5,
      setTimeoutFn: (callback) => {
        scheduled.push(callback);
        return callback;
      },
      clearTimeoutFn: () => undefined
    });

    service.start();
    await flushAsyncWork();
    first.resolve();
    await flushAsyncWork();
    scheduled.shift()?.();
    await flushAsyncWork();

    expect(pageTokens).toEqual([null, "resume-1"]);
    service.stop();
  });

  it("keeps start single-flight while discovery is already in progress", async () => {
    let resolveDiscovery: ((value: null) => void) | undefined;
    const discovery = new Promise<null>((resolve) => {
      resolveDiscovery = resolve;
    });
    let discoveryCalls = 0;
    const service = new YouTubeLiveChatReadOnlyIntakeService({
      contextResolver: async () => context,
      liveChatApi: {
        findActiveLiveChat: async () => {
          discoveryCalls += 1;
          return await discovery;
        },
        openMessageStream: async () => {
          throw new Error("should not open a stream");
        }
      },
      setTimeoutFn: () => 1,
      clearTimeoutFn: () => undefined
    });

    service.start();
    service.start();
    await flushAsyncWork();

    expect(discoveryCalls).toBe(1);
    resolveDiscovery?.(null);
    await flushAsyncWork();
  });

  it("runs explicit Start immediately while waiting instead of waiting for safety reconciliation", async () => {
    const scheduled: Array<{ callback: () => void; ms: number }> = [];
    const clearTimeoutFn = vi.fn();
    let discoveryCalls = 0;
    const service = new YouTubeLiveChatReadOnlyIntakeService({
      contextResolver: async () => context,
      liveChatApi: {
        findActiveLiveChat: async () => {
          discoveryCalls += 1;
          return null;
        },
        openMessageStream: async () => {
          throw new Error("should not open a stream");
        }
      },
      now: () => new Date("2026-07-04T12:00:00Z"),
      setTimeoutFn: (callback, ms) => {
        scheduled.push({ callback, ms });
        return callback;
      },
      clearTimeoutFn
    });

    service.start();
    await flushAsyncWork();
    expect(discoveryCalls).toBe(1);
    expect(scheduled[0]?.ms).toBe(30 * 60_000);

    service.start();
    await flushAsyncWork();
    expect(discoveryCalls).toBe(2);
    expect(clearTimeoutFn).toHaveBeenCalledTimes(1);
  });

  it("drops a terminal live-chat identity and waits for low-frequency rediscovery", async () => {
    const scheduled: Array<{ callback: () => void; ms: number }> = [];
    const deferred = createDeferredStream();
    let discoveryCalls = 0;
    const service = new YouTubeLiveChatReadOnlyIntakeService({
      contextResolver: async () => context,
      liveChatApi: {
        findActiveLiveChat: async () => {
          discoveryCalls += 1;
          return { liveChatId: "live-chat-1", title: "Live stream" };
        },
        openMessageStream: async () => deferred.stream
      },
      setTimeoutFn: (callback, ms) => {
        scheduled.push({ callback, ms });
        return callback;
      },
      clearTimeoutFn: () => undefined
    });

    service.start();
    await flushAsyncWork();
    deferred.reject({ code: 9, message: "live chat ended" });
    await flushAsyncWork();

    expect(discoveryCalls).toBe(1);
    expect(service.getStatus()).toMatchObject({
      activeLiveChatId: null,
      state: "waiting"
    });
    expect(scheduled).toEqual([{ callback: expect.any(Function), ms: 30 * 60_000 }]);
  });

  it("stops an active stream without scheduling a reconnect", async () => {
    const deferred = createDeferredStream();
    const scheduled: Array<() => void> = [];
    const service = new YouTubeLiveChatReadOnlyIntakeService({
      contextResolver: async () => context,
      liveChatApi: {
        findActiveLiveChat: async () => ({ liveChatId: "live-chat-1", title: "Live stream" }),
        openMessageStream: async () => deferred.stream
      },
      setTimeoutFn: (callback) => {
        scheduled.push(callback);
        return callback;
      },
      clearTimeoutFn: () => undefined
    });

    service.start();
    await flushAsyncWork();
    expect(service.getStatus().state).toBe("connected");

    expect(service.stop().state).toBe("stopped");
    await flushAsyncWork();
    expect(deferred.cancel).toHaveBeenCalledTimes(1);
    expect(scheduled).toHaveLength(0);
  });
});
