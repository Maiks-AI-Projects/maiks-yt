import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildTwitchEventSubCondition,
  projectTwitchEventSubDefaultStatuses,
  resolveTwitchEventSubSubscriptionConfig,
  summarizeTwitchEventSubSubscription,
  twitchEventSubDefaultSubscriptions
} from "./twitch-eventsub-subscriptions.rules.js";
import {
  createTwitchEventSubHelixTransport,
  TwitchEventSubSubscriptionService
} from "./twitch-eventsub-subscriptions.service.js";
import type {
  TwitchEventSubHelixSubscription,
  TwitchEventSubHelixTransport
} from "./twitch-eventsub-subscriptions.types.js";

class FakeTwitchEventSubTransport implements TwitchEventSubHelixTransport {
  public createCalls: Array<{ type: string; version: string; condition: Record<string, string>; secret: string }> = [];
  public listCalls = 0;
  public subscriptions: TwitchEventSubHelixSubscription[] = [];
  public token: string | null = "app-token";
  public tokenCalls = 0;
  public user = {
    id: "617410645",
    login: "maiksmc"
  };
  public userLookups: string[] = [];

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
    this.tokenCalls += 1;
    return this.token;
  }

  public async getUserByLogin(input: { login: string }): Promise<{ id: string; login: string } | null> {
    this.userLookups.push(input.login);
    return this.user;
  }

  public async listSubscriptions(): Promise<readonly TwitchEventSubHelixSubscription[] | null> {
    this.listCalls += 1;
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

const createHelixSubscription = (
  override: Partial<TwitchEventSubHelixSubscription> = {}
): TwitchEventSubHelixSubscription => ({
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
  version: "1",
  ...override
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Twitch EventSub subscription rules", () => {
  it("resolves safe config without exposing secrets", () => {
    expect(resolveTwitchEventSubSubscriptionConfig(env)).toEqual({
      broadcasterLogin: "maiksmc",
      broadcasterLogins: ["maiksmc"],
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

  it("defaults webhook delivery to the production API origin", () => {
    const { API_PUBLIC_BASE_URL: _omitted, ...productionFallbackEnv } = env;

    expect(resolveTwitchEventSubSubscriptionConfig(productionFallbackEnv)).toMatchObject({
      callbackUrl: "https://api.maiks.yt/provider-webhooks/twitch/eventsub"
    });
  });

  it("normalizes and deduplicates the configured broadcaster set", () => {
    expect(resolveTwitchEventSubSubscriptionConfig({
      ...env,
      TWITCH_CHAT_CHANNELS: "#MaiksMC, maiksplays, MAIKSMC"
    })).toMatchObject({
      broadcasterLogin: "maiksmc",
      broadcasterLogins: ["maiksmc", "maiksplays"]
    });
  });

  it("preserves legacy primary precedence before merging configured broadcaster channels", () => {
    expect(resolveTwitchEventSubSubscriptionConfig({
      ...env,
      TWITCH_CHANNEL: "PrimaryChannel",
      TWITCH_CHAT_CHANNEL: "ChatOnly",
      TWITCH_CHAT_CHANNELS: "listfirst,PrimaryChannel,listsecond",
      TWITCH_LOGIN: "LoginOnly"
    })).toMatchObject({
      broadcasterLogin: "primarychannel",
      broadcasterLogins: ["primarychannel", "listfirst", "listsecond"]
    });

    expect(resolveTwitchEventSubSubscriptionConfig({
      ...env,
      TWITCH_CHANNEL: undefined,
      TWITCH_CHAT_CHANNEL: "ChatOnly",
      TWITCH_CHAT_CHANNELS: "listfirst,LoginOnly",
      TWITCH_LOGIN: "LoginOnly"
    })).toMatchObject({
      broadcasterLogin: "loginonly",
      broadcasterLogins: ["loginonly", "listfirst"]
    });

    expect(resolveTwitchEventSubSubscriptionConfig({
      ...env,
      TWITCH_CHANNEL: undefined,
      TWITCH_CHAT_CHANNEL: "ChatOnly",
      TWITCH_CHAT_CHANNELS: "listfirst,ChatOnly",
      TWITCH_LOGIN: undefined
    })).toMatchObject({
      broadcasterLogin: "chatonly",
      broadcasterLogins: ["chatonly", "listfirst"]
    });
  });

  it("allows the first configured channel to be primary when no legacy primary exists", () => {
    expect(resolveTwitchEventSubSubscriptionConfig({
      ...env,
      TWITCH_CHANNEL: undefined,
      TWITCH_CHAT_CHANNEL: undefined,
      TWITCH_CHAT_CHANNELS: "bad name, #MaiksPlays, maiksmc",
      TWITCH_LOGIN: undefined
    })).toMatchObject({
      broadcasterLogin: "maiksplays",
      broadcasterLogins: ["maiksplays", "maiksmc"]
    });
  });

  it("filters invalid and oversized EventSub broadcaster names and bounds the configured set", () => {
    const extraChannels = Array.from({ length: 12 }, (_, index) => `extra_${index}`).join(",");
    const acceptedMaxLengthLogin = "a".repeat(25);

    expect(resolveTwitchEventSubSubscriptionConfig({
      ...env,
      TWITCH_CHAT_CHANNELS: [
        "#MaiksMC",
        "bad-name",
        "two words",
        "MAIKSMC",
        "b".repeat(26),
        acceptedMaxLengthLogin,
        extraChannels
      ].join(",")
    })).toMatchObject({
      broadcasterLogin: "maiksmc",
      broadcasterLogins: [
        "maiksmc",
        acceptedMaxLengthLogin,
        "extra_0",
        "extra_1",
        "extra_2",
        "extra_3",
        "extra_4",
        "extra_5",
        "extra_6",
        "extra_7"
      ]
    });
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
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({
        desired: expect.objectContaining({
          type: "stream.online"
        }),
        state: "enabled"
      }),
      expect.objectContaining({
        desired: expect.objectContaining({
          type: "stream.offline"
        }),
        state: "missing"
      }),
      expect.objectContaining({
        desired: expect.objectContaining({
          type: "channel.update"
        }),
        state: "missing"
      })
    ]));
    expect(projectTwitchEventSubDefaultStatuses({
      broadcasterUserId: "617410645",
      subscriptions: summary ? [summary] : []
    })).toHaveLength(twitchEventSubDefaultSubscriptions.length);
  });

  it("builds EventSub conditions for scoped Twitch subscriptions", () => {
    const follow = twitchEventSubDefaultSubscriptions.find((desired) => desired.type === "channel.follow");
    const raid = twitchEventSubDefaultSubscriptions.find((desired) => desired.type === "channel.raid");

    expect(follow).toBeDefined();
    expect(raid).toBeDefined();
    expect(follow ? buildTwitchEventSubCondition(follow, "617410645") : null).toEqual({
      broadcaster_user_id: "617410645",
      moderator_user_id: "617410645"
    });
    expect(raid ? buildTwitchEventSubCondition(raid, "617410645") : null).toEqual({
      to_broadcaster_user_id: "617410645"
    });
  });
});

describe("createTwitchEventSubHelixTransport", () => {
  it("lists subscriptions across all Helix EventSub pages", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [createHelixSubscription({ id: "page-one" })],
        pagination: { cursor: "next-page" }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [createHelixSubscription({ id: "page-two" })],
        pagination: {}
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const transport = createTwitchEventSubHelixTransport();

    await expect(transport.listSubscriptions({
      accessToken: "app-token",
      clientId: "client-id"
    })).resolves.toMatchObject([
      { id: "page-one" },
      { id: "page-two" }
    ]);

    const firstUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    const secondUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(firstUrl.searchParams.get("first")).toBe("100");
    expect(firstUrl.searchParams.has("after")).toBe(false);
    expect(secondUrl.searchParams.get("first")).toBe("100");
    expect(secondUrl.searchParams.get("after")).toBe("next-page");
  });

  it("fails closed when Helix EventSub pagination repeats a cursor", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      data: [createHelixSubscription()],
      pagination: { cursor: "same-page" }
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const transport = createTwitchEventSubHelixTransport();

    await expect(transport.listSubscriptions({
      accessToken: "app-token",
      clientId: "client-id"
    })).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails closed when Helix EventSub pagination exceeds the page limit", async () => {
    let cursorIndex = 0;
    const fetchMock = vi.fn(async () => {
      cursorIndex += 1;

      return new Response(JSON.stringify({
        data: [createHelixSubscription()],
        pagination: { cursor: `cursor-${cursorIndex}` }
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const transport = createTwitchEventSubHelixTransport();

    await expect(transport.listSubscriptions({
      accessToken: "app-token",
      clientId: "client-id"
    })).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(20);
  });

  it("fails closed when Helix EventSub pagination is malformed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      data: [createHelixSubscription()],
      pagination: { cursor: 123 }
    }), { status: 200 })));
    const transport = createTwitchEventSubHelixTransport();

    await expect(transport.listSubscriptions({
      accessToken: "app-token",
      clientId: "client-id"
    })).resolves.toBeNull();
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
    const result = await service.listDefaults();

    expect(result).toMatchObject({
      broadcasterLogin: "maiksmc",
      ok: true,
      readOnly: true
    });
    expect(result.ok ? result.defaults : []).toHaveLength(twitchEventSubDefaultSubscriptions.length);
    expect(result.ok ? result.defaults.find((entry) => entry.desired.type === "stream.online") : null)
      .toMatchObject({ state: "enabled" });
    expect(result.ok ? result.defaults.find((entry) => entry.desired.type === "stream.offline") : null)
      .toMatchObject({ state: "missing" });
    expect(result.ok ? result.defaults.find((entry) => entry.desired.type === "channel.update") : null)
      .toMatchObject({ state: "missing" });
  });

  it("targets an explicitly selected configured broadcaster", async () => {
    const transport = new FakeTwitchEventSubTransport();
    transport.user = { id: "maiksplays-id", login: "maiksplays" };
    const service = new TwitchEventSubSubscriptionService({
      env: {
        ...env,
        TWITCH_CHAT_CHANNELS: "maiksmc,maiksplays"
      },
      transport
    });

    const result = await service.listDefaults({ broadcasterLogin: "#MaiksPlays" });

    expect(result).toMatchObject({
      broadcasterLogin: "maiksplays",
      broadcasterLogins: ["maiksmc", "maiksplays"],
      broadcasterUserId: "maiksplays-id",
      ok: true
    });
    expect(transport.userLookups).toEqual(["maiksplays"]);
  });

  it("excludes other broadcaster subscriptions from the selected broadcaster list and count", async () => {
    const transport = new FakeTwitchEventSubTransport();
    transport.user = { id: "maiksplays-id", login: "maiksplays" };
    transport.subscriptions = [
      {
        condition: {
          broadcaster_user_id: "maiksmc-id"
        },
        id: "other-stream-online",
        status: "enabled",
        transport: {
          callback: "https://api-dev.maiks.yt/provider-webhooks/twitch/eventsub",
          method: "webhook"
        },
        type: "stream.online",
        version: "1"
      },
      {
        condition: {
          broadcaster_user_id: "maiksplays-id"
        },
        id: "selected-stream-offline",
        status: "enabled",
        transport: {
          callback: "https://api-dev.maiks.yt/provider-webhooks/twitch/eventsub",
          method: "webhook"
        },
        type: "stream.offline",
        version: "1"
      },
      {
        condition: {
          to_broadcaster_user_id: "maiksplays-id"
        },
        id: "selected-raid",
        status: "enabled",
        transport: {
          callback: "https://api-dev.maiks.yt/provider-webhooks/twitch/eventsub",
          method: "webhook"
        },
        type: "channel.raid",
        version: "1"
      },
      {
        condition: {
          broadcaster_user_id: "maiksmc-id",
          moderator_user_id: "maiksplays-id"
        },
        id: "other-follow-moderated-by-selected",
        status: "enabled",
        transport: {
          callback: "https://api-dev.maiks.yt/provider-webhooks/twitch/eventsub",
          method: "webhook"
        },
        type: "channel.follow",
        version: "2"
      }
    ];
    const service = new TwitchEventSubSubscriptionService({
      env: {
        ...env,
        TWITCH_CHAT_CHANNELS: "maiksmc,maiksplays"
      },
      transport
    });

    const result = await service.listDefaults({ broadcasterLogin: "maiksplays" });

    expect(result).toMatchObject({
      broadcasterLogin: "maiksplays",
      ok: true
    });
    expect(result.ok ? result.subscriptions.map((subscription) => subscription.id) : []).toEqual([
      "selected-stream-offline",
      "selected-raid"
    ]);
    expect(result.ok ? result.subscriptions : []).toHaveLength(2);
    expect(result.ok ? result.defaults.find((entry) => entry.desired.type === "stream.online") : null)
      .toMatchObject({ state: "missing" });
    expect(result.ok ? result.defaults.find((entry) => entry.desired.type === "stream.offline") : null)
      .toMatchObject({ state: "enabled" });
    expect(result.ok ? result.defaults.find((entry) => entry.desired.type === "channel.raid") : null)
      .toMatchObject({ state: "enabled" });
  });

  it("rejects an unconfigured broadcaster before calling Twitch", async () => {
    const transport = new FakeTwitchEventSubTransport();
    const service = new TwitchEventSubSubscriptionService({
      env: {
        ...env,
        TWITCH_CHAT_CHANNELS: "maiksmc,maiksplays"
      },
      transport
    });

    await expect(service.ensureDefaults({ broadcasterLogin: "someone-else" })).resolves.toEqual({
      ok: false,
      reason: "twitch_eventsub_broadcaster_not_configured"
    });
    await expect(service.listDefaults({ broadcasterLogin: "bad name" })).resolves.toEqual({
      ok: false,
      reason: "twitch_eventsub_broadcaster_not_configured"
    });
    expect(transport.tokenCalls).toBe(0);
    expect(transport.userLookups).toEqual([]);
    expect(transport.listCalls).toBe(0);
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

    expect(result).toMatchObject({ ok: true });
    expect(result.ok ? result.results : []).toHaveLength(twitchEventSubDefaultSubscriptions.length);
    expect(result.ok ? result.results.find((entry) => entry.desired.type === "stream.online") : null)
      .toMatchObject({ state: "already_enabled" });
    expect(result.ok ? result.results.find((entry) => entry.desired.type === "stream.offline") : null)
      .toMatchObject({ state: "created" });
    expect(result.ok ? result.results.find((entry) => entry.desired.type === "channel.update") : null)
      .toMatchObject({ state: "created" });
    expect(transport.createCalls.map((call) => call.type)).toEqual(expect.arrayContaining([
      "stream.offline",
      "channel.update",
      "channel.follow",
      "channel.subscribe",
      "channel.subscription.gift",
      "channel.subscription.message",
      "channel.cheer",
      "channel.bits.use",
      "channel.raid",
      "channel.channel_points_automatic_reward_redemption.add",
      "channel.channel_points_custom_reward_redemption.add",
      "channel.custom_power_up_redemption.add",
      "channel.goal.begin",
      "channel.goal.progress",
      "channel.goal.end",
      "channel.hype_train.begin",
      "channel.hype_train.progress",
      "channel.hype_train.end",
      "channel.shoutout.receive"
    ]));
    expect(transport.createCalls.map((call) => call.type)).not.toContain("stream.online");
    expect(transport.createCalls.find((call) => call.type === "channel.follow")?.condition).toEqual({
      broadcaster_user_id: "617410645",
      moderator_user_id: "617410645"
    });
    expect(transport.createCalls.find((call) => call.type === "channel.raid")?.condition).toEqual({
      to_broadcaster_user_id: "617410645"
    });
    expect(transport.createCalls).toHaveLength(twitchEventSubDefaultSubscriptions.length - 1);
    expect(serialized).not.toContain("client-secret");
    expect(serialized).not.toContain("0123456789abcdef");
  });

  it("does not recreate defaults returned by the complete subscription list", async () => {
    const transport = new FakeTwitchEventSubTransport();
    transport.subscriptions = [
      createHelixSubscription({
        condition: {
          broadcaster_user_id: "617410645"
        },
        id: "later-page-stream-offline",
        type: "stream.offline"
      })
    ];
    const service = new TwitchEventSubSubscriptionService({ env, transport });
    const result = await service.ensureDefaults();

    expect(result).toMatchObject({ ok: true });
    expect(result.ok ? result.results.find((entry) => entry.desired.type === "stream.offline") : null)
      .toMatchObject({ state: "already_enabled" });
    expect(transport.createCalls.map((call) => call.type)).not.toContain("stream.offline");
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
