import { describe, expect, it, vi } from "vitest";

import { createYouTubeWarningMessage } from "./youtube-chat-warning.rules.js";
import { YouTubeChatWarningDeliveryService } from "./youtube-chat-warning.service.js";
import type { YouTubeLiveChatContext } from "./youtube-live-chat-intake.types.js";
import {
  youtubeLiveChatReadOnlyScope,
  youtubeLiveChatWriteScope
} from "./youtube-owner-oauth.rules.js";

const createContext = (scopes: readonly string[] = [youtubeLiveChatReadOnlyScope, youtubeLiveChatWriteScope]): YouTubeLiveChatContext => ({
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
    scopes
  },
  selectedChannel: {
    customUrl: "@maiksmc",
    id: "youtube-channel-1",
    title: "MaiksMC"
  }
});

describe("createYouTubeWarningMessage", () => {
  it("sanitizes warning messages for YouTube live chat", () => {
    expect(createYouTubeWarningMessage({
      authorName: " Viewer \n Name ",
      warningCount: 2,
      warningThreshold: 3
    })).toEqual({
      content: "@Viewer Name this is warning 2/3. A third warning results in an automatic Maiks.yt stream-surface ban."
    });
  });
});

describe("YouTubeChatWarningDeliveryService", () => {
  it("inserts a warning message when context, live chat, and write scope are available", async () => {
    const insertMessage = vi.fn(async () => ({ id: "youtube-warning-message-1" }));
    const service = new YouTubeChatWarningDeliveryService({
      contextResolver: async () => createContext(),
      insertMessage
    });

    await expect(service.sendWarning({
      authorChannelId: "author-channel-1",
      authorName: "Viewer",
      liveChatId: "live-chat-1",
      warningCount: 1,
      warningThreshold: 3
    })).resolves.toMatchObject({
      ok: true,
      providerAction: true,
      providerMessageId: "youtube-warning-message-1",
      providerMessageSent: true
    });
    expect(insertMessage).toHaveBeenCalledWith({
      context: createContext(),
      liveChatId: "live-chat-1",
      text: "@Viewer this is warning 1/3. A third warning results in an automatic Maiks.yt stream-surface ban."
    });
  });

  it("fails closed when the stored credential is still read-only", async () => {
    const insertMessage = vi.fn();
    const service = new YouTubeChatWarningDeliveryService({
      contextResolver: async () => createContext([youtubeLiveChatReadOnlyScope]),
      insertMessage
    });

    await expect(service.sendWarning({
      authorChannelId: "author-channel-1",
      authorName: "Viewer",
      liveChatId: "live-chat-1",
      warningCount: 1,
      warningThreshold: 3
    })).resolves.toMatchObject({
      ok: false,
      providerAction: false,
      providerMessageSent: false,
      reason: "youtube_warning_scope_missing"
    });
    expect(insertMessage).not.toHaveBeenCalled();
  });

  it("fails closed when no active live chat id is available", async () => {
    const service = new YouTubeChatWarningDeliveryService({
      contextResolver: async () => createContext()
    });

    await expect(service.sendWarning({
      authorChannelId: "author-channel-1",
      authorName: "Viewer",
      liveChatId: null,
      warningCount: 1,
      warningThreshold: 3
    })).resolves.toMatchObject({
      ok: false,
      providerAction: false,
      providerMessageSent: false,
      reason: "youtube_warning_live_chat_missing"
    });
  });

  it("sanitizes provider insert failures", async () => {
    const service = new YouTubeChatWarningDeliveryService({
      contextResolver: async () => createContext(),
      insertMessage: async () => {
        throw new Error("access-token leaked");
      }
    });

    const result = await service.sendWarning({
      authorChannelId: "author-channel-1",
      authorName: "Viewer",
      liveChatId: "live-chat-1",
      warningCount: 1,
      warningThreshold: 3
    });

    expect(result).toMatchObject({
      ok: false,
      providerAction: true,
      providerMessageSent: false,
      reason: "youtube_warning_unavailable"
    });
    expect(JSON.stringify(result)).not.toContain("access-token");
  });
});
