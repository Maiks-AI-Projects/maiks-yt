import { describe, expect, it, vi } from "vitest";

import { TwitchChatModerationService } from "./twitch-chat-moderation.service.js";

const configuredEnv = {
  TWITCH_CHAT_BOT_ACCESS_TOKEN: "twitch-access-token",
  TWITCH_CLIENT_ID: "twitch-client-id",
  TWITCH_BROADCASTER_ID: "111111",
  TWITCH_MODERATOR_ID: "222222"
};

describe("TwitchChatModerationService", () => {
  it("deletes a Twitch chat message through Helix moderation chat", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 204
    }));
    const service = new TwitchChatModerationService({
      env: configuredEnv,
      fetchFn
    });

    await expect(service.moderate({
      action: "delete_message",
      messageId: "provider-message-1",
      reason: "Delete from Maiks.yt chat.",
      userId: "333333"
    })).resolves.toMatchObject({
      ok: true,
      providerAction: true,
      providerActionSent: true
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.twitch.tv/helix/moderation/chat?broadcaster_id=111111&moderator_id=222222&message_id=provider-message-1",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer twitch-access-token",
          "Client-Id": "twitch-client-id"
        }),
        method: "DELETE"
      })
    );
  });

  it("times out and bans Twitch users through Helix moderation bans", async () => {
    const requestBodies: string[] = [];
    const fetchFn = vi.fn(async (_url, init) => {
      requestBodies.push(init.body ?? "{}");
      return {
        ok: true,
        status: 200
      };
    });
    const service = new TwitchChatModerationService({
      env: configuredEnv,
      fetchFn
    });

    await service.moderate({
      action: "timeout_author",
      durationSeconds: 600,
      messageId: "provider-message-1",
      reason: "Timeout from Maiks.yt chat.",
      userId: "333333"
    });
    await service.moderate({
      action: "ban_author",
      messageId: "provider-message-1",
      reason: "Ban from Maiks.yt chat.",
      userId: "333333"
    });

    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      "https://api.twitch.tv/helix/moderation/bans?broadcaster_id=111111&moderator_id=222222",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(JSON.parse(requestBodies[0] ?? "{}")).toEqual({
      data: {
        duration: 600,
        reason: "Timeout from Maiks.yt chat.",
        user_id: "333333"
      }
    });
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      "https://api.twitch.tv/helix/moderation/bans?broadcaster_id=111111&moderator_id=222222",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(JSON.parse(requestBodies[1] ?? "{}")).toEqual({
      data: {
        reason: "Ban from Maiks.yt chat.",
        user_id: "333333"
      }
    });
  });

  it("fails closed without token/client id or required provider context", async () => {
    await expect(new TwitchChatModerationService({
      env: {
        TWITCH_CLIENT_ID: "twitch-client-id"
      },
      fetchFn: vi.fn()
    }).moderate({
      action: "delete_message",
      messageId: "provider-message-1",
      reason: "Delete from Maiks.yt chat.",
      userId: "333333"
    })).resolves.toMatchObject({
      ok: false,
      providerAction: false,
      reason: "twitch_moderation_unconfigured"
    });

    await expect(new TwitchChatModerationService({
      env: configuredEnv,
      fetchFn: vi.fn()
    }).moderate({
      action: "timeout_author",
      messageId: "provider-message-1",
      reason: "Timeout from Maiks.yt chat.",
      userId: null
    })).resolves.toMatchObject({
      ok: false,
      providerAction: false,
      reason: "twitch_moderation_missing_context"
    });
  });

  it("returns sanitized provider failures without leaking the access token", async () => {
    const service = new TwitchChatModerationService({
      env: {
        ...configuredEnv,
        TWITCH_CHAT_BOT_ACCESS_TOKEN: "secret-twitch-token"
      },
      fetchFn: vi.fn(async () => ({
        ok: false,
        status: 401
      }))
    });

    const result = await service.moderate({
      action: "delete_message",
      messageId: "provider-message-1",
      reason: "Delete from Maiks.yt chat.",
      userId: "333333"
    });

    expect(result).toMatchObject({
      ok: false,
      providerAction: true,
      providerActionSent: false,
      reason: "twitch_moderation_provider_rejected"
    });
    expect(JSON.stringify(result)).not.toContain("secret-twitch-token");
  });
});
