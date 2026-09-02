import { describe, expect, it, vi } from "vitest";

import {
  TwitchStreamScheduleDeliveryService,
  createTwitchStreamScheduleDeliveryTransport
} from "./twitch-stream-schedule-delivery.service.js";
import {
  twitchChannelMetadataDeliveryScope,
  twitchScheduleDeliveryScope,
  type TwitchStreamScheduleDeliveryContext,
  type TwitchStreamScheduleDeliveryTransport
} from "./twitch-stream-schedule-delivery.types.js";

const context: TwitchStreamScheduleDeliveryContext = {
  accessToken: "secret-access-token",
  broadcasterId: "1531201792",
  clientId: "client-id",
  scopes: [twitchScheduleDeliveryScope, twitchChannelMetadataDeliveryScope]
};

const baseInput = {
  context,
  currentProviderState: {
    providerCategoryId: "509658",
    providerResourceId: null,
    providerStreamId: null
  },
  operation: "schedule-segment" as const,
  providerChannelId: "1531201792",
  schedule: {
    endsAt: "2026-09-03T20:00:00.000Z",
    startsAt: "2026-09-03T18:00:00.000Z",
    title: "Build stream"
  }
};

const createTransport = (
  override: Partial<TwitchStreamScheduleDeliveryTransport> = {}
): TwitchStreamScheduleDeliveryTransport => ({
  createScheduleSegment: vi.fn(async () => ({
    ok: true,
    payload: { data: [{ category_id: "509658", id: "segment-1" }] },
    status: 200
  })),
  updateChannelInformation: vi.fn(async () => ({ ok: true, payload: null, status: 204 })),
  updateScheduleSegment: vi.fn(async () => ({
    ok: true,
    payload: { data: [{ category_id: "509658", id: "segment-1" }] },
    status: 200
  })),
  ...override
});

describe("Twitch stream schedule delivery service", () => {
  it("creates a schedule segment and returns only a sanitized provider receipt", async () => {
    const transport = createTransport();
    const service = new TwitchStreamScheduleDeliveryService({ transport });

    await expect(service.deliver(baseInput)).resolves.toEqual({
      ok: true,
      providerActionId: "twitch-schedule-segment:segment-1",
      receipt: {
        providerCategoryId: "509658",
        providerResourceId: "segment-1",
        providerStreamId: null
      }
    });

    expect(transport.createScheduleSegment).toHaveBeenCalledWith({
      accessToken: "secret-access-token",
      broadcasterId: "1531201792",
      categoryId: "509658",
      clientId: "client-id",
      durationMinutes: 120,
      startsAt: "2026-09-03T18:00:00.000Z",
      timezone: "UTC",
      title: "Build stream"
    });
    expect(JSON.stringify(await service.deliver(baseInput))).not.toContain("secret-access-token");
  });

  it("updates an existing schedule segment instead of creating a duplicate", async () => {
    const transport = createTransport();
    const service = new TwitchStreamScheduleDeliveryService({ transport });

    await expect(service.deliver({
      ...baseInput,
      currentProviderState: {
        ...baseInput.currentProviderState,
        providerResourceId: "segment-1"
      },
      schedule: {
        ...baseInput.schedule,
        title: "Updated stream"
      }
    })).resolves.toMatchObject({
      ok: true,
      receipt: { providerResourceId: "segment-1" }
    });

    expect(transport.createScheduleSegment).not.toHaveBeenCalled();
    expect(transport.updateScheduleSegment).toHaveBeenCalledWith(expect.objectContaining({
      segmentId: "segment-1",
      title: "Updated stream"
    }));
  });

  it("classifies one-off schedule creation as unsupported when the provider contract cannot represent it", async () => {
    const transport = createTransport();
    const service = new TwitchStreamScheduleDeliveryService({
      supportsOneOffScheduleSegments: false,
      transport
    });

    await expect(service.deliver(baseInput)).resolves.toEqual({
      ok: false,
      outcome: "unsupported",
      reason: "twitch-schedule-segment-unsupported",
      message: "This Twitch provider contract cannot truthfully create a non-recurring schedule segment."
    });

    expect(transport.createScheduleSegment).not.toHaveBeenCalled();
  });

  it("updates channel metadata through the broadcast scope", async () => {
    const transport = createTransport();
    const service = new TwitchStreamScheduleDeliveryService({ transport });

    await expect(service.deliver({
      ...baseInput,
      operation: "channel-metadata"
    })).resolves.toEqual({
      ok: true,
      providerActionId: "twitch-channel-metadata:1531201792",
      receipt: {
        providerCategoryId: "509658",
        providerResourceId: null,
        providerStreamId: null
      }
    });

    expect(transport.updateChannelInformation).toHaveBeenCalledWith({
      accessToken: "secret-access-token",
      broadcasterId: "1531201792",
      categoryId: "509658",
      clientId: "client-id",
      title: "Build stream"
    });
  });

  it("fails closed for missing auth, wrong owner, or missing scopes", async () => {
    const service = new TwitchStreamScheduleDeliveryService({ transport: createTransport() });

    await expect(service.deliver({ ...baseInput, context: null })).resolves.toMatchObject({
      ok: false,
      outcome: "failed",
      reason: "twitch-auth-missing"
    });
    await expect(service.deliver({
      ...baseInput,
      context: { ...context, broadcasterId: "other-channel" }
    })).resolves.toMatchObject({
      ok: false,
      outcome: "failed",
      reason: "twitch-token-owner-mismatch"
    });
    await expect(service.deliver({
      ...baseInput,
      context: { ...context, scopes: [twitchChannelMetadataDeliveryScope] }
    })).resolves.toMatchObject({
      ok: false,
      outcome: "failed",
      reason: "twitch-schedule-scope-missing"
    });
    await expect(service.deliver({
      ...baseInput,
      context: { ...context, scopes: [twitchScheduleDeliveryScope] },
      operation: "channel-metadata"
    })).resolves.toMatchObject({
      ok: false,
      outcome: "failed",
      reason: "twitch-broadcast-scope-missing"
    });
  });

  it("maps rate limits to retryable degraded outcomes", async () => {
    const service = new TwitchStreamScheduleDeliveryService({
      transport: createTransport({
        createScheduleSegment: vi.fn(async () => ({
          ok: false as const,
          retryAfterSeconds: 42,
          status: 429
        }))
      })
    });

    await expect(service.deliver(baseInput)).resolves.toEqual({
      ok: false,
      outcome: "degraded",
      reason: "twitch-provider-rate-limited",
      message: "Twitch asked us to retry this delivery later.",
      retryAfterSeconds: 42
    });
  });

  it("sanitizes provider failures and never returns raw provider payloads", async () => {
    const service = new TwitchStreamScheduleDeliveryService({
      transport: createTransport({
        createScheduleSegment: vi.fn(async () => ({
          ok: false as const,
          retryAfterSeconds: null,
          status: 400
        }))
      })
    });

    const result = await service.deliver(baseInput);

    expect(result).toEqual({
      ok: false,
      outcome: "failed",
      reason: "twitch-provider-rejected",
      message: "Twitch rejected this delivery."
    });
    expect(JSON.stringify(result)).not.toContain("secret-access-token");
    expect(JSON.stringify(result)).not.toContain("Authorization");
  });
});

describe("Twitch stream schedule delivery transport", () => {
  it("constructs Helix schedule and metadata requests inside the integration boundary", async () => {
    const requests: Array<{ body: unknown; headers: Record<string, string>; method: string; url: string }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({
        body: init?.body ? JSON.parse(String(init.body)) as unknown : null,
        headers: init?.headers as Record<string, string>,
        method: init?.method ?? "GET",
        url: String(url)
      });
      return init?.method === "PATCH" && String(url).includes("/channels")
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify({ data: [{ id: "segment-1" }] }), { status: 200 });
    }) as typeof fetch;

    try {
      const transport = createTwitchStreamScheduleDeliveryTransport();
      await transport.createScheduleSegment({
        accessToken: "token",
        broadcasterId: "1531201792",
        categoryId: "509658",
        clientId: "client-id",
        durationMinutes: 120,
        startsAt: "2026-09-03T18:00:00.000Z",
        timezone: "UTC",
        title: "Build stream"
      });
      await transport.updateChannelInformation({
        accessToken: "token",
        broadcasterId: "1531201792",
        categoryId: "509658",
        clientId: "client-id",
        title: "Build stream"
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(requests).toEqual([
      {
        body: {
          category_id: "509658",
          duration: 120,
          is_recurring: false,
          start_time: "2026-09-03T18:00:00.000Z",
          timezone: "UTC",
          title: "Build stream"
        },
        headers: {
          authorization: "Bearer token",
          "client-id": "client-id",
          "content-type": "application/json"
        },
        method: "POST",
        url: "https://api.twitch.tv/helix/schedule/segment?broadcaster_id=1531201792"
      },
      {
        body: {
          game_id: "509658",
          title: "Build stream"
        },
        headers: {
          authorization: "Bearer token",
          "client-id": "client-id",
          "content-type": "application/json"
        },
        method: "PATCH",
        url: "https://api.twitch.tv/helix/channels?broadcaster_id=1531201792"
      }
    ]);
  });
});
