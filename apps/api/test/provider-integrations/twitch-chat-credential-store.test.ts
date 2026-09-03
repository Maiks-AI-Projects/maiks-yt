import { describe, expect, it, vi } from "vitest";

import { createTwitchChatCredentialStore } from "../../src/provider-integrations/twitch-chat-credential-store.service.js";

const environment = {
  AUTH_DATA_ENCRYPTION_KEY_V1: Buffer.alloc(32, 7).toString("base64"),
  NODE_ENV: "production",
  TWITCH_CLIENT_ID: "client-id",
  TWITCH_CLIENT_SECRET: "client-secret",
  TWITCH_CHAT_BOT_ACCESS_TOKEN: "environment-access-token",
  TWITCH_CHAT_BOT_REFRESH_TOKEN: "environment-refresh-token",
  TWITCH_CHAT_BOT_TOKEN_EXPIRES_AT: "2026-09-03T18:00:00.000Z"
};

describe("Twitch chat credential store", () => {
  it("seeds an encrypted metadata snapshot from the protected environment", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const store = createTwitchChatCredentialStore({ execute } as never, environment);

    await expect(store.loadOrSeed()).resolves.toMatchObject({
      accessToken: "environment-access-token",
      refreshToken: "environment-refresh-token"
    });

    const storedValue = execute.mock.calls[1]?.[1]?.[1] as string;
    expect(storedValue).not.toContain("environment-access-token");
    expect(storedValue).not.toContain("environment-refresh-token");
    expect(JSON.parse(storedValue)).toMatchObject({
      clientId: "client-id",
      version: 1
    });
  });

  it("loads the persisted rotation instead of a stale environment token", async () => {
    const seedExecute = vi.fn().mockResolvedValue([{ affectedRows: 1 }]);
    const seedStore = createTwitchChatCredentialStore({ execute: seedExecute } as never, environment);
    await seedStore.save({
      accessToken: "rotated-access-token",
      accessTokenExpiresAt: Date.parse("2026-09-04T18:00:00.000Z"),
      clientId: "client-id",
      clientSecret: "client-secret",
      refreshToken: "rotated-refresh-token"
    });
    const storedValue = seedExecute.mock.calls[0]?.[1]?.[1] as string;
    const loadExecute = vi.fn().mockResolvedValue([[{ value: storedValue }]]);
    const store = createTwitchChatCredentialStore({ execute: loadExecute } as never, environment);

    await expect(store.loadOrSeed()).resolves.toEqual({
      accessToken: "rotated-access-token",
      accessTokenExpiresAt: Date.parse("2026-09-04T18:00:00.000Z"),
      clientId: "client-id",
      clientSecret: "client-secret",
      refreshToken: "rotated-refresh-token"
    });
    expect(loadExecute).toHaveBeenCalledTimes(1);
  });

  it("refuses a persisted token issued to a different Twitch application", async () => {
    const foreignValue = JSON.stringify({
      accessToken: "encrypted-access",
      accessTokenExpiresAt: null,
      clientId: "different-client-id",
      refreshToken: "encrypted-refresh",
      version: 1
    });
    const execute = vi.fn().mockResolvedValue([[{ value: foreignValue }]]);
    const store = createTwitchChatCredentialStore({ execute } as never, environment);

    await expect(store.loadOrSeed()).rejects.toThrow("does not match the configured application");
  });
});
