import { describe, expect, it } from "vitest";

import {
  projectTwitchEventSubDefaultStatuses,
  resolveTwitchEventSubSubscriptionConfig,
  summarizeTwitchEventSubSubscription
} from "./twitch-eventsub-subscriptions.rules.js";
import { TwitchEventSubSubscriptionService } from "./twitch-eventsub-subscriptions.service.js";
import type {
  TwitchEventSubHelixSubscription,
  TwitchEventSubHelixTransport
} from "./twitch-eventsub-subscriptions.types.js";

class FakeTwitchEventSubTransport implements TwitchEventSubHelixTransport {
  public createCalls: Array<{ type: string; version: string; condition: Record<string, string>; secret: string }> = [];
  public subscriptions: TwitchEventSubHelixSubscription[] = [];
  public token: string | null = "app-token";
  public user = {
    id: "617410645",
    login: "maiksmc"
  };

  public async createSubscription(input: {
    condition: Record<string, string>;
    secret: string;
    type: string;
    version: string;
  }): Promise<TwitchEventSubHelixSubscription | null> {
    this.createCalls.push(input);

    return {
      condition: input.condition,
      cost: 0,
      created_at: "2026-07-05T08:00:00Z",
      id: `${input.type}-id`,
      status: "webhook_callback_verification_pending",
      transport: {
        callback: "https://api-dev.maiks.yt/provider-webhooks/twitch/eventsub",
        method: "webhook"
      },
      type: input.type,
      version: input.version
    };
  }

  public async getAppAccessToken(): Promise<string | null> {
    return this.token;
  }

  public async getUserByLogin(): Promise<{ id: string; login: string } | null> {
    return this.user;
  }

  public async listSubscriptions(): Promise<readonly TwitchEventSubHelixSubscription[] | null> {
    return this.subscriptions;
  }
}

const env = {
  API_PUBLIC_BASE_URL: "https://api-dev.maiks.yt",
  TWITCH_CLIENT_ID: "client-id",
  TWITCH_CLIENT_SECRET: "client-secret",
  TWITCH_EVENTSUB_WEBHOOK_SECRET: "0123456789abcdef",
  TWITCH_CHANNEL: "MaiksMC"
};

describe("Twitch EventSub subscription rules", () => {
  it("resolves safe config without exposing secrets", () => {
    expect(resolveTwitchEventSubSubscriptionConfig(env)).toEqual({
      broadcasterLogin: "MaiksMC",
      callbackUrl: "https://api-dev.maiks.yt/provider-webhooks/twitch/eventsub",
      clientId: "client-id",
      clientSecret: "client-secret",
      secret: "0123456789abcdef"
    });

    expect(resolveTwitchEventSubSubscriptionConfig({
      ...env,
      TWITCH_EVENTSUB_WEBHOOK_SECRET: "short"
    })).toBeNull();
  });

  it("summarizes current subscriptions and default states", () => {
    const summary = summarizeTwitchEventSubSubscription({
      condition: {
        broadcaster_user_id: "617410645"
      },
      cost: 0,
      created_at: "2026-07-05T08:00:00Z",
      id: "sub-1",
      status: "enabled",
      transport: {
        callback: "https://api-dev.maiks.yt/provider-webhooks/twitch/eventsub",
        method: "webhook"
      },
      type: "stream.online",
      version: "1"
    }, "https://api-dev.maiks.yt/provider-webhooks/twitch/eventsub");

    expect(summary).toMatchObject({
      callbackMatches: true,
      condition: {
        broadcaster_user_id: "617410645"
      },
      id: "sub-1",
      status: "enabled",
      type: "stream.online"
    });

    expect(projectTwitchEventSubDefaultStatuses({
      broadcasterUserId: "617410645",
      subscriptions: summary ? [summary] : []
    })).toEqual([
      expect.objectContaining({
        state: "enabled"
      }),
      expect.objectContaining({
        state: "missing"
      }),
      expect.objectContaining({
        state: "missing"
      })
    ]);
  });
});

describe("TwitchEventSubSubscriptionService", () => {
  it("lists default subscription state through sanitized Helix data", async () => {
    const transport = new FakeTwitchEventSubTransport();
    transport.subscriptions = [
      {
        condition: {
          broadcaster_user_id: "617410645"
        },
        id: "stream-online",
        status: "enabled",
        transport: {
          callback: "https://api-dev.maiks.yt/provider-webhooks/twitch/eventsub",
          method: "webhook"
        },
        type: "stream.online",
        version: "1"
      }
    ];
    const service = new TwitchEventSubSubscriptionService({ env, transport });

    await expect(service.listDefaults()).resolves.toMatchObject({
      broadcasterLogin: "maiksmc",
      ok: true,
      readOnly: true,
      defaults: [
        {
          state: "enabled"
        },
        {
          state: "missing"
        },
        {
          state: "missing"
        }
      ]
    });
  });

  it("creates missing defaults without recreating enabled subscriptions", async () => {
    const transport = new FakeTwitchEventSubTransport();
    transport.subscriptions = [
      {
        condition: {
          broadcaster_user_id: "617410645"
        },
        id: "stream-online",
        status: "enabled",
        transport: {
          callback: "https://api-dev.maiks.yt/provider-webhooks/twitch/eventsub",
          method: "webhook"
        },
        type: "stream.online",
        version: "1"
      }
    ];
    const service = new TwitchEventSubSubscriptionService({ env, transport });
    const result = await service.ensureDefaults();
    const serialized = JSON.stringify(result);

    expect(result).toMatchObject({
      ok: true,
      results: [
        {
          state: "already_enabled"
        },
        {
          state: "created"
        },
        {
          state: "created"
        }
      ]
    });
    expect(transport.createCalls.map((call) => call.type)).toEqual(["stream.offline", "channel.update"]);
    expect(serialized).not.toContain("client-secret");
    expect(serialized).not.toContain("0123456789abcdef");
  });

  it("returns safe missing configuration instead of throwing", async () => {
    const service = new TwitchEventSubSubscriptionService({
      env: {
        TWITCH_CLIENT_ID: "client-id"
      },
      transport: new FakeTwitchEventSubTransport()
    });

    await expect(service.listDefaults()).resolves.toEqual({
      ok: false,
      reason: "twitch_eventsub_config_missing"
    });
  });
});
