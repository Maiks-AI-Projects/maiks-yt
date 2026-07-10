import type { StreamerChatMessage } from "@maiks-yt/events";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import {
  InMemoryStreamerChatModerationRuntime,
  registerStreamerChatModerationRoutes,
  StreamerChatRuntime
} from "../../src/streamer-chat/index.js";

const validAccessToken = "test-control-access-token-123456";

const createMessage = (overrides: Partial<StreamerChatMessage> = {}): StreamerChatMessage => ({
  id: "message-1",
  authorKind: "human",
  authorName: "Test chatter",
  createdAt: "2026-07-10T00:00:00.000Z",
  message: "Hello from chat.",
  source: "discord",
  visibleOnOverlayByDefault: false,
  ...overrides
});

class FakeModerationStore {
  public readonly audits: unknown[] = [];
  public readonly providerAudits: unknown[] = [];

  public async appendAudit(input: unknown): Promise<{ id: string; at: string }> {
    this.audits.push(input);
    return {
      id: `audit-${this.audits.length}`,
      at: "2026-07-10T00:00:00.000Z"
    };
  }

  public async appendProviderWarningAudit(input: unknown): Promise<{ id: string; at: string }> {
    this.providerAudits.push(input);
    return {
      id: `provider-audit-${this.providerAudits.length}`,
      at: "2026-07-10T00:00:00.000Z"
    };
  }

  public async getWarningCount(): Promise<number> {
    return 0;
  }

  public async listAudit(): Promise<unknown[]> {
    return [];
  }

  public async listRules(): Promise<unknown[]> {
    return [];
  }

  public async retractRule(): Promise<null> {
    return null;
  }

  public async upsertActiveState(): Promise<void> {
    // Test double.
  }

  public async upsertAllowState(input: unknown): Promise<void> {
    this.audits.push({ allowState: input });
  }
}

const createServer = () => {
  const server = Fastify();
  const streamerChatRuntime = new StreamerChatRuntime({ maxHistory: 10 });
  const moderationRuntime = new InMemoryStreamerChatModerationRuntime({
    chatRuntime: streamerChatRuntime,
    publishOverlayMessage: vi.fn()
  });
  streamerChatRuntime.setVisibilityFilter((message) => moderationRuntime.isMessageVisible(message));
  const moderationStore = new FakeModerationStore();
  const sendWarning = vi.fn(async () => ({
    ok: true as const,
    providerAction: true as const,
    providerMessageId: "discord-warning-message-1",
    providerMessageSent: true as const,
    providerMessage: "<@123456789012345678> this is warning 1/3. A third warning results in an automatic Maiks.yt stream-surface ban."
  }));
  const sendTwitchWarning = vi.fn(async () => ({
    ok: true as const,
    providerAction: true as const,
    providerMessageId: "twitch-warning-message-1",
    providerMessageSent: true as const,
    providerMessage: "@viewer_login this is warning 1/3. A third warning results in an automatic Maiks.yt stream-surface ban."
  }));
  const sendYouTubeWarning = vi.fn(async () => ({
    ok: true as const,
    providerAction: true as const,
    providerMessageId: "youtube-warning-message-1",
    providerMessageSent: true as const,
    providerMessage: "@Viewer Name this is warning 1/3. A third warning results in an automatic Maiks.yt stream-surface ban."
  }));

  registerStreamerChatModerationRoutes(server, {
    accessService: {
      requirePermission: vi.fn(async () => ({
        ok: true,
        permissions: ["*"]
      })),
      resolvePermissions: vi.fn(async () => ({
        ok: true,
        permissions: ["*"]
      }))
    } as never,
    discordWarningDeliveryService: {
      sendWarning
    },
    moderationRuntime,
    moderationStore: moderationStore as never,
    streamerChatRuntime,
    twitchWarningDeliveryService: {
      sendWarning: sendTwitchWarning
    },
    youtubeWarningDeliveryService: {
      sendWarning: sendYouTubeWarning
    }
  });

  return {
    moderationStore,
    sendTwitchWarning,
    sendYouTubeWarning,
    sendWarning,
    server,
    streamerChatRuntime
  };
};

describe("streamer chat moderation API", () => {
  it("sends a Discord provider warning when Discord message context is available", async () => {
    const { moderationStore, sendWarning, server, streamerChatRuntime } = createServer();
    streamerChatRuntime.appendMessage(createMessage({
      providerChannelId: "234567890123456789",
      providerGuildId: "345678901234567890",
      providerMessageId: "discord-message-1",
      providerUserId: "123456789012345678"
    }));

    const response = await server.inject({
      method: "POST",
      url: "/streamer-chat/moderation/warn",
      payload: {
        accessToken: validAccessToken,
        targetMessageId: "message-1"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      action: "warn",
      providerAction: true,
      providerMessageSent: true,
      providerMessage: "<@123456789012345678> this is warning 1/3. A third warning results in an automatic Maiks.yt stream-surface ban."
    });
    expect(sendWarning).toHaveBeenCalledWith({
      authorName: "Test chatter",
      channelId: "234567890123456789",
      userId: "123456789012345678",
      warningCount: 1,
      warningThreshold: 3
    });
    expect(moderationStore.providerAudits).toHaveLength(1);
  });

  it("sends a Twitch provider warning when Twitch message context is available", async () => {
    const { moderationStore, sendTwitchWarning, server, streamerChatRuntime } = createServer();
    streamerChatRuntime.appendMessage(createMessage({
      id: "twitch-message-1",
      authorName: "Viewer Name",
      channelName: "maiksmc",
      providerChannelId: "maiksmc",
      providerMessageId: "twitch-provider-message-1",
      providerUserId: "viewer_login",
      source: "twitch"
    }));

    const response = await server.inject({
      method: "POST",
      url: "/streamer-chat/moderation/warn",
      payload: {
        accessToken: validAccessToken,
        targetMessageId: "twitch-message-1"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      action: "warn",
      providerAction: true,
      providerMessageSent: true,
      providerMessage: "@viewer_login this is warning 1/3. A third warning results in an automatic Maiks.yt stream-surface ban."
    });
    expect(sendTwitchWarning).toHaveBeenCalledWith({
      authorName: "Viewer Name",
      channelName: "maiksmc",
      userName: "viewer_login",
      warningCount: 1,
      warningThreshold: 3
    });
    expect(moderationStore.providerAudits).toHaveLength(1);
  });

  it("does not send provider warnings for unsupported sources", async () => {
    const { moderationStore, sendTwitchWarning, sendWarning, sendYouTubeWarning, server, streamerChatRuntime } = createServer();
    streamerChatRuntime.appendMessage(createMessage({
      id: "fake-message-1",
      source: "fake-local"
    }));

    const response = await server.inject({
      method: "POST",
      url: "/streamer-chat/moderation/warn",
      payload: {
        accessToken: validAccessToken,
        targetMessageId: "fake-message-1"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      action: "warn",
      providerAction: false,
      providerMessageSent: false
    });
    expect(sendWarning).not.toHaveBeenCalled();
    expect(sendTwitchWarning).not.toHaveBeenCalled();
    expect(sendYouTubeWarning).not.toHaveBeenCalled();
    expect(moderationStore.providerAudits).toHaveLength(0);
  });

  it("adds a local allow rule without provider action", async () => {
    const { moderationStore, server, streamerChatRuntime } = createServer();
    streamerChatRuntime.appendMessage(createMessage({
      id: "allow-message-1",
      source: "twitch"
    }));

    const response = await server.inject({
      method: "POST",
      url: "/streamer-chat/moderation/allow",
      payload: {
        accessToken: validAccessToken,
        durationSeconds: 3600,
        scope: "timed",
        targetMessageId: "allow-message-1"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      action: "allow",
      allowScope: "timed",
      affectedCount: 1,
      providerAction: false
    });
    expect(moderationStore.audits).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "allow_author",
        outcome: "applied",
        reason: "streamer_chat_timed_allowed"
      }),
      expect.objectContaining({
        allowState: expect.objectContaining({
          durationSeconds: 3600,
          stateKind: "author_allowed"
        })
      })
    ]));
    expect(moderationStore.providerAudits).toHaveLength(0);
  });

  it("sends a YouTube provider warning when YouTube live chat context is available", async () => {
    const { moderationStore, sendYouTubeWarning, server, streamerChatRuntime } = createServer();
    streamerChatRuntime.appendMessage(createMessage({
      id: "youtube-message-1",
      authorName: "Viewer Name",
      channelName: "MaiksMC",
      providerChannelId: "live-chat-1",
      providerMessageId: "youtube-provider-message-1",
      providerUserId: "author-channel-1",
      source: "youtube"
    }));

    const response = await server.inject({
      method: "POST",
      url: "/streamer-chat/moderation/warn",
      payload: {
        accessToken: validAccessToken,
        targetMessageId: "youtube-message-1"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      action: "warn",
      providerAction: true,
      providerMessageSent: true,
      providerMessage: "@Viewer Name this is warning 1/3. A third warning results in an automatic Maiks.yt stream-surface ban."
    });
    expect(sendYouTubeWarning).toHaveBeenCalledWith({
      authorChannelId: "author-channel-1",
      authorName: "Viewer Name",
      liveChatId: "live-chat-1",
      warningCount: 1,
      warningThreshold: 3
    });
    expect(moderationStore.providerAudits).toHaveLength(1);
  });
});
