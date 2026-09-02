import { describe, expect, it, vi } from "vitest";

import {
  StreamProviderDeliveryProcessorService,
  type StreamProviderDeliveryAdapter,
  type StreamProviderDeliveryAdapterRequest
} from "../../src/schedule/stream-provider-delivery-processor.service.js";
import type {
  StreamProviderDeliveryProcessorClaim,
  StreamProviderDeliveryProcessorRepository
} from "../../src/schedule/stream-provider-delivery-store.service.js";

const now = new Date("2026-09-02T10:00:00.000Z");

class FakeStreamProviderDeliveryProcessorRepository
implements StreamProviderDeliveryProcessorRepository {
  public claims: StreamProviderDeliveryProcessorClaim[];
  public readonly claimCalls: Array<{ limit: number; now: Date; workerId: string }> = [];
  public readonly outcomes: Array<Parameters<StreamProviderDeliveryProcessorRepository["recordOutcome"]>[0]> = [];
  public readonly superseded: Array<Parameters<StreamProviderDeliveryProcessorRepository["markSuperseded"]>[0]> = [];
  public supersedeOutcomes = false;

  public constructor(claims: StreamProviderDeliveryProcessorClaim[]) {
    this.claims = claims;
  }

  public async claimPending(input: {
    limit: number;
    now: Date;
    workerId: string;
  }): Promise<readonly StreamProviderDeliveryProcessorClaim[]> {
    this.claimCalls.push(input);
    const claims = this.claims;
    this.claims = [];
    return claims;
  }

  public async markSuperseded(
    input: Parameters<StreamProviderDeliveryProcessorRepository["markSuperseded"]>[0]
  ): Promise<boolean> {
    this.superseded.push(input);
    return true;
  }

  public async recordOutcome(
    input: Parameters<StreamProviderDeliveryProcessorRepository["recordOutcome"]>[0]
  ): Promise<"applied" | "superseded"> {
    this.outcomes.push(input);
    return this.supersedeOutcomes ? "superseded" : "applied";
  }
}

const buildClaim = (
  override: Partial<StreamProviderDeliveryProcessorClaim> = {}
): StreamProviderDeliveryProcessorClaim => ({
  id: "intent-1",
  deliveryBindingId: "binding-1",
  scheduleEntryId: "schedule-1",
  channelRef: "channel-1",
  provider: "twitch",
  operation: "twitch.schedule-segment",
  desiredRevision: 2,
  idempotencyKey: "stream-provider-delivery:schedule-1:channel-1:twitch.schedule-segment:2",
  attemptCount: 0,
  bindingDesiredRevision: 2,
  bindingStatus: "pending",
  providerChannelIdSnapshot: "1531201792",
  displayNameSnapshot: "MaiksPlays",
  handleSnapshot: "maiksplays",
  providerResourceId: null,
  providerStreamId: null,
  providerCategoryId: "509658",
  scheduleTitle: "Build stream",
  scheduleDescription: "Code with Michael",
  scheduleStartsAt: new Date("2026-09-03T18:00:00.000Z"),
  scheduleEndsAt: new Date("2026-09-03T20:00:00.000Z"),
  scheduleVisibility: "public",
  scheduleStatus: "planned",
  scheduleChannelKey: "coding",
  ...override
});

const createProcessor = (input: {
  claims?: StreamProviderDeliveryProcessorClaim[];
  twitch?: StreamProviderDeliveryAdapter;
  youtube?: StreamProviderDeliveryAdapter;
}) => {
  const repository = new FakeStreamProviderDeliveryProcessorRepository(input.claims ?? [buildClaim()]);
  const service = new StreamProviderDeliveryProcessorService({
    adapters: {
      twitch: input.twitch,
      youtube: input.youtube
    },
    repository,
    workerId: "provider-worker-test"
  });

  return { repository, service };
};

describe("stream provider delivery processor", () => {
  it("claims pending Twitch schedule intents and dispatches the adapter contract without ready", async () => {
    const calls: StreamProviderDeliveryAdapterRequest[] = [];
    const twitch: StreamProviderDeliveryAdapter = {
      dispatch: vi.fn(async (request) => {
        calls.push(request);
        return { ok: true, outcome: "syncing", providerActionId: "segment-request-1" };
      })
    };
    const { repository, service } = createProcessor({ twitch });

    await expect(service.processPending({ limit: 5, now })).resolves.toEqual({
      claimed: 1,
      degraded: 0,
      dispatched: 1,
      failed: 0,
      ready: 0,
      superseded: 0,
      unsupported: 0
    });

    expect(repository.claimCalls).toEqual([{ limit: 5, now, workerId: "provider-worker-test" }]);
    expect(calls).toEqual([{
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
    }]);
    expect(repository.outcomes).toEqual([expect.objectContaining({
      bindingId: "binding-1",
      bindingDesiredRevision: 2,
      bindingStatus: "syncing",
      claimedBy: "provider-worker-test",
      completedAt: now,
      errorCode: null,
      errorMessage: null,
      intentId: "intent-1",
      intentStatus: "succeeded",
      lastAttemptAt: now
    })]);
  });

  it("records an unsupported Twitch capability as degraded/failed truthfully", async () => {
    const { repository, service } = createProcessor({
      twitch: {
        dispatch: vi.fn(async () => ({
          ok: false,
          outcome: "unsupported",
          reason: "twitch-schedule-segment-unsupported",
          message: "Twitch schedule segment delivery is not available for this provider contract."
        }))
      }
    });

    await expect(service.processPending({ now })).resolves.toEqual({
      claimed: 1,
      degraded: 0,
      dispatched: 0,
      failed: 0,
      ready: 0,
      superseded: 0,
      unsupported: 1
    });

    expect(repository.outcomes).toEqual([expect.objectContaining({
      bindingStatus: "degraded",
      errorCode: "twitch-schedule-segment-unsupported",
      intentStatus: "failed"
    })]);
  });

  it("records degraded transient provider outcomes for retry without marking ready", async () => {
    const { repository, service } = createProcessor({
      twitch: {
        dispatch: vi.fn(async () => ({
          ok: false,
          outcome: "degraded",
          reason: "provider-rate-limited",
          message: "Rate limited by provider",
          retryAfterSeconds: 120
        }))
      }
    });

    await expect(service.processPending({ now })).resolves.toEqual({
      claimed: 1,
      degraded: 1,
      dispatched: 0,
      failed: 0,
      ready: 0,
      superseded: 0,
      unsupported: 0
    });

    expect(repository.outcomes).toEqual([expect.objectContaining({
      bindingStatus: "degraded",
      completedAt: null,
      errorCode: "provider-rate-limited",
      intentStatus: "retry-wait",
      nextAvailableAt: new Date("2026-09-02T10:02:00.000Z")
    })]);
  });

  it("records terminal provider failure without retrying or marking ready", async () => {
    const { repository, service } = createProcessor({
      twitch: {
        dispatch: vi.fn(async () => ({
          ok: false,
          outcome: "failed",
          reason: "provider-validation-failed",
          message: "Provider rejected the schedule payload"
        }))
      }
    });

    await expect(service.processPending({ now })).resolves.toEqual({
      claimed: 1,
      degraded: 0,
      dispatched: 0,
      failed: 1,
      ready: 0,
      superseded: 0,
      unsupported: 0
    });

    expect(repository.outcomes).toEqual([expect.objectContaining({
      bindingStatus: "failed",
      errorCode: "provider-validation-failed",
      intentStatus: "failed"
    })]);
  });

  it("does not dispatch duplicate provider actions when replay claims nothing new", async () => {
    const twitch: StreamProviderDeliveryAdapter = {
      dispatch: vi.fn(async () => ({ ok: true, outcome: "syncing", providerActionId: "segment-request-1" }))
    };
    const { service } = createProcessor({ twitch });

    await expect(service.processPending({ now })).resolves.toMatchObject({
      claimed: 1,
      dispatched: 1,
      ready: 0
    });
    await expect(service.processPending({ now })).resolves.toEqual({
      claimed: 0,
      degraded: 0,
      dispatched: 0,
      failed: 0,
      ready: 0,
      superseded: 0,
      unsupported: 0
    });

    expect(twitch.dispatch).toHaveBeenCalledTimes(1);
  });

  it("marks ready only after the repository persists a provider-confirmed receipt", async () => {
    const twitch: StreamProviderDeliveryAdapter = {
      dispatch: vi.fn(async () => ({
        ok: true,
        outcome: "ready",
        providerActionId: "twitch-schedule-segment:segment-1",
        receipt: {
          providerCategoryId: "509658",
          providerResourceId: "segment-1",
          providerStreamId: null
        }
      }))
    };
    const { repository, service } = createProcessor({ twitch });

    await expect(service.processPending({ now })).resolves.toEqual({
      claimed: 1,
      degraded: 0,
      dispatched: 0,
      failed: 0,
      ready: 1,
      superseded: 0,
      unsupported: 0
    });

    expect(repository.outcomes).toEqual([expect.objectContaining({
      bindingStatus: "ready",
      intentStatus: "succeeded",
      providerCategoryId: "509658",
      providerResourceId: "segment-1",
      providerStreamId: null,
      successAt: now
    })]);
  });

  it("classifies a stale adapter completion as superseded without arming an outcome", async () => {
    const twitch: StreamProviderDeliveryAdapter = {
      dispatch: vi.fn(async () => ({ ok: true, outcome: "syncing", providerActionId: "segment-request-1" }))
    };
    const { repository, service } = createProcessor({ twitch });
    repository.supersedeOutcomes = true;

    await expect(service.processPending({ now })).resolves.toEqual({
      claimed: 1,
      degraded: 0,
      dispatched: 0,
      failed: 0,
      ready: 0,
      superseded: 1,
      unsupported: 0
    });

    expect(twitch.dispatch).toHaveBeenCalledTimes(1);
    expect(repository.outcomes).toEqual([expect.objectContaining({
      bindingDesiredRevision: 2,
      bindingStatus: "syncing",
      claimedBy: "provider-worker-test",
      intentStatus: "succeeded"
    })]);
    expect(repository.superseded).toEqual([expect.objectContaining({
      claimedBy: "provider-worker-test",
      intentId: "intent-1"
    })]);
  });

  it("does not mark ready when a receipt outcome loses the revision guard", async () => {
    const twitch: StreamProviderDeliveryAdapter = {
      dispatch: vi.fn(async () => ({
        ok: true,
        outcome: "ready",
        providerActionId: "twitch-schedule-segment:segment-1",
        receipt: {
          providerCategoryId: "509658",
          providerResourceId: "segment-1",
          providerStreamId: null
        }
      }))
    };
    const { repository, service } = createProcessor({ twitch });
    repository.supersedeOutcomes = true;

    await expect(service.processPending({ now })).resolves.toEqual({
      claimed: 1,
      degraded: 0,
      dispatched: 0,
      failed: 0,
      ready: 0,
      superseded: 1,
      unsupported: 0
    });

    expect(repository.outcomes).toEqual([expect.objectContaining({
      bindingStatus: "ready",
      providerResourceId: "segment-1",
      successAt: now
    })]);
    expect(repository.superseded).toEqual([expect.objectContaining({
      claimedBy: "provider-worker-test",
      intentId: "intent-1"
    })]);
  });

  it("preserves YouTube operations by dispatching through the YouTube adapter only", async () => {
    const youtubeClaim = buildClaim({
      provider: "youtube",
      operation: "youtube.broadcast",
      idempotencyKey: "stream-provider-delivery:schedule-1:channel-1:youtube.broadcast:2",
      providerChannelIdSnapshot: "youtube-channel-1",
      handleSnapshot: "@MaiksPlays"
    });
    const twitch: StreamProviderDeliveryAdapter = {
      dispatch: vi.fn(async () => ({ ok: true, outcome: "syncing", providerActionId: "bad-provider" }))
    };
    const youtube: StreamProviderDeliveryAdapter = {
      dispatch: vi.fn(async () => ({ ok: true, outcome: "syncing", providerActionId: "broadcast-request-1" }))
    };
    const { repository, service } = createProcessor({
      claims: [youtubeClaim],
      twitch,
      youtube
    });

    await expect(service.processPending({ now })).resolves.toMatchObject({
      claimed: 1,
      dispatched: 1,
      ready: 0
    });

    expect(twitch.dispatch).not.toHaveBeenCalled();
    expect(youtube.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      operation: "youtube.broadcast",
      provider: "youtube"
    }));
    expect(repository.outcomes).toEqual([expect.objectContaining({
      bindingStatus: "syncing",
      intentStatus: "succeeded"
    })]);
  });

  it("supersedes stale or removed intents without invoking a provider", async () => {
    const twitch: StreamProviderDeliveryAdapter = {
      dispatch: vi.fn(async () => ({ ok: true, outcome: "syncing", providerActionId: "unexpected" }))
    };
    const { repository, service } = createProcessor({
      claims: [
        buildClaim({ id: "intent-stale", bindingDesiredRevision: 3 }),
        buildClaim({ id: "intent-removed", bindingStatus: "removed" })
      ],
      twitch
    });

    await expect(service.processPending({ now })).resolves.toEqual({
      claimed: 2,
      degraded: 0,
      dispatched: 0,
      failed: 0,
      ready: 0,
      superseded: 2,
      unsupported: 0
    });

    expect(twitch.dispatch).not.toHaveBeenCalled();
    expect(repository.superseded).toEqual([
      expect.objectContaining({ intentId: "intent-stale" }),
      expect.objectContaining({ intentId: "intent-removed" })
    ]);
  });

  it("fails provider/operation mismatches before adapter dispatch", async () => {
    const twitch: StreamProviderDeliveryAdapter = {
      dispatch: vi.fn(async () => ({ ok: true, outcome: "syncing", providerActionId: "unexpected" }))
    };
    const { repository, service } = createProcessor({
      claims: [buildClaim({ operation: "youtube.broadcast" })],
      twitch
    });

    await expect(service.processPending({ now })).resolves.toMatchObject({
      failed: 1,
      ready: 0
    });

    expect(twitch.dispatch).not.toHaveBeenCalled();
    expect(repository.outcomes).toEqual([expect.objectContaining({
      bindingStatus: "failed",
      errorCode: "provider-operation-mismatch",
      intentStatus: "failed"
    })]);
  });
});
