import type {
  StreamScheduleCancellationInput,
  StreamScheduleEntry,
  StreamScheduleInput,
  StreamScheduleUpdateInput
} from "@maiks-yt/domain/schedule";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerStreamScheduleRoutes } from "../../src/schedule/stream-schedule.route.js";
import { StreamScheduleService } from "../../src/schedule/stream-schedule.service.js";
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
    await expect(service.listAdminStreams({ authUserId: "auth-user" })).resolves.toMatchObject({
      ok: true,
      projectOptions: [
        {
          id: "project-1",
          slug: "maiks-yt-v2"
        }
      ]
    });
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
