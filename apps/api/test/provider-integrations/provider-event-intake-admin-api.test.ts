import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import type { DatabasePool } from "@maiks-yt/database";

import { registerProviderEventIntakeAdminRoutes } from "../../src/provider-integrations/provider-event-intake-admin.route.js";
import { ProviderEventIntakeAdminService } from "../../src/provider-integrations/provider-event-intake-admin.service.js";
import { createProviderEventIntakeAdminRepository } from "../../src/provider-integrations/provider-event-intake-admin-store.service.js";
import type {
  NormalizedProviderEventIntakeAdminFilters,
  ProviderEventIntakeAdminActor,
  ProviderEventIntakeAdminRepository,
  ProviderEventIntakeAdminResult,
  ProviderEventIntakeHealthResult,
  ProviderEventIntakeReviewCandidate,
  ProviderEventIntakeReviewHistory,
  ProviderEventIntakeReviewResult
} from "../../src/provider-integrations/provider-event-intake-admin.types.js";

class FakeProviderEventIntakeRepository implements ProviderEventIntakeAdminRepository {
  public actors = new Map<string, ProviderEventIntakeAdminActor>();
  public actor: ProviderEventIntakeAdminActor | null = {
    domainUserId: "owner-user",
    rolePermissionValues: [["*"]]
  };
  public candidate: ProviderEventIntakeReviewCandidate | null = {
    actorDisplayName: "Viewer",
    actorExternalId: "viewer-1",
    authOrTokenShaped: false,
    catalogKnown: true,
    category: "community",
    eventHistoryId: null,
    highVolume: false,
    id: "intake-1",
    internalTrigger: "provider.twitch.eventsub.channel-follow",
    mechanism: "twitch-eventsub",
    moderationShaped: false,
    moneyShaped: false,
    occurredAt: "2026-07-04T16:00:00.000Z",
    overlayEligibleByDefault: false,
    processingStatus: "stored",
    provider: "twitch",
    providerChannelId: "raw-channel-secret",
    providerEventName: "channel.follow",
    providerMessageId: null,
    receivedAt: "2026-07-04T16:00:01.000Z",
    redactedPayloadPreview: {
      userName: "Viewer"
    },
    sourceEventId: "raw-follow-source-secret"
  };
  public lastCandidateId: string | null = null;
  public lastFilters: NormalizedProviderEventIntakeAdminFilters | null = null;
  public lastIgnoredId: string | null = null;
  public markIgnoredCalls = 0;
  public mapFailuresRemaining = 0;
  public mapToEventHistoryCalls = 0;
  public mappedEventKind: string | null = null;

  public async resolveActor(): Promise<ProviderEventIntakeAdminActor | null> {
    return this.actor;
  }

  public async findReviewCandidate(id: string): Promise<ProviderEventIntakeReviewCandidate | null> {
    this.lastCandidateId = id;
    return this.candidate && this.candidate.id === id ? this.candidate : null;
  }

  public async markIgnored(input: { id: string }): Promise<boolean> {
    this.markIgnoredCalls += 1;
    this.lastIgnoredId = input.id;
    return true;
  }

  public async mapToEventHistory(input: {
    eventKind: ProviderEventIntakeReviewHistory["eventKind"];
  }): Promise<ProviderEventIntakeReviewHistory | null> {
    this.mapToEventHistoryCalls += 1;
    if (this.mapFailuresRemaining > 0) {
      this.mapFailuresRemaining -= 1;
      return null;
    }

    this.mappedEventKind = input.eventKind;
    if (this.candidate) {
      this.candidate = {
        ...this.candidate,
        eventHistoryId: "history-1",
        processingStatus: "mapped_to_event_history"
      };
    }
    return {
      createdAt: "2026-07-04T16:00:02.000Z",
      destination: "internal_audit",
      eventKind: input.eventKind,
      id: "history-1",
      publicPlayback: false,
      routingOutcome: "stored_internal",
      sourcePlatform: "twitch"
    };
  }

  public async listHealthRows() {
    return [{
      lastProviderEventName: "PRIVMSG",
      lastReceivedAt: "2026-07-04T16:00:01.000Z",
      mechanism: "twitch-irc" as const,
      provider: "twitch" as const,
      rowCount: 4
    }, {
      lastProviderEventName: "upload",
      lastReceivedAt: "2026-06-20T16:00:01.000Z",
      mechanism: "youtube-activity" as const,
      provider: "youtube" as const,
      rowCount: 1
    }];
  }

  public async listRecent(filters: NormalizedProviderEventIntakeAdminFilters) {
    this.lastFilters = filters;
    return [{
      actorDisplayName: "Viewer",
      actorExternalId: "raw-actor-secret",
      authOrTokenShaped: false,
      catalogKnown: true,
      category: "chat" as const,
      eventHistoryId: null,
      highVolume: true,
      id: "intake-1",
      internalTrigger: "provider.twitch.irc.privmsg",
      mechanism: "twitch-irc" as const,
      moderationShaped: false,
      moneyShaped: false,
      occurredAt: "2026-07-04T16:00:00.000Z",
      overlayEligibleByDefault: false as const,
      processingStatus: "stored" as const,
      provider: "twitch" as const,
      providerChannelId: "raw-channel-secret",
      providerEventName: "PRIVMSG",
      providerMessageId: "raw-message-secret",
      receivedAt: "2026-07-04T16:00:01.000Z",
      redactedPayloadPreview: {
        message: "secret chat body",
        arbitraryProviderField: "raw arbitrary payload"
      },
      sourceEventId: "raw-source-event-secret"
    }];
  }
}

type AtomicStoreState = {
  eventHistoryId: string | null;
  historyIds: string[];
  processingStatus: ProviderEventIntakeReviewCandidate["processingStatus"];
};

const createAtomicStorePool = () => {
  let persisted: AtomicStoreState = {
    eventHistoryId: null,
    historyIds: [],
    processingStatus: "stored"
  };
  let transactionState: AtomicStoreState | null = null;
  let failInsert = false;
  let failLink = false;
  let commits = 0;
  let rollbacks = 0;
  let releases = 0;

  const cloneState = (state: AtomicStoreState): AtomicStoreState => ({
    ...state,
    historyIds: [...state.historyIds]
  });

  const executeAgainst = async (
    state: AtomicStoreState,
    sql: string,
    values: readonly unknown[] = []
  ): Promise<[unknown, unknown]> => {
    const compactSql = sql.replace(/\s+/g, " ").trim();

    if (compactSql.includes("SET processing_status = 'normalized'")) {
      const canTransition = state.eventHistoryId === null
        && (state.processingStatus === "stored" || state.processingStatus === "failed");
      if (canTransition) state.processingStatus = "normalized";
      return [{ affectedRows: canTransition ? 1 : 0 }, undefined];
    }

    if (compactSql.startsWith("INSERT INTO event_history")) {
      if (failInsert) throw new Error("forced event history insert failure");
      state.historyIds.push(String(values[0]));
      return [{ affectedRows: 1 }, undefined];
    }

    if (compactSql.includes("SET processing_status = 'mapped_to_event_history'")) {
      const canLink = !failLink && state.processingStatus === "normalized" && state.eventHistoryId === null;
      if (canLink) {
        state.processingStatus = "mapped_to_event_history";
        state.eventHistoryId = String(values[0]);
      }
      return [{ affectedRows: canLink ? 1 : 0 }, undefined];
    }

    if (compactSql.includes("SET processing_status = 'failed'")) {
      if (state.processingStatus === "normalized") state.processingStatus = "failed";
      return [{ affectedRows: 1 }, undefined];
    }

    throw new Error(`Unexpected SQL in atomic store test: ${compactSql}`);
  };

  const connection = {
    async beginTransaction() {
      transactionState = cloneState(persisted);
    },
    async commit() {
      if (!transactionState) throw new Error("No transaction to commit");
      persisted = transactionState;
      transactionState = null;
      commits += 1;
    },
    async execute(sql: string, values?: readonly unknown[]) {
      if (!transactionState) throw new Error("No active transaction");
      return await executeAgainst(transactionState, sql, values);
    },
    release() {
      releases += 1;
    },
    async rollback() {
      transactionState = null;
      rollbacks += 1;
    }
  };

  const pool = {
    async execute(sql: string, values?: readonly unknown[]) {
      return await executeAgainst(persisted, sql, values);
    },
    async getConnection() {
      return connection;
    }
  } as unknown as DatabasePool;

  return {
    pool,
    setFailInsert(value: boolean) {
      failInsert = value;
    },
    setFailLink(value: boolean) {
      failLink = value;
    },
    snapshot: () => ({
      commits,
      persisted: cloneState(persisted),
      releases,
      rollbacks
    })
  };
};

const reviewRefPrefix = "provider-intake-review:v1:";

const replaceReviewRefSegment = (
  reviewRef: string,
  index: number,
  replace: (segment: string) => string
): string => {
  const segments = reviewRef.slice(reviewRefPrefix.length).split(".");
  const segment = segments[index];

  if (!reviewRef.startsWith(reviewRefPrefix) || segments.length !== 3 || segment === undefined) {
    throw new Error("Expected a three-segment provider intake review ref.");
  }

  segments[index] = replace(segment);
  return `${reviewRefPrefix}${segments.join(".")}`;
};

const makeNonCanonicalBase64Url = (encoded: string): string => {
  const decoded = Buffer.from(encoded, "base64url");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

  for (const candidateCharacter of alphabet) {
    const candidate = `${encoded.slice(0, -1)}${candidateCharacter}`;
    if (
      candidate !== encoded
      && Buffer.from(candidate, "base64url").equals(decoded)
      && Buffer.from(candidate, "base64url").toString("base64url") !== candidate
    ) {
      return candidate;
    }
  }

  throw new Error("Unable to construct a non-canonical base64url value.");
};

describe("ProviderEventIntakeAdminService", () => {
  it("allows owner wildcard to list recent intake rows", async () => {
    const repository = new FakeProviderEventIntakeRepository();
    const service = new ProviderEventIntakeAdminService(repository, { reviewRefSecret: "test-review-secret" });

    const result = await service.listRecent({
      authUserId: "auth-owner",
      filters: {
        provider: "twitch",
        moneyShaped: false,
        limit: 25
      }
    });

    expect(result).toMatchObject({
      filters: {
        limit: 25,
        moneyShaped: false,
        provider: "twitch"
      },
      ok: true,
      readOnly: true,
      rows: [{
        catalogKnown: true,
        category: "chat",
        internalTrigger: "provider.twitch.irc.privmsg",
        mechanism: "twitch-irc",
        occurredAt: "2026-07-04T16:00:00.000Z",
        overlayEligibleByDefault: false,
        processingStatus: "stored",
        provider: "twitch",
        providerEventName: "PRIVMSG",
        receivedAt: "2026-07-04T16:00:01.000Z",
        reviewable: true,
        safeSummary: "Twitch PRIVMSG from Viewer",
        safetyFlags: {
          authOrTokenShaped: false,
          highVolume: true,
          moderationShaped: false,
          moneyShaped: false
        }
      }]
    });

    const row = result.ok ? result.rows[0] : null;

    expect(row).not.toBeNull();
    expect(Object.keys(row ?? {})).toEqual([
      "catalogKnown",
      "category",
      "internalTrigger",
      "mechanism",
      "occurredAt",
      "overlayEligibleByDefault",
      "processingStatus",
      "provider",
      "providerEventName",
      "receivedAt",
      "reviewRef",
      "reviewable",
      "safeSummary",
      "safetyFlags"
    ]);
    expect(Object.keys(row?.safetyFlags ?? {})).toEqual([
      "authOrTokenShaped",
      "highVolume",
      "moderationShaped",
      "moneyShaped"
    ]);
    expect(row?.reviewRef).toMatch(/^provider-intake-review:v1:/);
    const browserPayload = JSON.stringify(row);
    for (const forbidden of [
      "\"id\"",
      "\"sourceEventId\"",
      "\"providerChannelId\"",
      "\"providerMessageId\"",
      "\"actorExternalId\"",
      "\"actorDisplayName\"",
      "\"eventHistoryId\"",
      "\"redactedPayloadPreview\"",
      "raw-source-event-secret",
      "raw-channel-secret",
      "raw-message-secret",
      "raw-actor-secret",
      "secret chat body",
      "raw arbitrary payload"
    ]) {
      expect(browserPayload).not.toContain(forbidden);
    }
  });

  it("projects intake health for tracked provider mechanisms", async () => {
    const repository = new FakeProviderEventIntakeRepository();
    const service = new ProviderEventIntakeAdminService(repository, { reviewRefSecret: "test-review-secret" });

    const result = await service.getHealth({
      authUserId: "auth-owner",
      now: new Date("2026-07-05T16:00:01.000Z")
    });

    expect(result).toMatchObject({
      ok: true,
      readOnly: true,
      staleAfterMinutes: 10080
    });
    expect(result.ok ? result.entries : []).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "Twitch Chat",
        lastProviderEventName: "PRIVMSG",
        mechanism: "twitch-irc",
        provider: "twitch",
        rowCount: 4,
        status: "healthy"
      }),
      expect.objectContaining({
        label: "YouTube Activities",
        mechanism: "youtube-activity",
        provider: "youtube",
        status: "stale"
      }),
      expect.objectContaining({
        label: "Discord Webhooks",
        mechanism: "discord-webhook",
        provider: "discord",
        rowCount: 0,
        status: "missing"
      })
    ]));
  });

  it("denies unlinked and non-owner users", async () => {
    const repository = new FakeProviderEventIntakeRepository();
    const service = new ProviderEventIntakeAdminService(repository, { reviewRefSecret: "test-review-secret" });

    repository.actor = null;
    await expect(service.listRecent({ authUserId: "missing" })).resolves.toEqual({
      ok: false,
      reason: "provider_event_intake_user_unlinked"
    });

    repository.actor = {
      domainUserId: "helper",
      rolePermissionValues: [["moderators:manage"]]
    };
    await expect(service.listRecent({ authUserId: "helper" })).resolves.toEqual({
      ok: false,
      reason: "provider_event_intake_forbidden"
    });
  });

  it("maps a known intake row to internal event history without public playback", async () => {
    const repository = new FakeProviderEventIntakeRepository();
    const service = new ProviderEventIntakeAdminService(repository, { reviewRefSecret: "test-review-secret" });
    const listResult = await service.listRecent({ authUserId: "auth-owner" });
    const reviewRef = listResult.ok ? listResult.rows[0]?.reviewRef : null;

    expect(reviewRef).toBeTruthy();

    await expect(service.review({
      action: "map_internal",
      authUserId: "auth-owner",
      reviewRef: reviewRef ?? ""
    })).resolves.toEqual({
      action: "map_internal",
      ok: true,
      processingStatus: "mapped_to_event_history",
      publicPlayback: false
    });
    expect(repository.lastCandidateId).toBe("intake-1");
    expect(repository.mappedEventKind).toBe("twitch.follow");
  });

  it("keeps a review ref retryable after a rolled-back map and rejects it after mapping", async () => {
    const repository = new FakeProviderEventIntakeRepository();
    repository.mapFailuresRemaining = 1;
    const service = new ProviderEventIntakeAdminService(repository, { reviewRefSecret: "test-review-secret" });
    const listResult = await service.listRecent({ authUserId: "auth-owner" });
    const reviewRef = listResult.ok ? listResult.rows[0]?.reviewRef ?? "" : "";

    await expect(service.review({
      action: "map_internal",
      authUserId: "auth-owner",
      reviewRef
    })).resolves.toEqual({
      ok: false,
      reason: "provider_event_intake_review_unavailable"
    });
    expect(repository.candidate?.processingStatus).toBe("stored");
    expect(repository.candidate?.eventHistoryId).toBeNull();

    await expect(service.review({
      action: "map_internal",
      authUserId: "auth-owner",
      reviewRef
    })).resolves.toEqual({
      action: "map_internal",
      ok: true,
      processingStatus: "mapped_to_event_history",
      publicPlayback: false
    });
    await expect(service.review({
      action: "map_internal",
      authUserId: "auth-owner",
      reviewRef
    })).resolves.toEqual({
      ok: false,
      reason: "provider_event_intake_already_reviewed"
    });
    expect(repository.mapToEventHistoryCalls).toBe(2);
  });

  it("ignores intake rows without writing event history", async () => {
    const repository = new FakeProviderEventIntakeRepository();
    const service = new ProviderEventIntakeAdminService(repository, { reviewRefSecret: "test-review-secret" });
    const listResult = await service.listRecent({ authUserId: "auth-owner" });
    const reviewRef = listResult.ok ? listResult.rows[0]?.reviewRef : null;

    await expect(service.review({
      action: "ignore",
      authUserId: "auth-owner",
      reviewRef: reviewRef ?? ""
    })).resolves.toEqual({
      action: "ignore",
      ok: true,
      processingStatus: "ignored",
      publicPlayback: false
    });
    expect(repository.markIgnoredCalls).toBe(1);
    expect(repository.lastIgnoredId).toBe("intake-1");
    expect(repository.mappedEventKind).toBeNull();
  });

  it("fails closed for non-canonical, malformed, tampered, and cross-account review refs", async () => {
    const repository = new FakeProviderEventIntakeRepository();
    const service = new ProviderEventIntakeAdminService(repository, { reviewRefSecret: "test-review-secret" });
    const listResult = await service.listRecent({ authUserId: "auth-owner" });
    const reviewRef = listResult.ok ? listResult.rows[0]?.reviewRef ?? "" : "";
    const tamperedRef = reviewRef.replace("provider-intake-review:v1:", "provider-intake-review:v1:a");
    const malformedRefs = [
      "not-a-review-ref",
      ` ${reviewRef}`,
      `${reviewRef} `,
      tamperedRef,
      ...[0, 1, 2].map((index) => replaceReviewRefSegment(reviewRef, index, (segment) => `${segment}!`)),
      ...[0, 1, 2].map((index) => replaceReviewRefSegment(reviewRef, index, (segment) => `${segment}=`)),
      replaceReviewRefSegment(reviewRef, 0, () => Buffer.alloc(11).toString("base64url")),
      replaceReviewRefSegment(reviewRef, 0, () => Buffer.alloc(13).toString("base64url")),
      replaceReviewRefSegment(reviewRef, 2, () => Buffer.alloc(15).toString("base64url")),
      replaceReviewRefSegment(reviewRef, 2, () => Buffer.alloc(17).toString("base64url")),
      replaceReviewRefSegment(reviewRef, 2, makeNonCanonicalBase64Url)
    ];

    for (const malformedRef of malformedRefs) {
      repository.lastCandidateId = null;
      await expect(service.review({
        action: "ignore",
        authUserId: "auth-owner",
        reviewRef: malformedRef
      })).resolves.toEqual({
        ok: false,
        reason: "provider_event_intake_not_found"
      });
      expect(repository.lastCandidateId).toBeNull();
    }

    repository.actor = {
      domainUserId: "other-owner",
      rolePermissionValues: [["*"]]
    };
    await expect(service.review({
      action: "ignore",
      authUserId: "auth-other-owner",
      reviewRef
    })).resolves.toEqual({
      ok: false,
      reason: "provider_event_intake_not_found"
    });
  });

  it("rejects already reviewed or unsafe intake rows", async () => {
    const repository = new FakeProviderEventIntakeRepository();
    const service = new ProviderEventIntakeAdminService(repository, { reviewRefSecret: "test-review-secret" });
    const listResult = await service.listRecent({ authUserId: "auth-owner" });
    const reviewRef = listResult.ok ? listResult.rows[0]?.reviewRef : null;

    repository.candidate = {
      ...repository.candidate!,
      eventHistoryId: "history-1",
      processingStatus: "mapped_to_event_history"
    };
    await expect(service.review({
      action: "map_internal",
      authUserId: "auth-owner",
      reviewRef: reviewRef ?? ""
    })).resolves.toEqual({
      ok: false,
      reason: "provider_event_intake_already_reviewed"
    });

    repository.candidate = {
      ...repository.candidate,
      authOrTokenShaped: true,
      eventHistoryId: null,
      processingStatus: "stored"
    };
    await expect(service.review({
      action: "map_internal",
      authUserId: "auth-owner",
      reviewRef: reviewRef ?? ""
    })).resolves.toEqual({
      ok: false,
      reason: "provider_intake_review_auth_or_token_shaped"
    });
  });
});

describe("provider event intake admin store mapping transaction", () => {
  const candidate = new FakeProviderEventIntakeRepository().candidate!;
  const mapInput = {
    eventKind: "twitch.follow" as const,
    reviewedByUserId: "owner-user",
    row: candidate
  };

  it("rolls back the normalized transition when event history insertion fails, then retries once", async () => {
    const database = createAtomicStorePool();
    const repository = createProviderEventIntakeAdminRepository(database.pool);
    database.setFailInsert(true);

    await expect(repository.mapToEventHistory(mapInput)).rejects.toThrow("forced event history insert failure");
    expect(database.snapshot()).toEqual({
      commits: 0,
      persisted: {
        eventHistoryId: null,
        historyIds: [],
        processingStatus: "stored"
      },
      releases: 1,
      rollbacks: 1
    });

    database.setFailInsert(false);
    await expect(repository.mapToEventHistory(mapInput)).resolves.toMatchObject({
      eventKind: "twitch.follow",
      publicPlayback: false
    });
    expect(database.snapshot()).toMatchObject({
      commits: 1,
      persisted: {
        processingStatus: "mapped_to_event_history"
      },
      releases: 2,
      rollbacks: 1
    });
    expect(database.snapshot().persisted.historyIds).toHaveLength(1);
    expect(database.snapshot().persisted.eventHistoryId).toBe(database.snapshot().persisted.historyIds[0]);
  });

  it("rolls back inserted history when link-back loses its race and stays idempotent on retry", async () => {
    const database = createAtomicStorePool();
    const repository = createProviderEventIntakeAdminRepository(database.pool);
    database.setFailLink(true);

    await expect(repository.mapToEventHistory(mapInput)).resolves.toBeNull();
    expect(database.snapshot()).toEqual({
      commits: 0,
      persisted: {
        eventHistoryId: null,
        historyIds: [],
        processingStatus: "stored"
      },
      releases: 1,
      rollbacks: 1
    });

    database.setFailLink(false);
    await expect(repository.mapToEventHistory(mapInput)).resolves.not.toBeNull();
    await expect(repository.mapToEventHistory(mapInput)).resolves.toBeNull();
    expect(database.snapshot()).toMatchObject({
      commits: 1,
      persisted: {
        processingStatus: "mapped_to_event_history"
      },
      releases: 3,
      rollbacks: 2
    });
    expect(database.snapshot().persisted.historyIds).toHaveLength(1);
  });
});

describe("provider event intake admin routes", () => {
  it("returns 401 for unauthenticated access", async () => {
    const server = Fastify();

    registerProviderEventIntakeAdminRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("database should not be used");
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/connections/intake"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });

  it("passes parsed filters to the service", async () => {
    const server = Fastify();
    const service = {
      getHealth: async (): Promise<ProviderEventIntakeHealthResult> => {
        throw new Error("health service should not be used");
      },
      listRecent: async (): Promise<ProviderEventIntakeAdminResult> => ({
        filters: {
          authOrTokenShaped: null,
          catalogKnown: true,
          highVolume: null,
          limit: 10,
          moderationShaped: null,
          moneyShaped: true,
          processingStatus: "stored",
          provider: "youtube"
        },
        ok: true,
        readOnly: true,
        rows: []
      })
    };

    registerProviderEventIntakeAdminRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => service
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/connections/intake?provider=youtube&processingStatus=stored&moneyShaped=true&catalogKnown=true&limit=10"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      filters: {
        catalogKnown: true,
        limit: 10,
        moneyShaped: true,
        processingStatus: "stored",
        provider: "youtube"
      },
      ok: true
    });
  });

  it("accepts owner review actions for provider intake rows", async () => {
    const server = Fastify();
    const reviewRef = "provider-intake-review:v1:opaque.review.tag";
    let reviewInput: {
      action: "map_internal" | "ignore";
      authUserId: string;
      reviewRef: string;
    } | null = null;
    const service = {
      getHealth: async (): Promise<ProviderEventIntakeHealthResult> => {
        throw new Error("health service should not be used");
      },
      listRecent: async (): Promise<ProviderEventIntakeAdminResult> => {
        throw new Error("list service should not be used");
      },
      review: async (input: {
        action: "map_internal" | "ignore";
        authUserId: string;
        reviewRef: string;
      }): Promise<ProviderEventIntakeReviewResult> => {
        reviewInput = input;
        return {
          action: "map_internal",
          ok: true,
          processingStatus: "mapped_to_event_history",
          publicPlayback: false
        };
      }
    };

    registerProviderEventIntakeAdminRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => service
    });

    const response = await server.inject({
      method: "POST",
      payload: {
        action: "map_internal"
      },
      url: `/admin/connections/intake/${encodeURIComponent(reviewRef)}/review`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      action: "map_internal",
      ok: true,
      processingStatus: "mapped_to_event_history",
      publicPlayback: false
    });
    expect(reviewInput).toEqual({
      action: "map_internal",
      authUserId: "auth-owner",
      reviewRef
    });
  });

  it("rejects leading and trailing review-ref whitespace at the route boundary", async () => {
    const server = Fastify();
    const reviewRef = "provider-intake-review:v1:opaque.review.tag";
    let reviewCalls = 0;

    registerProviderEventIntakeAdminRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => ({
        getHealth: async () => {
          throw new Error("health service should not be used");
        },
        listRecent: async () => {
          throw new Error("list service should not be used");
        },
        review: async (): Promise<ProviderEventIntakeReviewResult> => {
          reviewCalls += 1;
          return {
            action: "ignore",
            ok: true,
            processingStatus: "ignored",
            publicPlayback: false
          };
        }
      })
    });

    for (const whitespaceRef of [` ${reviewRef}`, `${reviewRef} `]) {
      const response = await server.inject({
        method: "POST",
        payload: { action: "ignore" },
        url: `/admin/connections/intake/${encodeURIComponent(whitespaceRef)}/review`
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        ok: false,
        reason: "provider_event_intake_invalid_input"
      });
    }
    expect(reviewCalls).toBe(0);
  });

  it("rejects invalid review actions", async () => {
    const server = Fastify();

    registerProviderEventIntakeAdminRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => ({
        getHealth: async () => {
          throw new Error("service should not be used");
        },
        listRecent: async () => {
          throw new Error("service should not be used");
        },
        review: async () => {
          throw new Error("service should not be used");
        }
      })
    });

    const response = await server.inject({
      method: "POST",
      payload: {
        action: "publish_now"
      },
      url: "/admin/connections/intake/intake-1/review"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      ok: false,
      reason: "provider_event_intake_invalid_input"
    });
  });

  it("rejects invalid filters", async () => {
    const server = Fastify();

    registerProviderEventIntakeAdminRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => ({
        getHealth: async () => {
          throw new Error("service should not be used");
        },
        listRecent: async () => {
          throw new Error("service should not be used");
        }
      })
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/connections/intake?provider=bad-provider"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      ok: false,
      reason: "provider_event_intake_invalid_input"
    });
  });

  it("returns provider intake health for owners", async () => {
    const server = Fastify();
    const service = {
      getHealth: async (): Promise<ProviderEventIntakeHealthResult> => ({
        entries: [{
          label: "Twitch Chat",
          lastProviderEventName: "PRIVMSG",
          lastReceivedAt: "2026-07-04T16:00:01.000Z",
          mechanism: "twitch-irc",
          provider: "twitch",
          rowCount: 4,
          status: "healthy"
        }],
        generatedAt: "2026-07-05T16:00:01.000Z",
        ok: true,
        readOnly: true,
        staleAfterMinutes: 10080
      }),
      listRecent: async (): Promise<ProviderEventIntakeAdminResult> => {
        throw new Error("list service should not be used");
      }
    };

    registerProviderEventIntakeAdminRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-owner" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => service
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/connections/intake/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      entries: [{
        mechanism: "twitch-irc",
        status: "healthy"
      }],
      ok: true,
      readOnly: true
    });
  });
});
