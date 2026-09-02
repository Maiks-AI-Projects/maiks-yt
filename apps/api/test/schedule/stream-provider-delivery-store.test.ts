import { describe, expect, it, vi } from "vitest";

import { enqueueStreamProviderDeliveries } from "../../src/schedule/stream-provider-delivery-store.service.js";

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
});
