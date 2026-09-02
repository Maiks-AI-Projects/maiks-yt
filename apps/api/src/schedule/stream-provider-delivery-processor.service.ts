import type {
  StreamProviderDeliveryBinding,
  StreamProviderDeliveryOperation
} from "@maiks-yt/domain/schedule";

import type {
  StreamProviderDeliveryProcessorClaim,
  StreamProviderDeliveryProcessorRepository
} from "./stream-provider-delivery-store.service.js";

type StreamProviderDeliveryProvider = StreamProviderDeliveryProcessorClaim["provider"];

export type StreamProviderDeliveryAdapterRequest = {
  idempotencyKey: string;
  operation: StreamProviderDeliveryOperation;
  provider: StreamProviderDeliveryProvider;
  channel: {
    channelRef: string;
    displayName: string;
    handle: string | null;
    providerChannelId: string;
  };
  schedule: {
    channelKey: string;
    description: string | null;
    endsAt: string | null;
    id: string;
    startsAt: string;
    status: StreamProviderDeliveryProcessorClaim["scheduleStatus"];
    title: string;
    visibility: StreamProviderDeliveryProcessorClaim["scheduleVisibility"];
  };
  currentProviderState: {
    providerCategoryId: string | null;
    providerResourceId: string | null;
    providerStreamId: string | null;
  };
};

export type StreamProviderDeliveryReceipt = {
  providerCategoryId?: string | null;
  providerResourceId?: string | null;
  providerStreamId?: string | null;
};

export type StreamProviderDeliveryAdapterResult =
  | {
    ok: true;
    outcome: "syncing";
    providerActionId: string | null;
  }
  | {
    ok: true;
    outcome: "ready";
    providerActionId: string | null;
    receipt: StreamProviderDeliveryReceipt;
  }
  | {
    ok: false;
    outcome: "unsupported" | "degraded" | "failed";
    reason: string;
    message: string;
    retryAfterSeconds?: number | null;
  };

export type StreamProviderDeliveryAdapter = {
  dispatch(input: StreamProviderDeliveryAdapterRequest): Promise<StreamProviderDeliveryAdapterResult>;
};

export type StreamProviderDeliveryProcessorResult = {
  claimed: number;
  degraded: number;
  dispatched: number;
  failed: number;
  ready: number;
  superseded: number;
  unsupported: number;
};

const initialResult = (): StreamProviderDeliveryProcessorResult => ({
  claimed: 0,
  degraded: 0,
  dispatched: 0,
  failed: 0,
  ready: 0,
  superseded: 0,
  unsupported: 0
});

const providerOperations: Record<StreamProviderDeliveryProvider, readonly StreamProviderDeliveryOperation[]> = {
  twitch: ["twitch.schedule-segment", "twitch.channel-metadata"],
  youtube: ["youtube.broadcast", "youtube.stream-binding"]
};

const isProviderOperation = (
  provider: StreamProviderDeliveryProvider,
  operation: StreamProviderDeliveryOperation
): boolean => providerOperations[provider].includes(operation);

const clampRetryAfterSeconds = (value: number | null | undefined): number => {
  if (!Number.isFinite(value) || typeof value !== "number" || value < 1) {
    return 300;
  }

  return Math.min(Math.trunc(value), 86_400);
};

const addSeconds = (date: Date, seconds: number): Date =>
  new Date(date.getTime() + seconds * 1_000);

const safeErrorMessage = (value: string): string =>
  value.replace(/\s+/g, " ").trim().slice(0, 500) || "Provider delivery failed.";

const toAdapterRequest = (
  claim: StreamProviderDeliveryProcessorClaim
): StreamProviderDeliveryAdapterRequest => ({
  idempotencyKey: claim.idempotencyKey,
  operation: claim.operation,
  provider: claim.provider,
  channel: {
    channelRef: claim.channelRef,
    displayName: claim.displayNameSnapshot,
    handle: claim.handleSnapshot,
    providerChannelId: claim.providerChannelIdSnapshot
  },
  schedule: {
    channelKey: claim.scheduleChannelKey,
    description: claim.scheduleDescription,
    endsAt: claim.scheduleEndsAt?.toISOString() ?? null,
    id: claim.scheduleEntryId,
    startsAt: claim.scheduleStartsAt.toISOString(),
    status: claim.scheduleStatus,
    title: claim.scheduleTitle,
    visibility: claim.scheduleVisibility
  },
  currentProviderState: {
    providerCategoryId: claim.providerCategoryId,
    providerResourceId: claim.providerResourceId,
    providerStreamId: claim.providerStreamId
  }
});

export class StreamProviderDeliveryProcessorService {
  public constructor(private readonly input: {
    adapters: Partial<Record<StreamProviderDeliveryProvider, StreamProviderDeliveryAdapter>>;
    repository: StreamProviderDeliveryProcessorRepository;
    workerId: string;
  }) {}

  public async processPending(input: {
    limit?: number;
    now?: Date;
  } = {}): Promise<StreamProviderDeliveryProcessorResult> {
    const now = input.now ?? new Date();
    const claims = await this.input.repository.claimPending({
      limit: input.limit ?? 10,
      now,
      workerId: this.input.workerId
    });
    const result = initialResult();
    result.claimed = claims.length;

    for (const claim of claims) {
      await this.processClaim(claim, now, result);
    }

    return result;
  }

  private async processClaim(
    claim: StreamProviderDeliveryProcessorClaim,
    now: Date,
    result: StreamProviderDeliveryProcessorResult
  ): Promise<void> {
    if (claim.bindingStatus === "removed" || claim.bindingDesiredRevision !== claim.desiredRevision) {
      await this.input.repository.markSuperseded({
        claimedBy: this.input.workerId,
        completedAt: now,
        intentId: claim.id,
        reason: claim.bindingStatus === "removed"
          ? "The delivery binding was removed before this intent was processed."
          : "The delivery binding has a newer desired revision."
      });
      result.superseded += 1;
      return;
    }

    if (!isProviderOperation(claim.provider, claim.operation)) {
      const outcome = await this.recordFailure({
        claim,
        bindingStatus: "failed",
        errorCode: "provider-operation-mismatch",
        errorMessage: `Intent operation ${claim.operation} does not belong to ${claim.provider}.`,
        intentStatus: "failed",
        now
      });
      if (outcome === "superseded") {
        await this.markOutcomeSuperseded(claim, now);
        result.superseded += 1;
        return;
      }
      result.failed += 1;
      return;
    }

    const adapter = this.input.adapters[claim.provider];
    if (!adapter) {
      const outcome = await this.recordFailure({
        claim,
        bindingStatus: "degraded",
        errorCode: "provider-adapter-unavailable",
        errorMessage: `No ${claim.provider} delivery adapter is configured.`,
        intentStatus: "failed",
        now
      });
      if (outcome === "superseded") {
        await this.markOutcomeSuperseded(claim, now);
        result.superseded += 1;
        return;
      }
      result.unsupported += 1;
      return;
    }

    let adapterResult: StreamProviderDeliveryAdapterResult;
    try {
      adapterResult = await adapter.dispatch(toAdapterRequest(claim));
    } catch {
      adapterResult = {
        ok: false,
        outcome: "degraded",
        reason: "provider-dispatch-transient",
        message: "Provider delivery adapter threw before returning a receipt.",
        retryAfterSeconds: 300
      };
    }

    if (adapterResult.ok && adapterResult.outcome === "ready") {
      const outcome = await this.input.repository.recordOutcome({
        bindingId: claim.deliveryBindingId,
        bindingDesiredRevision: claim.desiredRevision,
        bindingStatus: "ready",
        claimedBy: this.input.workerId,
        completedAt: now,
        errorCode: null,
        errorMessage: null,
        intentId: claim.id,
        intentStatus: "succeeded",
        lastAttemptAt: now,
        providerCategoryId: adapterResult.receipt.providerCategoryId ?? null,
        providerResourceId: adapterResult.receipt.providerResourceId ?? null,
        providerStreamId: adapterResult.receipt.providerStreamId ?? null,
        successAt: now
      });
      if (outcome === "superseded") {
        await this.markOutcomeSuperseded(claim, now);
        result.superseded += 1;
        return;
      }
      result.ready += 1;
      return;
    }

    if (adapterResult.ok) {
      const outcome = await this.input.repository.recordOutcome({
        bindingId: claim.deliveryBindingId,
        bindingDesiredRevision: claim.desiredRevision,
        bindingStatus: "syncing",
        claimedBy: this.input.workerId,
        completedAt: now,
        errorCode: null,
        errorMessage: null,
        intentId: claim.id,
        intentStatus: "succeeded",
        lastAttemptAt: now
      });
      if (outcome === "superseded") {
        await this.markOutcomeSuperseded(claim, now);
        result.superseded += 1;
        return;
      }
      result.dispatched += 1;
      return;
    }

    if (adapterResult.outcome === "unsupported") {
      const outcome = await this.recordFailure({
        claim,
        bindingStatus: "degraded",
        errorCode: adapterResult.reason,
        errorMessage: adapterResult.message,
        intentStatus: "failed",
        now
      });
      if (outcome === "superseded") {
        await this.markOutcomeSuperseded(claim, now);
        result.superseded += 1;
        return;
      }
      result.unsupported += 1;
      return;
    }

    if (adapterResult.outcome === "degraded") {
      const outcome = await this.input.repository.recordOutcome({
        bindingId: claim.deliveryBindingId,
        bindingDesiredRevision: claim.desiredRevision,
        bindingStatus: "degraded",
        claimedBy: this.input.workerId,
        completedAt: null,
        errorCode: adapterResult.reason,
        errorMessage: safeErrorMessage(adapterResult.message),
        intentId: claim.id,
        intentStatus: "retry-wait",
        lastAttemptAt: now,
        nextAvailableAt: addSeconds(now, clampRetryAfterSeconds(adapterResult.retryAfterSeconds))
      });
      if (outcome === "superseded") {
        await this.markOutcomeSuperseded(claim, now);
        result.superseded += 1;
        return;
      }
      result.degraded += 1;
      return;
    }

    const outcome = await this.recordFailure({
      claim,
      bindingStatus: "failed",
      errorCode: adapterResult.reason,
      errorMessage: adapterResult.message,
      intentStatus: "failed",
      now
    });
    if (outcome === "superseded") {
      await this.markOutcomeSuperseded(claim, now);
      result.superseded += 1;
      return;
    }
    result.failed += 1;
  }

  private async markOutcomeSuperseded(
    claim: StreamProviderDeliveryProcessorClaim,
    now: Date
  ): Promise<void> {
    await this.input.repository.markSuperseded({
      claimedBy: this.input.workerId,
      completedAt: now,
      intentId: claim.id,
      reason: "The provider delivery outcome lost the revision or processing ownership race before it could be recorded."
    });
  }

  private async recordFailure(input: {
    claim: StreamProviderDeliveryProcessorClaim;
    bindingStatus: Exclude<StreamProviderDeliveryBinding["status"], "pending" | "ready" | "syncing" | "removed">;
    errorCode: string;
    errorMessage: string;
    intentStatus: "failed";
    now: Date;
  }): Promise<"applied" | "superseded"> {
    return await this.input.repository.recordOutcome({
      bindingId: input.claim.deliveryBindingId,
      bindingDesiredRevision: input.claim.desiredRevision,
      bindingStatus: input.bindingStatus,
      claimedBy: this.input.workerId,
      completedAt: input.now,
      errorCode: input.errorCode,
      errorMessage: safeErrorMessage(input.errorMessage),
      intentId: input.claim.id,
      intentStatus: input.intentStatus,
      lastAttemptAt: input.now
    });
  }
}
