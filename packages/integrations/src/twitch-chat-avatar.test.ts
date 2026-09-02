import { describe, expect, it, vi } from "vitest";

import { createTwitchChatAvatarResolver } from "./twitch-chat-avatar.service.js";

const authentication = {
  accessToken: "test-token",
  clientId: "test-client"
};

describe("createTwitchChatAvatarResolver", () => {
  it("coalesces and caches a bounded safe Helix avatar lookup", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({
      data: [{
        id: "123456",
        profile_image_url: "https://static-cdn.jtvnw.net/jtv_user_pictures/viewer-profile_image.png"
      }]
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    }));
    const resolveAvatarUrl = createTwitchChatAvatarResolver({ authentication, fetchFn });

    expect(resolveAvatarUrl).not.toBeNull();
    const first = resolveAvatarUrl?.("123456");
    const second = resolveAvatarUrl?.("123456");
    await expect(first).resolves.toBe(
      "https://static-cdn.jtvnw.net/jtv_user_pictures/viewer-profile_image.png"
    );
    await expect(second).resolves.toBe(
      "https://static-cdn.jtvnw.net/jtv_user_pictures/viewer-profile_image.png"
    );
    await expect(resolveAvatarUrl?.("123456")).resolves.toBe(
      "https://static-cdn.jtvnw.net/jtv_user_pictures/viewer-profile_image.png"
    );

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.twitch.tv/helix/users?id=123456",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer test-token",
          "Client-Id": "test-client"
        },
        signal: expect.any(AbortSignal)
      })
    );
  });

  it("returns no resolver without credentials and drops unsafe provider image URLs", async () => {
    expect(createTwitchChatAvatarResolver({ authentication: null })).toBeNull();

    const resolveAvatarUrl = createTwitchChatAvatarResolver({
      authentication,
      fetchFn: async () => new Response(JSON.stringify({
        data: [{ id: "123456", profile_image_url: "javascript:alert(1)" }]
      }), { status: 200 })
    });

    await expect(resolveAvatarUrl?.("123456")).resolves.toBeNull();
    await expect(resolveAvatarUrl?.("not-a-user-id")).resolves.toBeNull();
  });

  it("fails open when Helix is unavailable", async () => {
    const resolveAvatarUrl = createTwitchChatAvatarResolver({
      authentication,
      fetchFn: async () => {
        throw new Error("network unavailable");
      }
    });

    await expect(resolveAvatarUrl?.("123456")).resolves.toBeNull();
  });
});
