import { describe, expect, it } from "vitest";

import { projectYouTubeLiveChatMessage } from "./youtube-live-chat-intake.rules.js";
import { YouTubeLiveChatReadOnlyIntakeService } from "./youtube-live-chat-intake.service.js";
import type { YouTubeLiveChatContext } from "./youtube-live-chat-intake.types.js";

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
    accessTokenExpiresAt: null
  },
  selectedChannel: {
    id: "youtube-channel-1",
    title: "MaiksMC",
    customUrl: "@maiksmc"
  }
};

describe("projectYouTubeLiveChatMessage", () => {
  it("sanitizes YouTube live chat messages for private streamer chat", () => {
    const result = projectYouTubeLiveChatMessage({
      authorName: " Michael \n ",
      channelName: " MaiksMC ",
      createdAt: "2026-07-04T12:00:00Z",
      messageId: " provider-message-1 ",
      text: " Hello \u0000 stream "
    });

    expect(result).toEqual({
      ok: true,
      message: expect.objectContaining({
        authorKind: "human",
        authorName: "Michael",
        channelName: "MaiksMC",
        createdAt: "2026-07-04T12:00:00.000Z",
        message: "Hello stream",
        providerMessageId: "provider-message-1",
        source: "youtube",
        visibleOnOverlayByDefault: false
      })
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
  it("polls active live chat and emits projected messages", async () => {
    const emitted: unknown[] = [];
    const scheduled: Array<() => void> = [];
    const service = new YouTubeLiveChatReadOnlyIntakeService({
      contextResolver: async () => context,
      liveChatApi: {
        findActiveLiveChat: async () => ({
          liveChatId: "live-chat-1",
          title: "Live stream"
        }),
        listMessages: async () => ({
          messages: [{
            authorName: "Viewer",
            createdAt: "2026-07-04T12:00:00Z",
            id: "message-1",
            text: "First"
          }],
          nextPageToken: "next-page",
          pollingIntervalMs: 10_000
        })
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
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(service.getStatus()).toMatchObject({
      activeLiveChatId: "live-chat-1",
      channelId: "youtube-channel-1",
      channelName: "MaiksMC",
      state: "connected"
    });
    expect(emitted).toHaveLength(1);
    expect(scheduled).toHaveLength(1);
  });

  it("waits without error when no active live chat exists", async () => {
    const service = new YouTubeLiveChatReadOnlyIntakeService({
      contextResolver: async () => context,
      liveChatApi: {
        findActiveLiveChat: async () => null,
        listMessages: async () => {
          throw new Error("should not list messages without live chat");
        }
      },
      now: () => new Date("2026-07-04T12:00:00.000Z"),
      setTimeoutFn: () => 1,
      clearTimeoutFn: () => undefined
    });

    service.start();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(service.getStatus()).toMatchObject({
      activeLiveChatId: null,
      channelId: "youtube-channel-1",
      channelName: "MaiksMC",
      lastError: null,
      state: "waiting"
    });
  });
});
