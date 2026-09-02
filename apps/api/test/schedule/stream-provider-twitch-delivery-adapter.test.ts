import { describe, expect, it, vi } from "vitest";

import {
  StreamProviderTwitchDeliveryAdapter,
  createTwitchDeliveryContextRepository,
  createUnavailableYouTubeDeliveryAdapter
} from "../../src/schedule/stream-provider-twitch-delivery-adapter.service.js";
import type { StreamProviderDeliveryAdapterRequest } from "../../src/schedule/stream-provider-delivery-processor.service.js";

const request: StreamProviderDeliveryAdapterRequest = {
  idempotencyKey: "stream-provider-delivery:schedule-1:channel-1:twitch.schedule-segment:2",
  operation: "twitch.schedule-segment",
  provider: "twitch",
  channel: {
    channelRef: "channel-1",
    displayName: "MaiksPlays",
    handle: "maiksplays",
    providerChannelId: "1531201792"
  },
  schedule: {
    channelKey: "coding",
    description: "Code with Michael",
    endsAt: "2026-09-03T20:00:00.000Z",
    id: "schedule-1",
    startsAt: "2026-09-03T18:00:00.000Z",
    status: "planned",
    title: "Build stream",
    visibility: "public"
  },
  currentProviderState: {
    providerCategoryId: "509658",
    providerResourceId: null,
    providerStreamId: null
  }
};

describe("stream provider Twitch delivery adapter", () => {
  it("maps a confirmed Twitch receipt to ready without leaking credentials", async () => {
    const adapter = new StreamProviderTwitchDeliveryAdapter({
      contextRepository: {
        resolveTwitchDeliveryContext: vi.fn(async () => ({
          accessToken: "secret-access-token",
          broadcasterId: "1531201792",
          clientId: "client-id",
          scopes: ["channel:manage:schedule", "channel:manage:broadcast"]
        }))
      },
      deliveryService: {
        deliver: vi.fn(async () => ({
          ok: true,
          providerActionId: "twitch-schedule-segment:segment-1",
          receipt: {
            providerCategoryId: "509658",
            providerResourceId: "segment-1",
            providerStreamId: null
          }
        }))
      }
    });

    const result = await adapter.dispatch(request);

    expect(result).toEqual({
      ok: true,
      outcome: "ready",
      providerActionId: "twitch-schedule-segment:segment-1",
      receipt: {
        providerCategoryId: "509658",
        providerResourceId: "segment-1",
        providerStreamId: null
      }
    });
    expect(JSON.stringify(result)).not.toContain("secret-access-token");
  });

  it("resolves Twitch credentials through the existing runtime credential store", async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const pool = {
      execute: vi.fn(async (sql: string, values: unknown[] = []) => {
        calls.push({ sql, values });
        return [[{
          accessToken: "stored-access-token",
          providerAccountId: "1531201792",
          scopes: JSON.stringify(["channel:manage:schedule"])
        }], []];
      })
    };

    await expect(createTwitchDeliveryContextRepository(pool, {
      cipher: null,
      env: { TWITCH_CLIENT_ID: "client-id" }
    }).resolveTwitchDeliveryContext("1531201792")).resolves.toEqual({
      accessToken: "stored-access-token",
      broadcasterId: "1531201792",
      clientId: "client-id",
      scopes: ["channel:manage:schedule"]
    });

    expect(calls[0]?.sql).toContain("provider_runtime_credentials");
    expect(calls[0]?.sql).toContain("credentials.provider = 'twitch'");
    expect(calls[0]?.sql).toContain("credentials.purpose = 'twitch_eventsub'");
    expect(calls[0]?.values).toEqual(["1531201792"]);
  });

  it("keeps YouTube delivery unavailable and degraded until its adapter exists", async () => {
    await expect(createUnavailableYouTubeDeliveryAdapter().dispatch({
      ...request,
      operation: "youtube.broadcast",
      provider: "youtube"
    })).resolves.toEqual({
      ok: false,
      outcome: "degraded",
      reason: "provider-adapter-unavailable",
      message: "No YouTube provider delivery adapter is configured for schedule delivery yet.",
      retryAfterSeconds: 86_400
    });
  });
});
