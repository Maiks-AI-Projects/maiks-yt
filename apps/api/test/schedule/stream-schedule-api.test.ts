import type {
  StreamScheduleCancellationInput,
  StreamScheduleEntry,
  StreamScheduleGameLinkInput,
  StreamScheduleInput,
  StreamScheduleUpdateInput
} from "@maiks-yt/domain/schedule";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerStreamScheduleRoutes } from "../../src/schedule/stream-schedule.route.js";
import { StreamScheduleService } from "../../src/schedule/stream-schedule.service.js";
import { createStreamScheduleRepository } from "../../src/schedule/stream-schedule-store.service.js";
import type {
  StreamScheduleAdminActor,
  StreamScheduleRepository
} from "../../src/schedule/stream-schedule.types.js";

const createStream = (overrides: Partial<StreamScheduleEntry> = {}): StreamScheduleEntry => ({
  id: "stream-1",
  title: "Maiks.yt build stream",
  description: "Build stream",
  startsAt: "2026-06-20T18:00:00.000Z",
  endsAt: "2026-06-20T20:00:00.000Z",
  channelKey: "coding",
  topicKey: "maiks-yt",
  themeKey: "default",
  projectId: null,
  focusLabel: null,
  focusNote: null,
  focusProject: null,
  gameLinks: [],
  visibility: "public",
  status: "planned",
  cancellationReasonCode: null,
  cancellationReason: null,
  createdAt: "2026-06-19T12:00:00.000Z",
  updatedAt: "2026-06-19T12:00:00.000Z",
  ...overrides
});

const createPayload = (overrides: Partial<StreamScheduleInput> = {}): StreamScheduleInput => ({
  title: "New stream",
  description: "A manual stream schedule entry.",
  startsAt: "2026-06-22T18:00:00.000Z",
  endsAt: "2026-06-22T20:00:00.000Z",
  channelKey: "coding",
  topicKey: "maiks-yt",
  themeKey: "default",
  projectId: null,
  focusLabel: null,
  focusNote: null,
  visibility: "public",
  status: "planned",
  cancellationReasonCode: null,
  cancellationReason: null,
  ...overrides
});

class FakeStreamScheduleRepository implements StreamScheduleRepository {
  public actor: StreamScheduleAdminActor | null = {
    domainUserId: "domain-user",
    rolePermissionValues: [["*"]]
  };
  public readonly streams = new Map<string, StreamScheduleEntry>();
  public lastCreated: (StreamScheduleInput & { actorUserId: string }) | null = null;
  public lastUpdated: StreamScheduleUpdateInput | null = null;
  public lastCancellation: StreamScheduleCancellationInput | null = null;
  public lastGameLinks: readonly StreamScheduleGameLinkInput[] | null = null;

  public constructor() {
    this.streams.set("stream-1", createStream());
    this.streams.set("private-stream", createStream({
      id: "private-stream",
      visibility: "private"
    }));
  }

  public async resolveActor(): Promise<StreamScheduleAdminActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }

  public async getStream(id: string): Promise<StreamScheduleEntry | null> {
    const stream = this.streams.get(id);

    return stream ? structuredClone(stream) : null;
  }

  public async listPublicStreams(): Promise<readonly StreamScheduleEntry[]> {
    return [...this.streams.values()].filter((stream) => stream.visibility === "public");
  }

  public async listAdminStreams(): Promise<readonly StreamScheduleEntry[]> {
    return [...this.streams.values()];
  }

  public async listProjectOptions() {
    return [
      {
        id: "project-1",
        slug: "maiks-yt-v2",
        title: "Maiks.yt V2"
      }
    ];
  }

  public async listGameOptions() {
    return [
      {
        id: "game-1",
        slug: "satisfactory",
        title: "Satisfactory",
        platformLabel: "PC",
        ownershipStatus: "owned" as const,
        interestStatus: "currently-playing" as const,
        visibility: "public" as const
      },
      {
        id: "private-game",
        slug: "private-game",
        title: "Private Game",
        platformLabel: null,
        ownershipStatus: "unknown" as const,
        interestStatus: "interested" as const,
        visibility: "private" as const
      }
    ];
  }

  public async createStream(input: StreamScheduleInput & { actorUserId: string }): Promise<StreamScheduleEntry> {
    this.lastCreated = structuredClone(input);
    const stream = createStream({
      ...input,
      id: "created-stream"
    });
    this.streams.set(stream.id, stream);
    return structuredClone(stream);
  }

  public async updateStream(id: string, input: StreamScheduleUpdateInput) {
    const existing = this.streams.get(id);

    if (!existing) {
      return "not-found" as const;
    }

    this.lastUpdated = structuredClone(input);
    const stream = {
      ...existing,
      ...input,
      updatedAt: "2026-06-19T13:00:00.000Z"
    };
    this.streams.set(id, stream);
    return structuredClone(stream);
  }

  public async cancelStream(id: string, input: StreamScheduleCancellationInput) {
    this.lastCancellation = structuredClone(input);
    return await this.updateStream(id, {
      status: "cancelled",
      cancellationReasonCode: input.cancellationReasonCode,
      cancellationReason: input.cancellationReason
    });
  }

  public async replaceGameLinks(input: {
    streamId: string;
    links: readonly StreamScheduleGameLinkInput[];
  }) {
    const existing = this.streams.get(input.streamId);

    if (!existing) {
      return "not-found" as const;
    }

    if (input.links.some((link) => link.gameId === "missing-game")) {
      return "invalid-game" as const;
    }

    this.lastGameLinks = structuredClone(input.links);
    const stream = {
      ...existing,
      gameLinks: input.links.map((link, index) => ({
        id: `game-link-${index}`,
        gameId: link.gameId,
        slug: link.gameId === "private-game" ? "private-game" : "satisfactory",
        title: link.gameId === "private-game" ? "Private Game" : "Satisfactory",
        platformLabel: link.gameId === "private-game" ? null : "PC",
        ownershipStatus: link.gameId === "private-game" ? "unknown" as const : "owned" as const,
        interestStatus: link.gameId === "private-game" ? "interested" as const : "currently-playing" as const,
        relationship: link.relationship,
        publicNote: link.publicNote ?? null,
        sortOrder: link.sortOrder ?? index
      }))
    };
    this.streams.set(input.streamId, stream);
    return structuredClone(stream);
  }
}

describe("StreamScheduleService", () => {
  it("lists only public stream schedules on the public service path", async () => {
    const repository = new FakeStreamScheduleRepository();
    const service = new StreamScheduleService(repository);

    await expect(service.listPublicStreams()).resolves.toMatchObject({
      ok: true,
      streams: [
        {
          id: "stream-1",
          visibility: "public"
        }
      ]
    });
  });

  it("allows owner wildcard and schedule permission for admin mutations", async () => {
    const repository = new FakeStreamScheduleRepository();
    const service = new StreamScheduleService(repository);

    await expect(service.createStream({
      authUserId: "auth-user",
      ...createPayload()
    })).resolves.toMatchObject({
      ok: true,
      stream: {
        id: "created-stream"
      }
    });
    expect(repository.lastCreated).toMatchObject({
      actorUserId: "domain-user"
    });

    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [JSON.stringify(["schedule:manage"])]
    };
    const adminResult = await service.listAdminStreams({ authUserId: "auth-user" });
    expect(adminResult).toMatchObject({
      ok: true,
      projectOptions: [
        {
          id: "project-1",
          slug: "maiks-yt-v2"
        }
      ]
    });
    expect(adminResult.ok ? adminResult.gameOptions : []).toContainEqual(expect.objectContaining({
      id: "game-1",
      slug: "satisfactory"
    }));
  });

  it("replaces stream game links through an owner-gated mutation", async () => {
    const repository = new FakeStreamScheduleRepository();
    const service = new StreamScheduleService(repository);

    await expect(service.replaceStreamGameLinks({
      authUserId: "auth-user",
      id: "stream-1",
      links: [
        {
          gameId: " game-1 ",
          relationship: "planned",
          publicNote: "  Factory prep  "
        }
      ]
    })).resolves.toMatchObject({
      ok: true,
      stream: {
        id: "stream-1",
        gameLinks: [
          {
            gameId: "game-1",
            title: "Satisfactory",
            publicNote: "Factory prep"
          }
        ]
      }
    });
    expect(repository.lastGameLinks).toEqual([
      {
        gameId: "game-1",
        relationship: "planned",
        publicNote: "Factory prep",
        sortOrder: 0
      }
    ]);
  });

  it("stores and clears manual stream focus fields through admin mutations", async () => {
    const repository = new FakeStreamScheduleRepository();
    const service = new StreamScheduleService(repository);

    await expect(service.createStream({
      authUserId: "auth-user",
      ...createPayload({
        projectId: "project-1",
        focusLabel: "Stream focus",
        focusNote: "Working on the schedule link."
      })
    })).resolves.toMatchObject({
      ok: true,
      stream: {
        projectId: "project-1",
        focusLabel: "Stream focus",
        focusNote: "Working on the schedule link."
      }
    });
    expect(repository.lastCreated).toMatchObject({
      projectId: "project-1",
      focusLabel: "Stream focus",
      focusNote: "Working on the schedule link."
    });

    await expect(service.updateStream({
      authUserId: "auth-user",
      id: "created-stream",
      stream: {
        projectId: null,
        focusLabel: null,
        focusNote: null
      }
    })).resolves.toMatchObject({
      ok: true,
      stream: {
        projectId: null,
        focusLabel: null,
        focusNote: null
      }
    });
    expect(repository.lastUpdated).toEqual({
      projectId: null,
      focusLabel: null,
      focusNote: null
    });
  });

  it("denies unlinked and non-schedule admins", async () => {
    const repository = new FakeStreamScheduleRepository();
    const service = new StreamScheduleService(repository);

    repository.actor = null;
    await expect(service.listAdminStreams({ authUserId: "auth-user" })).resolves.toEqual({
      ok: false,
      reason: "stream_schedule_admin_user_unlinked"
    });

    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [["project-admin:manage"]]
    };
    await expect(service.createStream({
      authUserId: "auth-user",
      ...createPayload()
    })).resolves.toEqual({
      ok: false,
      reason: "stream_schedule_admin_forbidden"
    });
  });

  it("cancels with constrained reason fields", async () => {
    const repository = new FakeStreamScheduleRepository();
    const service = new StreamScheduleService(repository);

    await expect(service.cancelStream({
      authUserId: "auth-user",
      id: "stream-1",
      cancellation: {
        cancellationReasonCode: "energy",
        cancellationReason: "I need to recover before streaming."
      }
    })).resolves.toMatchObject({
      ok: true,
      stream: {
        status: "cancelled",
        cancellationReasonCode: "energy"
      }
    });
    expect(repository.lastCancellation).toEqual({
      cancellationReasonCode: "energy",
      cancellationReason: "I need to recover before streaming."
    });
  });
});

describe("stream schedule store boundaries", () => {
  it("keeps public live streams visible while preserving future-only planned and cancelled reads", async () => {
    const now = new Date("2026-08-27T12:00:00.000Z");
    const calls: Array<{ sql: string; parameters: unknown[] }> = [];
    const repository = createStreamScheduleRepository({
      execute: async (sql: string, parameters: unknown[] = []) => {
        calls.push({ sql, parameters });

        if (calls.length === 1) {
          return [[
            {
              id: "live-stream",
              title: "Current stream",
              description: null,
              startsAt: new Date("2026-08-27T10:00:00.000Z"),
              endsAt: null,
              channelKey: "coding",
              topicKey: null,
              themeKey: null,
              projectId: null,
              focusLabel: null,
              focusNote: null,
              visibility: "public",
              status: "live",
              cancellationReasonCode: null,
              cancellationReason: null,
              createdAt: new Date("2026-08-27T09:00:00.000Z"),
              updatedAt: new Date("2026-08-27T09:30:00.000Z"),
              focusProjectId: null,
              focusProjectSlug: null,
              focusProjectTitle: null
            },
            {
              id: "cancelled-stream",
              title: "Future cancelled stream",
              description: null,
              startsAt: new Date("2026-08-28T20:00:00.000Z"),
              endsAt: null,
              channelKey: "coding",
              topicKey: null,
              themeKey: null,
              projectId: null,
              focusLabel: null,
              focusNote: null,
              visibility: "public",
              status: "cancelled",
              cancellationReasonCode: "technical",
              cancellationReason: "Equipment repair.",
              createdAt: new Date("2026-08-27T09:00:00.000Z"),
              updatedAt: new Date("2026-08-27T09:30:00.000Z"),
              focusProjectId: null,
              focusProjectSlug: null,
              focusProjectTitle: null
            }
          ], []];
        }

        return [[], []];
      }
    } as never);

    await expect(repository.listPublicStreams({ now })).resolves.toMatchObject([
      {
        id: "live-stream",
        status: "live",
        startsAt: "2026-08-27T10:00:00.000Z"
      },
      {
        id: "cancelled-stream",
        status: "cancelled",
        cancellationReasonCode: "technical"
      }
    ]);

    expect(calls[0]?.sql).toContain("stream_schedule_entries.status IN ('planned', 'live', 'cancelled')");
    expect(calls[0]?.sql).toContain("WHERE visibility = 'public'");
    expect(calls[0]?.sql).toContain("stream_schedule_entries.status = 'live'");
    expect(calls[0]?.sql).toContain("OR stream_schedule_entries.starts_at >= ?");
    expect(calls[0]?.sql).not.toContain("stream_schedule_entries.status IN ('planned', 'live', 'cancelled', 'completed')");
    expect(calls[0]?.parameters).toEqual([now]);
    expect(calls[1]?.sql).toContain("AND game_library_entries.visibility = 'public'");
    expect(calls[1]?.parameters).toEqual(["live-stream", "cancelled-stream"]);
  });
});

describe("stream schedule route boundary", () => {
  it("returns public schedules without an auth session", async () => {
    const repository = new FakeStreamScheduleRepository();
    repository.streams.set("focused-stream", createStream({
      id: "focused-stream",
      projectId: "project-1",
      focusLabel: "Stream focus",
      focusNote: "Working on the creator platform.",
      focusProject: {
        id: "project-1",
        slug: "maiks-yt-v2",
        title: "Maiks.yt V2"
      }
    }));
    const server = Fastify();
    registerStreamScheduleRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new StreamScheduleService(repository)
    });

    const response = await server.inject({
      method: "GET",
      url: "/schedule"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      streams: [
        {
          id: "stream-1"
        },
        {
          id: "focused-stream",
          focusProject: {
            slug: "maiks-yt-v2"
          },
          focusLabel: "Stream focus"
        }
      ]
    });
    await server.close();
  });

  it("returns 401 without a session and 403 without schedule permission", async () => {
    const unauthenticatedServer = Fastify();
    registerStreamScheduleRoutes(unauthenticatedServer, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      }
    });

    const unauthenticatedResponse = await unauthenticatedServer.inject({
      method: "GET",
      url: "/admin/schedule"
    });
    expect(unauthenticatedResponse.statusCode).toBe(401);
    expect(unauthenticatedResponse.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
    await unauthenticatedServer.close();

    const repository = new FakeStreamScheduleRepository();
    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [[]]
    };
    const forbiddenServer = Fastify();
    registerStreamScheduleRoutes(forbiddenServer, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new StreamScheduleService(repository)
    });

    const forbiddenResponse = await forbiddenServer.inject({
      method: "GET",
      url: "/admin/schedule"
    });
    expect(forbiddenResponse.statusCode).toBe(403);
    expect(forbiddenResponse.json()).toEqual({
      ok: false,
      reason: "stream_schedule_admin_forbidden"
    });
    await forbiddenServer.close();
  });

  it("routes successful public schedule changes and cancellations through real website events", async () => {
    const repository = new FakeStreamScheduleRepository();
    const routeWebsiteEvent = vi.fn(async () => ({
      playbackEmitted: false,
      status: "ignored" as const
    }));
    const server = Fastify();
    registerStreamScheduleRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new StreamScheduleService(repository),
      routeWebsiteEvent
    });

    const updateResponse = await server.inject({
      method: "PATCH",
      url: "/admin/schedule/stream-1",
      payload: {
        title: "Updated public stream"
      }
    });
    const cancelResponse = await server.inject({
      method: "POST",
      url: "/admin/schedule/stream-1/cancel",
      payload: {
        cancellationReasonCode: "energy",
        cancellationReason: "Rest needed."
      }
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(cancelResponse.statusCode).toBe(200);
    expect(routeWebsiteEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      eventKind: "website.schedule-changed",
      sourceEventId: expect.stringMatching(
        /^schedule:stream-1:\d{13}:[a-f0-9-]{36}:website\.schedule-changed$/
      ),
      streamScheduleEntryId: "stream-1",
      actorExternalId: "maiks-yt:schedule",
      userId: null,
      redactedPayload: {
        displayText: "Updated public stream schedule updated",
        event: {
          title: "Updated public stream",
          startsAt: "2026-06-20T18:00:00.000Z",
          channelKey: "coding",
          status: "planned"
        }
      }
    }));
    expect(routeWebsiteEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      eventKind: "website.schedule-cancelled",
      streamScheduleEntryId: "stream-1",
      redactedPayload: expect.objectContaining({
        displayText: "Updated public stream was cancelled"
      })
    }));
    expect(JSON.stringify(routeWebsiteEvent.mock.calls)).not.toContain("Rest needed");
    await server.close();
  });

  it("routes a newly created public schedule entry", async () => {
    const repository = new FakeStreamScheduleRepository();
    const routeWebsiteEvent = vi.fn(async () => ({
      playbackEmitted: false,
      status: "ignored" as const
    }));
    const server = Fastify();
    registerStreamScheduleRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new StreamScheduleService(repository),
      routeWebsiteEvent
    });

    const response = await server.inject({
      method: "POST",
      url: "/admin/schedule",
      payload: createPayload()
    });

    expect(response.statusCode).toBe(200);
    expect(routeWebsiteEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventKind: "website.schedule-changed",
      streamScheduleEntryId: "created-stream",
      actorExternalId: "maiks-yt:schedule"
    }));
    await server.close();
  });

  it("does not route private schedule mutations", async () => {
    const repository = new FakeStreamScheduleRepository();
    const routeWebsiteEvent = vi.fn(async () => ({
      playbackEmitted: false,
      status: "ignored" as const
    }));
    const server = Fastify();
    registerStreamScheduleRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new StreamScheduleService(repository),
      routeWebsiteEvent
    });

    const response = await server.inject({
      method: "PATCH",
      url: "/admin/schedule/private-stream",
      payload: {
        title: "Private planning note"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(routeWebsiteEvent).not.toHaveBeenCalled();
    await server.close();
  });

  it("keeps a successful schedule mutation successful when website routing fails", async () => {
    const repository = new FakeStreamScheduleRepository();
    const server = Fastify({ logger: false });
    registerStreamScheduleRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new StreamScheduleService(repository),
      routeWebsiteEvent: async () => {
        throw new Error("routing unavailable");
      }
    });

    const response = await server.inject({
      method: "PATCH",
      url: "/admin/schedule/stream-1",
      payload: {
        title: "Persist even when routing is down"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      stream: {
        title: "Persist even when routing is down"
      }
    });
    await server.close();
  });

  it("maps invalid input and missing records to stable status codes", async () => {
    const repository = new FakeStreamScheduleRepository();
    const server = Fastify();
    registerStreamScheduleRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new StreamScheduleService(repository)
    });

    const invalidResponse = await server.inject({
      method: "POST",
      url: "/admin/schedule",
      payload: {
        ...createPayload(),
        title: ""
      }
    });
    expect(invalidResponse.statusCode).toBe(400);

    const missingResponse = await server.inject({
      method: "PATCH",
      url: "/admin/schedule/missing",
      payload: {
        title: "Updated"
      }
    });
    expect(missingResponse.statusCode).toBe(404);
    expect(missingResponse.json()).toEqual({
      ok: false,
      reason: "stream_schedule_not_found"
    });
    await server.close();
  });

  it("updates schedule game links through the admin route", async () => {
    const repository = new FakeStreamScheduleRepository();
    const routeWebsiteEvent = vi.fn(async () => ({
      playbackEmitted: false,
      status: "ignored" as const
    }));
    const server = Fastify();
    registerStreamScheduleRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new StreamScheduleService(repository),
      routeWebsiteEvent
    });

    const response = await server.inject({
      method: "PUT",
      url: "/admin/schedule/stream-1/games",
      payload: {
        links: [
          {
            gameId: "game-1",
            relationship: "planned",
            publicNote: "Factory prep"
          }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      stream: {
        gameLinks: [
          {
            gameId: "game-1",
            slug: "satisfactory",
            publicNote: "Factory prep"
          }
        ]
      }
    });
    expect(routeWebsiteEvent).not.toHaveBeenCalled();
    await server.close();
  });

  it("rejects partial updates that would violate schedule invariants", async () => {
    const repository = new FakeStreamScheduleRepository();
    const server = Fastify();
    registerStreamScheduleRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("pool should not be used");
      },
      createService: () => new StreamScheduleService(repository)
    });

    const cancelledWithoutReasonResponse = await server.inject({
      method: "PATCH",
      url: "/admin/schedule/stream-1",
      payload: {
        status: "cancelled"
      }
    });
    expect(cancelledWithoutReasonResponse.statusCode).toBe(400);
    expect(cancelledWithoutReasonResponse.json()).toEqual({
      ok: false,
      reason: "stream_schedule_invalid_input"
    });

    const invalidWindowResponse = await server.inject({
      method: "PATCH",
      url: "/admin/schedule/stream-1",
      payload: {
        startsAt: "2026-06-20T21:00:00.000Z"
      }
    });
    expect(invalidWindowResponse.statusCode).toBe(400);
    expect(invalidWindowResponse.json()).toEqual({
      ok: false,
      reason: "stream_schedule_invalid_input"
    });
    await server.close();
  });
});
