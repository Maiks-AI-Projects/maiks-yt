import { describe, expect, it, vi } from "vitest";

import { createTwitchWarningMessage } from "./twitch-chat-warning.rules.js";
import { TwitchChatWarningDeliveryService } from "./twitch-chat-warning.service.js";

describe("createTwitchWarningMessage", () => {
  it("uses a normalized Twitch login when available", () => {
    expect(createTwitchWarningMessage({
      authorName: "Viewer Name",
      userName: "Viewer_Login",
      warningCount: 2,
      warningThreshold: 3
    })).toEqual({
      content: "@viewer_login this is warning 2/3. A third warning results in an automatic Maiks.yt stream-surface ban.",
      targetChannelName: null
    });
  });

  it("falls back to sanitized display text without a tag-shaped login", () => {
    expect(createTwitchWarningMessage({
      authorName: " @everyone \u0000 Viewer ",
      userName: "not valid",
      warningCount: 1,
      warningThreshold: 3
    })).toEqual({
      content: "everyone Viewer this is warning 1/3. A third warning results in an automatic Maiks.yt stream-surface ban.",
      targetChannelName: null
    });
  });
});

describe("TwitchChatWarningDeliveryService", () => {
  it("connects, sends the warning, and quits through the injected Twitch chat client", async () => {
    const connect = vi.fn(async () => undefined);
    const quit = vi.fn(async () => undefined);
    const say = vi.fn(async () => undefined);
    const createClient = vi.fn(() => ({
      connect,
      quit,
      say
    }));
    const service = new TwitchChatWarningDeliveryService({
      createClient,
      env: {
        TWITCH_CHAT_BOT_ACCESS_TOKEN: "twitch-access-token",
        TWITCH_CLIENT_ID: "twitch-client-id"
      }
    });

    await expect(service.sendWarning({
      authorName: "Viewer Name",
      channelName: "#MaiksMC",
      userName: "viewer_login",
      warningCount: 1,
      warningThreshold: 3
    })).resolves.toMatchObject({
      ok: true,
      providerAction: true,
      providerMessageSent: true,
      providerMessage: "@viewer_login this is warning 1/3. A third warning results in an automatic Maiks.yt stream-surface ban."
    });

    expect(createClient).toHaveBeenCalledWith({
      accessToken: "twitch-access-token",
      channelName: "maiksmc",
      clientId: "twitch-client-id"
    });
    expect(connect).toHaveBeenCalledTimes(1);
    expect(say).toHaveBeenCalledWith(
      "maiksmc",
      "@viewer_login this is warning 1/3. A third warning results in an automatic Maiks.yt stream-surface ban."
    );
    expect(quit).toHaveBeenCalledTimes(1);
  });

  it("fails closed without token or channel context", async () => {
    const missingTokenService = new TwitchChatWarningDeliveryService({
      createClient: vi.fn(),
      env: {
        TWITCH_CLIENT_ID: "twitch-client-id"
      }
    });

    await expect(missingTokenService.sendWarning({
      authorName: "Viewer",
      channelName: "maiksmc",
      userName: "viewer_login",
      warningCount: 1,
      warningThreshold: 3
    })).resolves.toMatchObject({
      ok: false,
      providerAction: false,
      providerMessageSent: false,
      reason: "twitch_warning_unconfigured"
    });

    const missingChannelService = new TwitchChatWarningDeliveryService({
      createClient: vi.fn(),
      env: {
        TWITCH_CHAT_BOT_ACCESS_TOKEN: "twitch-access-token",
        TWITCH_CLIENT_ID: "twitch-client-id"
      }
    });

    await expect(missingChannelService.sendWarning({
      authorName: "Viewer",
      channelName: null,
      userName: "viewer_login",
      warningCount: 1,
      warningThreshold: 3
    })).resolves.toMatchObject({
      ok: false,
      providerAction: false,
      providerMessageSent: false,
      reason: "twitch_warning_missing_context"
    });
  });

  it("returns sanitized provider failures without leaking the token", async () => {
    const service = new TwitchChatWarningDeliveryService({
      createClient: () => ({
        connect: vi.fn(async () => undefined),
        quit: vi.fn(async () => undefined),
        say: vi.fn(async () => {
          throw new Error("secret-twitch-token exploded");
        })
      }),
      env: {
        TWITCH_CHAT_BOT_ACCESS_TOKEN: "secret-twitch-token",
        TWITCH_CLIENT_ID: "twitch-client-id"
      }
    });

    const result = await service.sendWarning({
      authorName: "Viewer",
      channelName: "maiksmc",
      userName: "viewer_login",
      warningCount: 1,
      warningThreshold: 3
    });

    expect(result).toMatchObject({
      ok: false,
      providerAction: true,
      providerMessageId: "twitch-warning-unavailable",
      providerMessageSent: false,
      reason: "twitch_warning_unavailable"
    });
    expect(JSON.stringify(result)).not.toContain("secret-twitch-token");
  });
});
