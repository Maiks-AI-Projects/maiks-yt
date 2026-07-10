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
    streamerChatRuntime
  });

  return {
    moderationStore,
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

  it("does not send provider warnings for non-Discord sources", async () => {
    const { moderationStore, sendWarning, server, streamerChatRuntime } = createServer();
    streamerChatRuntime.appendMessage(createMessage({
      id: "twitch-message-1",
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
      providerAction: false,
      providerMessageSent: false
    });
    expect(sendWarning).not.toHaveBeenCalled();
    expect(moderationStore.providerAudits).toHaveLength(0);
  });
});
