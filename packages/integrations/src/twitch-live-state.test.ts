import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTwitchLiveStateHelixTransport,
  TwitchLiveStateService
} from "./twitch-live-state.service.js";
import type {
  TwitchLiveStateAppAccessToken,
  TwitchLiveStateBroadcasterIdentity,
  TwitchLiveStateHelixStreamResult,
  TwitchLiveStateHelixTransport
} from "./twitch-live-state.types.js";

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

class FakeTwitchLiveStateTransport implements TwitchLiveStateHelixTransport {
  public accessToken: TwitchLiveStateAppAccessToken | null = {
    accessToken: "app-token",
    expiresInSeconds: 3_600
  };
  public streamResult: TwitchLiveStateHelixStreamResult | Promise<TwitchLiveStateHelixStreamResult> = {
    ok: true,
    stream: {
      startedAt: "2026-08-27T18:00:00.000Z",
      type: "live",
      userId: "617410645"
    }
  };
  public readonly streamResults = new Map<
    string,
    TwitchLiveStateHelixStreamResult | Promise<TwitchLiveStateHelixStreamResult>
  >();
  public readonly users = new Map<string, TwitchLiveStateBroadcasterIdentity>([
    ["617410645", { id: "617410645", login: "maiksmc" }]
  ]);
  public user: TwitchLiveStateBroadcasterIdentity | null = {
    id: "617410645",
    login: "maiksmc"
  };
  public userDelay: Promise<void> | null = null;
  public readonly getAppAccessToken = vi.fn(async () => this.accessToken);
  public readonly getStreamByUserId = vi.fn(async (input) => await (
    this.streamResults.get(input.broadcasterUserId) ?? this.streamResult
  ));
  public readonly getUser = vi.fn(async (input) => {
    if (this.userDelay) {
      await this.userDelay;
    }

    if (!this.user) {
      return null;
    }

    if (input.broadcasterUserId) {
      return this.users.get(input.broadcasterUserId) ?? this.user;
    }

    if (input.broadcasterLogin) {
      return [...this.users.values()].find((user) => user.login === input.broadcasterLogin) ?? this.user;
    }

    return this.user;
  });
}

const env = {
  TWITCH_CLIENT_ID: "twitch-client",
  TWITCH_CLIENT_SECRET: "twitch-secret"
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createTwitchLiveStateHelixTransport", () => {
  it("retains a valid app-token lifetime and rejects an invalid lifetime", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "app-token",
        expires_in: 3_600
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "app-token",
        expires_in: "3600"
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const transport = createTwitchLiveStateHelixTransport();

    await expect(transport.getAppAccessToken({
      clientId: "twitch-client",
      clientSecret: "twitch-secret"
    })).resolves.toEqual({ accessToken: "app-token", expiresInSeconds: 3_600 });
    await expect(transport.getAppAccessToken({
      clientId: "twitch-client",
      clientSecret: "twitch-secret"
    })).resolves.toBeNull();
  });

  it("rejects a malformed non-empty Helix streams response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      data: [{ type: "live" }]
    }), { status: 200 })));
    const transport = createTwitchLiveStateHelixTransport();

    await expect(transport.getStreamByUserId({
      accessToken: "app-token",
      broadcasterUserId: "617410645",
      clientId: "twitch-client"
    })).resolves.toEqual({ ok: false, reason: "invalid_response" });
  });

  it("rejects multiple Helix streams for one broadcaster lookup", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      data: [
        { started_at: "2026-08-27T18:00:00.000Z", type: "live", user_id: "617410645" },
        { started_at: "2026-08-27T18:00:01.000Z", type: "live", user_id: "617410645" }
      ]
    }), { status: 200 })));
    const transport = createTwitchLiveStateHelixTransport();

    await expect(transport.getStreamByUserId({
      accessToken: "app-token",
      broadcasterUserId: "617410645",
      clientId: "twitch-client"
    })).resolves.toEqual({ ok: false, reason: "invalid_response" });
  });
});

describe("TwitchLiveStateService", () => {
  it("resolves a Twitch login to canonical broadcaster identity and live Helix state", async () => {
    const transport = new FakeTwitchLiveStateTransport();
    const service = new TwitchLiveStateService({
      env,
      now: () => new Date("2026-08-27T18:01:00.000Z"),
      stateCacheTtlMs: 30_000,
      transport
    });

    const result = await service.resolveProviderChannel({ providerChannelId: "#MaiksMC" });

    expect(result).toMatchObject({
      ok: true,
      broadcaster: {
        id: "617410645",
        login: "maiksmc"
      },
      source: "helix",
      state: "live"
    });
    expect(transport.getUser).toHaveBeenCalledWith(expect.objectContaining({
      broadcasterLogin: "maiksmc",
      broadcasterUserId: null
    }));
    expect(transport.getStreamByUserId).toHaveBeenCalledWith(expect.objectContaining({
      broadcasterUserId: "617410645"
    }));
  });

  it("uses the short-lived state cache and refreshes after TTL expiry", async () => {
    const transport = new FakeTwitchLiveStateTransport();
    let now = new Date("2026-08-27T18:01:00.000Z");
    const service = new TwitchLiveStateService({
      env,
      now: () => now,
      stateCacheTtlMs: 10_000,
      transport
    });

    await service.resolveProviderChannel({ providerChannelId: "617410645" });
    transport.streamResult = { ok: true, stream: null };

    const cached = await service.resolveProviderChannel({ providerChannelId: "617410645" });
    now = new Date("2026-08-27T18:01:11.000Z");
    const refreshed = await service.resolveProviderChannel({ providerChannelId: "617410645" });

    expect(cached).toMatchObject({ ok: true, source: "helix", state: "live" });
    expect(refreshed).toMatchObject({ ok: true, source: "helix", state: "offline" });
    expect(transport.getStreamByUserId).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["numeric broadcaster ID", "617410645"],
    ["cached broadcaster login", "maiksmc"]
  ])("uses cached state for a repeated %s resolution without another app token", async (_, providerChannelId) => {
    const transport = new FakeTwitchLiveStateTransport();
    const service = new TwitchLiveStateService({
      env,
      now: () => new Date("2026-08-27T18:01:00.000Z"),
      stateCacheTtlMs: 30_000,
      transport
    });

    await expect(service.resolveProviderChannel({ providerChannelId }))
      .resolves.toMatchObject({ ok: true, state: "live" });
    transport.accessToken = null;

    await expect(service.resolveProviderChannel({ providerChannelId }))
      .resolves.toMatchObject({ ok: true, state: "live" });
    expect(transport.getAppAccessToken).toHaveBeenCalledTimes(1);
    expect(transport.getStreamByUserId).toHaveBeenCalledTimes(1);
  });

  it("reuses an app token within its conservative lifetime and refreshes at skewed expiry", async () => {
    const transport = new FakeTwitchLiveStateTransport();
    transport.accessToken = { accessToken: "token-one", expiresInSeconds: 10 };
    let now = new Date("2026-08-27T18:01:00.000Z");
    const service = new TwitchLiveStateService({
      accessTokenExpirySkewMs: 1_000,
      env,
      now: () => now,
      stateCacheTtlMs: 1_000,
      transport
    });

    await service.resolveProviderChannel({ providerChannelId: "617410645" });
    now = new Date("2026-08-27T18:01:02.000Z");
    await service.resolveProviderChannel({ providerChannelId: "617410645" });

    expect(transport.getAppAccessToken).toHaveBeenCalledTimes(1);
    expect(transport.getStreamByUserId).toHaveBeenCalledTimes(2);

    transport.accessToken = { accessToken: "token-two", expiresInSeconds: 10 };
    now = new Date("2026-08-27T18:01:09.000Z");
    await service.resolveProviderChannel({ providerChannelId: "617410645" });

    expect(transport.getAppAccessToken).toHaveBeenCalledTimes(2);
    expect(transport.getStreamByUserId).toHaveBeenCalledTimes(3);
  });

  it("caps app-token reuse at 24 hours and rejects invalid service-level lifetimes", async () => {
    const cappedTransport = new FakeTwitchLiveStateTransport();
    cappedTransport.accessToken = {
      accessToken: "token-one",
      expiresInSeconds: 7 * 24 * 60 * 60
    };
    let now = new Date("2026-08-27T18:01:00.000Z");
    const cappedService = new TwitchLiveStateService({
      accessTokenExpirySkewMs: 0,
      env,
      now: () => now,
      stateCacheTtlMs: 1,
      transport: cappedTransport
    });

    await cappedService.resolveProviderChannel({ providerChannelId: "617410645" });
    now = new Date("2026-08-28T18:00:59.999Z");
    await cappedService.resolveProviderChannel({ providerChannelId: "617410645" });
    expect(cappedTransport.getAppAccessToken).toHaveBeenCalledTimes(1);

    cappedTransport.accessToken = {
      accessToken: "token-two",
      expiresInSeconds: 7 * 24 * 60 * 60
    };
    now = new Date("2026-08-28T18:01:00.000Z");
    await cappedService.resolveProviderChannel({ providerChannelId: "617410645" });
    expect(cappedTransport.getAppAccessToken).toHaveBeenCalledTimes(2);
    expect(cappedTransport.getStreamByUserId).toHaveBeenCalledTimes(3);

    const invalidLifetimes = [
      0,
      1.5,
      Math.floor(Number.MAX_SAFE_INTEGER / 1_000) + 1
    ];
    for (const expiresInSeconds of invalidLifetimes) {
      const transport = new FakeTwitchLiveStateTransport();
      transport.accessToken = { accessToken: "invalid-token", expiresInSeconds };
      const service = new TwitchLiveStateService({ env, transport });

      await expect(service.resolveProviderChannel({ providerChannelId: "617410645" }))
        .resolves.toEqual({
          ok: false,
          reason: "twitch_live_state_api_unavailable",
          state: "unknown"
        });
      expect(transport.getUser).not.toHaveBeenCalled();
      expect(transport.getStreamByUserId).not.toHaveBeenCalled();

      transport.accessToken = { accessToken: "valid-token", expiresInSeconds: 3_600 };
      await expect(service.resolveProviderChannel({ providerChannelId: "617410645" }))
        .resolves.toMatchObject({ ok: true, source: "helix", state: "live" });
      expect(transport.getAppAccessToken).toHaveBeenCalledTimes(2);
    }
  });

  it("coalesces concurrent cold-cache identity and Helix resolution per broadcaster", async () => {
    const transport = new FakeTwitchLiveStateTransport();
    const identityGate = createDeferred<void>();
    const streamGate = createDeferred<TwitchLiveStateHelixStreamResult>();
    transport.userDelay = identityGate.promise;
    transport.streamResult = streamGate.promise;
    const service = new TwitchLiveStateService({ env, transport });

    const resolutions = [
      service.resolveProviderChannel({ providerChannelId: "maiksmc" }),
      service.resolveProviderChannel({ providerChannelId: "maiksmc" }),
      service.resolveProviderChannel({ providerChannelId: "maiksmc" })
    ];

    await vi.waitFor(() => {
      expect(transport.getAppAccessToken).toHaveBeenCalledTimes(1);
      expect(transport.getUser).toHaveBeenCalledTimes(1);
    });
    identityGate.resolve();
    await vi.waitFor(() => {
      expect(transport.getStreamByUserId).toHaveBeenCalledTimes(1);
    });
    streamGate.resolve({
      ok: true,
      stream: {
        startedAt: "2026-08-27T18:00:00.000Z",
        type: "live",
        userId: "617410645"
      }
    });

    const results = await Promise.all(resolutions);
    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result).toMatchObject({ ok: true, source: "helix", state: "live" });
    }
    expect(transport.getAppAccessToken).toHaveBeenCalledTimes(1);
    expect(transport.getUser).toHaveBeenCalledTimes(1);
    expect(transport.getStreamByUserId).toHaveBeenCalledTimes(1);
  });

  it("keeps concurrent cold-cache flights separate for different broadcasters", async () => {
    const transport = new FakeTwitchLiveStateTransport();
    transport.users.set("999999999", { id: "999999999", login: "maiksplays" });
    const identityGate = createDeferred<void>();
    const primaryStreamGate = createDeferred<TwitchLiveStateHelixStreamResult>();
    const secondaryStreamGate = createDeferred<TwitchLiveStateHelixStreamResult>();
    transport.userDelay = identityGate.promise;
    transport.streamResults.set("617410645", primaryStreamGate.promise);
    transport.streamResults.set("999999999", secondaryStreamGate.promise);
    const service = new TwitchLiveStateService({ env, transport });

    const resolutions = [
      service.resolveProviderChannel({ providerChannelId: "maiksmc" }),
      service.resolveProviderChannel({ providerChannelId: "maiksmc" }),
      service.resolveProviderChannel({ providerChannelId: "maiksplays" }),
      service.resolveProviderChannel({ providerChannelId: "maiksplays" })
    ];

    await vi.waitFor(() => {
      expect(transport.getAppAccessToken).toHaveBeenCalledTimes(1);
      expect(transport.getUser).toHaveBeenCalledTimes(2);
    });
    identityGate.resolve();
    await vi.waitFor(() => {
      expect(transport.getStreamByUserId).toHaveBeenCalledTimes(2);
    });
    primaryStreamGate.resolve({
      ok: true,
      stream: {
        startedAt: "2026-08-27T18:00:00.000Z",
        type: "live",
        userId: "617410645"
      }
    });
    secondaryStreamGate.resolve({ ok: true, stream: null });

    const results = await Promise.all(resolutions);
    expect(results.map((result) => result.state)).toEqual(["live", "live", "offline", "offline"]);
    expect(transport.getAppAccessToken).toHaveBeenCalledTimes(1);
    expect(transport.getUser).toHaveBeenCalledTimes(2);
    expect(transport.getStreamByUserId).toHaveBeenCalledTimes(2);
  });

  it("preserves a newer EventSub observation when an older Helix lookup finishes late", async () => {
    const transport = new FakeTwitchLiveStateTransport();
    const streamGate = createDeferred<TwitchLiveStateHelixStreamResult>();
    transport.streamResult = streamGate.promise;
    let now = new Date("2026-08-27T18:10:00.000Z");
    const service = new TwitchLiveStateService({
      env,
      now: () => now,
      stateCacheTtlMs: 30_000,
      transport
    });

    const lateHelixResolution = service.resolveProviderChannel({ providerChannelId: "617410645" });
    await vi.waitFor(() => {
      expect(transport.getStreamByUserId).toHaveBeenCalledTimes(1);
    });

    now = new Date("2026-08-27T18:10:01.000Z");
    expect(service.recordEventSubObservation({
      broadcasterLogin: "maiksmc",
      broadcasterUserId: "617410645",
      observedAt: now,
      providerEventName: "stream.online"
    })).toEqual({ ok: true, state: "live", stored: true });
    streamGate.resolve({ ok: true, stream: null });

    await expect(lateHelixResolution).resolves.toMatchObject({
      ok: true,
      source: "eventsub_cache",
      state: "live"
    });
    transport.accessToken = null;
    await expect(service.resolveProviderChannel({ providerChannelId: "617410645" }))
      .resolves.toMatchObject({ ok: true, source: "eventsub_cache", state: "live" });
    expect(transport.getAppAccessToken).toHaveBeenCalledTimes(1);
    expect(transport.getStreamByUserId).toHaveBeenCalledTimes(1);
  });

  it("returns unknown without storing late Helix when the newer EventSub observation expires", async () => {
    const transport = new FakeTwitchLiveStateTransport();
    const streamGate = createDeferred<TwitchLiveStateHelixStreamResult>();
    transport.streamResult = streamGate.promise;
    let now = new Date("2026-08-27T18:11:00.000Z");
    const service = new TwitchLiveStateService({
      env,
      now: () => now,
      stateCacheTtlMs: 1_000,
      transport
    });

    const lateHelixResolution = service.resolveProviderChannel({ providerChannelId: "617410645" });
    await vi.waitFor(() => {
      expect(transport.getStreamByUserId).toHaveBeenCalledTimes(1);
    });

    now = new Date("2026-08-27T18:11:01.000Z");
    service.recordEventSubObservation({
      broadcasterLogin: "maiksmc",
      broadcasterUserId: "617410645",
      observedAt: now,
      providerEventName: "stream.online"
    });
    now = new Date("2026-08-27T18:11:02.001Z");
    streamGate.resolve({ ok: true, stream: null });

    await expect(lateHelixResolution).resolves.toEqual({
      ok: false,
      reason: "twitch_live_state_newer_observation_stale",
      state: "unknown"
    });

    transport.streamResult = {
      ok: true,
      stream: {
        startedAt: "2026-08-27T18:11:02.000Z",
        type: "live",
        userId: "617410645"
      }
    };
    await expect(service.resolveProviderChannel({ providerChannelId: "617410645" }))
      .resolves.toMatchObject({ ok: true, source: "helix", state: "live" });
    expect(transport.getStreamByUserId).toHaveBeenCalledTimes(2);
  });

  it("returns unknown when Helix returns a stream for a different broadcaster", async () => {
    const transport = new FakeTwitchLiveStateTransport();
    transport.streamResult = {
      ok: true,
      stream: {
        startedAt: "2026-08-27T18:00:00.000Z",
        type: "live",
        userId: "999999999"
      }
    };
    const service = new TwitchLiveStateService({ env, transport });

    await expect(service.resolveProviderChannel({ providerChannelId: "617410645" }))
      .resolves.toEqual({
        ok: false,
        reason: "twitch_live_state_stream_broadcaster_mismatch",
        state: "unknown"
      });

    transport.streamResult = { ok: true, stream: null };
    await expect(service.resolveProviderChannel({ providerChannelId: "617410645" }))
      .resolves.toMatchObject({ ok: true, state: "offline" });
    expect(transport.getStreamByUserId).toHaveBeenCalledTimes(2);
  });

  it("returns unknown when Helix returns a stream whose type is not exactly live", async () => {
    const transport = new FakeTwitchLiveStateTransport();
    transport.streamResult = {
      ok: true,
      stream: {
        startedAt: "2026-08-27T18:00:00.000Z",
        type: "rerun",
        userId: "617410645"
      }
    };
    const service = new TwitchLiveStateService({ env, transport });

    await expect(service.resolveProviderChannel({ providerChannelId: "617410645" }))
      .resolves.toEqual({
        ok: false,
        reason: "twitch_live_state_stream_type_unexpected",
        state: "unknown"
      });

    transport.streamResult = { ok: true, stream: null };
    await expect(service.resolveProviderChannel({ providerChannelId: "617410645" }))
      .resolves.toMatchObject({ ok: true, state: "offline" });
    expect(transport.getStreamByUserId).toHaveBeenCalledTimes(2);
  });

  it("does not cache an invalid Helix streams response", async () => {
    const transport = new FakeTwitchLiveStateTransport();
    transport.streamResult = { ok: false, reason: "invalid_response" };
    const service = new TwitchLiveStateService({ env, transport });

    await expect(service.resolveProviderChannel({ providerChannelId: "617410645" }))
      .resolves.toEqual({
        ok: false,
        reason: "twitch_live_state_response_invalid",
        state: "unknown"
      });

    transport.streamResult = { ok: true, stream: null };
    await expect(service.resolveProviderChannel({ providerChannelId: "617410645" }))
      .resolves.toMatchObject({ ok: true, state: "offline" });
    expect(transport.getStreamByUserId).toHaveBeenCalledTimes(2);
  });

  it("stores signed stream observations immediately and ignores older observations", async () => {
    const transport = new FakeTwitchLiveStateTransport();
    let now = new Date("2026-08-27T18:03:00.000Z");
    const service = new TwitchLiveStateService({
      env,
      now: () => now,
      stateCacheTtlMs: 30_000,
      transport
    });

    expect(service.recordEventSubObservation({
      broadcasterLogin: "MaiksMC",
      broadcasterUserId: "617410645",
      observedAt: "2026-08-27T18:03:00.000Z",
      providerEventName: "stream.online"
    })).toEqual({ ok: true, state: "live", stored: true });
    expect(service.recordEventSubObservation({
      broadcasterLogin: "MaiksMC",
      broadcasterUserId: "617410645",
      observedAt: "2026-08-27T18:02:59.000Z",
      providerEventName: "stream.offline"
    })).toEqual({ ok: true, state: "offline", stored: false });

    const resolved = await service.resolveProviderChannel({ providerChannelId: "maiksmc" });
    expect(resolved).toMatchObject({ ok: true, source: "eventsub_cache", state: "live" });
    expect(transport.getAppAccessToken).not.toHaveBeenCalled();

    now = new Date("2026-08-27T18:03:31.000Z");
    transport.streamResult = { ok: true, stream: null };
    const refreshed = await service.resolveProviderChannel({ providerChannelId: "maiksmc" });

    expect(refreshed).toMatchObject({ ok: true, source: "helix", state: "offline" });
    expect(transport.getAppAccessToken).toHaveBeenCalledTimes(1);
  });

  it("keeps EventSub observations scoped to the originating Twitch broadcaster", async () => {
    const transport = new FakeTwitchLiveStateTransport();
    transport.users.set("999999999", { id: "999999999", login: "maiksplays" });
    const service = new TwitchLiveStateService({
      env,
      now: () => new Date("2026-08-27T18:04:00.000Z"),
      stateCacheTtlMs: 30_000,
      transport
    });

    service.recordEventSubObservation({
      broadcasterLogin: "maiksmc",
      broadcasterUserId: "617410645",
      observedAt: "2026-08-27T18:04:00.000Z",
      providerEventName: "stream.online"
    });
    service.recordEventSubObservation({
      broadcasterLogin: "maiksplays",
      broadcasterUserId: "999999999",
      observedAt: "2026-08-27T18:04:01.000Z",
      providerEventName: "stream.offline"
    });

    await expect(service.resolveProviderChannel({ providerChannelId: "617410645" }))
      .resolves.toMatchObject({ ok: true, state: "live" });
    await expect(service.resolveProviderChannel({ providerChannelId: "999999999" }))
      .resolves.toMatchObject({ ok: true, state: "offline" });
  });

  it("returns unknown for missing config, missing identity, API failure, and stale unrefreshable cache", async () => {
    const transport = new FakeTwitchLiveStateTransport();
    let now = new Date("2026-08-27T18:05:00.000Z");
    const service = new TwitchLiveStateService({
      env,
      now: () => now,
      stateCacheTtlMs: 1_000,
      transport
    });

    expect(await new TwitchLiveStateService({ env: {}, transport }).resolveProviderChannel({ providerChannelId: "maiksmc" }))
      .toMatchObject({ ok: false, reason: "twitch_live_state_config_missing", state: "unknown" });
    expect(await service.resolveProviderChannel({ providerChannelId: "" }))
      .toMatchObject({ ok: false, reason: "twitch_live_state_identity_missing", state: "unknown" });

    service.recordEventSubObservation({
      broadcasterUserId: "617410645",
      observedAt: now,
      providerEventName: "stream.online"
    });
    now = new Date("2026-08-27T18:05:02.000Z");
    transport.streamResult = { ok: false };

    expect(await service.resolveProviderChannel({ providerChannelId: "617410645" }))
      .toMatchObject({ ok: false, reason: "twitch_live_state_api_unavailable", state: "unknown" });
  });
});
