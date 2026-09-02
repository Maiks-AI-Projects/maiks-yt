import { describe, expect, it, vi } from "vitest";

import {
  createStreamProviderDeliveryProcessorRepository,
  enqueueStreamProviderDeliveries
} from "../../src/schedule/stream-provider-delivery-store.service.js";

describe("stream provider delivery store", () => {
  it("creates one binding and the planning intent for each new channel", async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const executor = {
      execute: vi.fn(async (sql: string, values: unknown[] = []) => {
        calls.push({ sql, values });
        return calls.length === 1 ? [[], []] : [{ affectedRows: 1 }, []];
      })
    };

    await expect(enqueueStreamProviderDeliveries({
      executor,
      scheduleEntryId: "schedule-1",
      visibility: "public",
      status: "planned",
      channelTargets: [{
        channelRef: "channel-1",
        provider: "youtube",
        providerChannelId: "youtube-1",
        displayName: "MaiksPlays",
        handle: "@MaiksPlays"
      }]
    })).resolves.toEqual({ bindingCount: 1, intentCount: 1 });

    expect(calls).toHaveLength(3);
    expect(calls[0]?.sql).toContain("FOR UPDATE");
    expect(calls[1]?.sql).toContain("INSERT INTO stream_provider_delivery_bindings");
    expect(calls[2]?.values).toEqual(expect.arrayContaining([
      "youtube.broadcast",
      "stream-provider-delivery:schedule-1:channel-1:youtube.broadcast:1"
    ]));
  });

  it("increments an existing binding revision and removes omitted bindings without deletion intents", async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const executor = {
      execute: vi.fn(async (sql: string, values: unknown[] = []) => {
        calls.push({ sql, values });
        if (calls.length === 1) {
          return [[
            {
              id: "binding-current",
              channelRef: "channel-current",
              provider: "twitch",
              desiredRevision: 4,
              providerResourceId: "segment-1",
              providerStreamId: null
            },
            {
              id: "binding-removed",
              channelRef: "channel-removed",
              provider: "youtube",
              desiredRevision: 2,
              providerResourceId: "broadcast-1",
              providerStreamId: "stream-1"
            }
          ], []];
        }
        return [{ affectedRows: 1 }, []];
      })
    };

    await expect(enqueueStreamProviderDeliveries({
      executor,
      scheduleEntryId: "schedule-1",
      visibility: "public",
      status: "planned",
      channelTargets: [{
        channelRef: "channel-current",
        provider: "twitch",
        providerChannelId: "1531201792",
        displayName: "MaiksPlays",
        handle: "maiksplays"
      }]
    })).resolves.toEqual({ bindingCount: 1, intentCount: 1 });

    expect(calls).toHaveLength(4);
    expect(calls[1]?.sql).toContain("status = 'removed'");
    expect(calls[1]?.values).toEqual([
      "provider-removal-confirmation-required",
      "The local channel target was removed, but the provider event still needs explicit deletion confirmation.",
      "binding-removed"
    ]);
    expect(calls[2]?.sql).toContain("desired_revision = ?");
    expect(calls[2]?.values).toEqual(expect.arrayContaining([5, "binding-current"]));
    expect(calls[3]?.values).toEqual(expect.arrayContaining([
      "twitch.schedule-segment",
      "stream-provider-delivery:schedule-1:channel-current:twitch.schedule-segment:5"
    ]));
    expect(calls.some((call) => call.sql.includes("DELETE FROM stream_provider"))).toBe(false);
  });

  it("creates the durable binding but no provider intent for an unfinished draft", async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const executor = {
      execute: vi.fn(async (sql: string, values: unknown[] = []) => {
        calls.push({ sql, values });
        return calls.length === 1 ? [[], []] : [{ affectedRows: 1 }, []];
      })
    };

    await expect(enqueueStreamProviderDeliveries({
      executor,
      scheduleEntryId: "schedule-draft",
      visibility: "draft",
      status: "planned",
      channelTargets: [{
        channelRef: "channel-1",
        provider: "twitch",
        providerChannelId: "1531201792",
        displayName: "MaiksPlays",
        handle: "maiksplays"
      }]
    })).resolves.toEqual({ bindingCount: 1, intentCount: 0 });

    expect(calls).toHaveLength(2);
    expect(calls[1]?.sql).toContain("INSERT INTO stream_provider_delivery_bindings");
  });

  it("keeps an existing provider event visible as degraded when publication is withdrawn", async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const executor = {
      execute: vi.fn(async (sql: string, values: unknown[] = []) => {
        calls.push({ sql, values });
        if (calls.length === 1) {
          return [[{
            id: "binding-1",
            channelRef: "channel-1",
            provider: "youtube",
            desiredRevision: 5,
            providerResourceId: "broadcast-1",
            providerStreamId: "stream-1"
          }], []];
        }
        return [{ affectedRows: 1 }, []];
      })
    };

    await expect(enqueueStreamProviderDeliveries({
      executor,
      scheduleEntryId: "schedule-1",
      visibility: "draft",
      status: "planned",
      channelTargets: [{
        channelRef: "channel-1",
        provider: "youtube",
        providerChannelId: "youtube-1",
        displayName: "MaiksPlays",
        handle: "@MaiksPlays"
      }]
    })).resolves.toEqual({ bindingCount: 1, intentCount: 0 });

    expect(calls).toHaveLength(3);
    expect(calls[2]?.sql).toContain("status = 'degraded'");
    expect(calls[2]?.values).toEqual(["binding-1"]);
  });

  it("claims pending processor intents with a compare-and-claim update", async () => {
    const now = new Date("2026-09-02T10:00:00.000Z");
    const pendingRows = [
      {
        id: "intent-1",
        deliveryBindingId: "binding-1",
        scheduleEntryId: "schedule-1",
        channelRef: "channel-1",
        operation: "twitch.schedule-segment",
        desiredRevision: 1,
        idempotencyKey: "stream-provider-delivery:schedule-1:channel-1:twitch.schedule-segment:1",
        attemptCount: 0,
        provider: "twitch",
        bindingDesiredRevision: 1,
        bindingStatus: "pending",
        providerChannelIdSnapshot: "1531201792",
        displayNameSnapshot: "MaiksPlays",
        handleSnapshot: "maiksplays",
        providerResourceId: null,
        providerStreamId: null,
        providerCategoryId: "509658",
        scheduleTitle: "Build stream",
        scheduleDescription: null,
        scheduleStartsAt: new Date("2026-09-03T18:00:00.000Z"),
        scheduleEndsAt: null,
        scheduleVisibility: "public",
        scheduleStatus: "planned",
        scheduleChannelKey: "coding"
      },
      {
        id: "intent-raced",
        deliveryBindingId: "binding-2",
        scheduleEntryId: "schedule-1",
        channelRef: "channel-2",
        operation: "twitch.schedule-segment",
        desiredRevision: 1,
        idempotencyKey: "stream-provider-delivery:schedule-1:channel-2:twitch.schedule-segment:1",
        attemptCount: 0,
        provider: "twitch",
        bindingDesiredRevision: 1,
        bindingStatus: "pending",
        providerChannelIdSnapshot: "1531201792",
        displayNameSnapshot: "MaiksPlays",
        handleSnapshot: "maiksplays",
        providerResourceId: null,
        providerStreamId: null,
        providerCategoryId: "509658",
        scheduleTitle: "Build stream",
        scheduleDescription: null,
        scheduleStartsAt: new Date("2026-09-03T18:00:00.000Z"),
        scheduleEndsAt: null,
        scheduleVisibility: "public",
        scheduleStatus: "planned",
        scheduleChannelKey: "coding"
      }
    ];
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const executor = {
      execute: vi.fn(async (sql: string, values: unknown[] = []) => {
        calls.push({ sql, values });
        if (calls.length === 1) return [pendingRows, []];
        if (calls.length === 2) return [{ affectedRows: 1 }, []];
        return [{ affectedRows: 0 }, []];
      })
    };

    await expect(createStreamProviderDeliveryProcessorRepository(executor)
      .claimPending({ limit: 100, now, workerId: "worker-1" }))
      .resolves.toEqual([pendingRows[0]]);

    expect(calls).toHaveLength(3);
    expect(calls[0]?.sql).toContain("LIMIT 25");
    expect(calls[0]?.sql).toContain("status IN ('pending', 'retry-wait')");
    expect(calls[1]?.sql).toContain("SET status = 'processing'");
    expect(calls[1]?.sql).toContain("WHERE id = ?");
    expect(calls[1]?.values).toEqual([now, "worker-1", "intent-1", now]);
    expect(calls[2]?.values).toEqual([now, "worker-1", "intent-raced", now]);
  });

  it("records processor outcomes with revision and claimed-owner guards in one atomic update", async () => {
    const now = new Date("2026-09-02T10:00:00.000Z");
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const executor = {
      execute: vi.fn(async (sql: string, values: unknown[] = []) => {
        calls.push({ sql, values });
        return [{ affectedRows: 2 }, []];
      })
    };

    await expect(createStreamProviderDeliveryProcessorRepository(executor).recordOutcome({
      bindingId: "binding-1",
      bindingDesiredRevision: 7,
      bindingStatus: "syncing",
      claimedBy: "worker-1",
      completedAt: now,
      errorCode: null,
      errorMessage: null,
      intentId: "intent-1",
      intentStatus: "succeeded",
      lastAttemptAt: now
    })).resolves.toBe("applied");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain("UPDATE stream_provider_delivery_intents");
    expect(calls[0]?.sql).toContain("INNER JOIN stream_provider_delivery_bindings");
    expect(calls[0]?.sql).toContain("stream_provider_delivery_bindings.status = ?");
    expect(calls[0]?.sql).toContain("stream_provider_delivery_intents.status = ?");
    expect(calls[0]?.sql).toContain("stream_provider_delivery_intents.status = 'processing'");
    expect(calls[0]?.sql).toContain("stream_provider_delivery_intents.claimed_by = ?");
    expect(calls[0]?.sql).toContain("stream_provider_delivery_bindings.desired_revision = ?");
    expect(calls[0]?.values).toEqual([
      "syncing",
      now,
      null,
      null,
      "succeeded",
      now,
      null,
      null,
      null,
      "intent-1",
      "binding-1",
      7,
      "worker-1",
      "binding-1",
      7
    ]);
  });

  it("reports a stale claimed revision as superseded without a binding overwrite", async () => {
    const now = new Date("2026-09-02T10:00:00.000Z");
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const executor = {
      execute: vi.fn(async (sql: string, values: unknown[] = []) => {
        calls.push({ sql, values });
        return [{ affectedRows: 0 }, []];
      })
    };

    await expect(createStreamProviderDeliveryProcessorRepository(executor).recordOutcome({
      bindingId: "binding-1",
      bindingDesiredRevision: 7,
      bindingStatus: "degraded",
      claimedBy: "worker-1",
      completedAt: null,
      errorCode: "provider-rate-limited",
      errorMessage: "Rate limited by provider",
      intentId: "intent-1",
      intentStatus: "retry-wait",
      lastAttemptAt: now,
      nextAvailableAt: new Date("2026-09-02T10:05:00.000Z")
    })).resolves.toBe("superseded");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain("stream_provider_delivery_bindings.desired_revision = ?");
    expect(calls[0]?.sql).toContain("stream_provider_delivery_intents.status = 'processing'");
    expect(calls[0]?.sql).toContain("stream_provider_delivery_intents.claimed_by = ?");
  });
});
