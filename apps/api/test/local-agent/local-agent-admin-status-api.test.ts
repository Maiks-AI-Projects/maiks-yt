import type { AgentIdentity, AgentStatus, CapabilityRegistration } from "@maiks-yt/events";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerLocalAgentAdminStatusRoutes } from "../../src/local-agent/local-agent-admin-status.route.js";
import { LocalAgentAdminStatusService } from "../../src/local-agent/local-agent-admin-status.service.js";
import type {
  LocalAgentAdminStatusActor,
  LocalAgentAdminStatusRepository
} from "../../src/local-agent/local-agent-admin-status.types.js";
import type { LocalAgentRuntimeStatus } from "../../src/local-agent/local-agent-runtime.service.js";

class FakeLocalAgentAdminStatusRepository implements LocalAgentAdminStatusRepository {
  public actor: LocalAgentAdminStatusActor | null = {
    domainUserId: "owner-user",
    rolePermissionValues: [["*"]]
  };

  public async resolveActor(): Promise<LocalAgentAdminStatusActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }
}

const identity: AgentIdentity = {
  agentId: "secret-internal-agent-id",
  deviceId: "secret-device-id",
  protocolVersion: 1,
  serviceVersion: "1.2.3"
};
const capabilities: CapabilityRegistration[] = [{
  id: "vlc-music",
  version: 1,
  actions: ["track.play", "track.stop", "volume.set"],
  availability: "available",
  detail: "/secret/path/to/vlc"
}];
const agentStatus: AgentStatus = {
  startedAt: "2026-08-27T10:00:00.000Z",
  observedAt: "2026-08-27T10:00:30.000Z",
  modules: [{
    capabilityId: "vlc-music",
    availability: "available",
    detail: "secret raw module detail",
    state: {
      activeAudioRouteId: "music",
      available: true,
      detail: "/secret/media/file.mp3",
      playbackId: "secret-playback-id",
      positionSeconds: 18,
      routes: [{
        id: "music",
        state: "available"
      }, {
        id: "private",
        state: "error",
        detail: "route unavailable"
      }],
      status: "playing",
      volumePercent: 65
    }
  }]
};

const connectedRuntime = (): LocalAgentRuntimeStatus => ({
  connected: true,
  identity,
  capabilities,
  status: agentStatus,
  connectedAt: "2026-08-27T10:00:00.000Z",
  lastSeenAt: "2026-08-27T10:00:30.000Z",
  pendingCommands: 4
});

const configured = {
  configured: true,
  expectedAgentId: "secret-expected-agent-id",
  expectedDeviceId: "secret-expected-device-id",
  token: "secret-token-that-must-never-appear"
};

describe("LocalAgentAdminStatusService", () => {
  it("projects connected module health without identifiers, credentials, details, or command data", async () => {
    const service = new LocalAgentAdminStatusService(
      new FakeLocalAgentAdminStatusRepository(),
      {
        config: configured,
        getRuntimeStatus: connectedRuntime,
        now: () => new Date("2026-08-27T10:01:00.000Z")
      }
    );

    const result = await service.getStatus({ authUserId: "auth-owner" });
    const serialized = JSON.stringify(result);

    expect(result).toEqual({
      ok: true,
      readOnly: true,
      generatedAt: "2026-08-27T10:01:00.000Z",
      configuration: { configured: true, issues: [] },
      connection: {
        state: "connected",
        protocolVersion: 1,
        serviceVersion: "1.2.3",
        connectedAt: "2026-08-27T10:00:00.000Z",
        lastSeenAt: "2026-08-27T10:00:30.000Z"
      },
      modules: [{
        id: "vlc-music",
        version: 1,
        actions: ["track.play", "track.stop", "volume.set"],
        availability: "available",
        vlc: {
          activeAudioRouteId: "music",
          hasPlayback: true,
          playbackStatus: "playing",
          positionSeconds: 18,
          routes: [{
            id: "communication",
            label: "Communication",
            mediaRole: "Communication",
            pipeWireSink: "stream_communication",
            state: "unavailable"
          }, {
            id: "music",
            label: "Music",
            mediaRole: "Music",
            pipeWireSink: "stream_music",
            state: "available"
          }, {
            id: "private",
            label: "Private",
            mediaRole: "Private",
            pipeWireSink: "stream_private",
            state: "error",
            detail: "route unavailable"
          }, {
            id: "game",
            label: "Game",
            mediaRole: "Game",
            pipeWireSink: "stream_game",
            state: "unavailable"
          }],
          volumePercent: 65
        }
      }]
    });
    for (const secret of [
      configured.token,
      configured.expectedAgentId,
      configured.expectedDeviceId,
      identity.agentId,
      identity.deviceId,
      "secret-playback-id",
      "/secret/path/to/vlc",
      "/secret/media/file.mp3",
      "pendingCommands"
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("reports stale or unavailable modules as degraded and disconnected state truthfully", async () => {
    const repository = new FakeLocalAgentAdminStatusRepository();
    const staleService = new LocalAgentAdminStatusService(repository, {
      config: configured,
      getRuntimeStatus: () => ({
        ...connectedRuntime(),
        capabilities: [{ ...capabilities[0]!, availability: "degraded" }],
        lastSeenAt: "2026-08-27T09:58:00.000Z"
      }),
      now: () => new Date("2026-08-27T10:01:00.000Z")
    });
    await expect(staleService.getStatus({ authUserId: "auth-owner" })).resolves.toMatchObject({
      ok: true,
      connection: { state: "degraded" },
      modules: [{ availability: "degraded" }]
    });

    const disconnectedService = new LocalAgentAdminStatusService(repository, {
      config: configured,
      getRuntimeStatus: () => ({
        connected: false,
        identity: null,
        capabilities: [],
        status: null,
        connectedAt: null,
        lastSeenAt: null,
        pendingCommands: 0
      })
    });
    await expect(disconnectedService.getStatus({ authUserId: "auth-owner" })).resolves.toMatchObject({
      ok: true,
      connection: { state: "disconnected" },
      modules: []
    });
  });

  it("reports missing configuration reasons without returning configuration values", async () => {
    const service = new LocalAgentAdminStatusService(
      new FakeLocalAgentAdminStatusRepository(),
      {
        config: { configured: false, expectedDeviceId: null, token: null },
        getRuntimeStatus: () => ({
          connected: false,
          identity: null,
          capabilities: [],
          status: null,
          connectedAt: null,
          lastSeenAt: null,
          pendingCommands: 0
        })
      }
    );

    await expect(service.getStatus({ authUserId: "auth-owner" })).resolves.toMatchObject({
      ok: true,
      configuration: {
        configured: false,
        issues: ["credential_missing_or_invalid", "device_identity_missing_or_invalid"]
      },
      connection: { state: "not_configured" }
    });
  });

  it("denies unlinked and non-owner users", async () => {
    const repository = new FakeLocalAgentAdminStatusRepository();
    const service = new LocalAgentAdminStatusService(repository, {
      config: configured,
      getRuntimeStatus: connectedRuntime
    });

    repository.actor = null;
    await expect(service.getStatus({ authUserId: "missing" })).resolves.toEqual({
      ok: false,
      reason: "local_agent_user_unlinked"
    });

    repository.actor = {
      domainUserId: "helper",
      rolePermissionValues: [JSON.stringify(["moderators:manage"])]
    };
    await expect(service.getStatus({ authUserId: "helper" })).resolves.toEqual({
      ok: false,
      reason: "local_agent_forbidden"
    });
  });
});

describe("Local-agent admin status route", () => {
  const routeDependencies = (
    getAuthSession: () => Promise<{ user: { id: string } } | null>,
    service: LocalAgentAdminStatusService
  ) => ({
    config: configured,
    getAuthSession,
    getDatabasePool: () => {
      throw new Error("database should not be used");
    },
    runtime: { getStatus: connectedRuntime },
    createService: () => service
  });

  it("returns 401 for unauthenticated access", async () => {
    const server = Fastify();
    const service = new LocalAgentAdminStatusService(new FakeLocalAgentAdminStatusRepository(), {
      config: configured,
      getRuntimeStatus: connectedRuntime
    });
    registerLocalAgentAdminStatusRoutes(server, routeDependencies(async () => null, service));

    const response = await server.inject({ method: "GET", url: "/admin/local-agent/status" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ ok: false, reason: "not_authenticated" });
  });

  it("returns 403 for authenticated non-owner access", async () => {
    const server = Fastify();
    const repository = new FakeLocalAgentAdminStatusRepository();
    repository.actor = { domainUserId: "helper", rolePermissionValues: [["moderators:manage"]] };
    const service = new LocalAgentAdminStatusService(repository, {
      config: configured,
      getRuntimeStatus: connectedRuntime
    });
    registerLocalAgentAdminStatusRoutes(
      server,
      routeDependencies(async () => ({ user: { id: "auth-helper" } }), service)
    );

    const response = await server.inject({ method: "GET", url: "/admin/local-agent/status" });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ ok: false, reason: "local_agent_forbidden" });
  });

  it("returns the sanitized snapshot for an authenticated owner", async () => {
    const server = Fastify();
    const service = new LocalAgentAdminStatusService(new FakeLocalAgentAdminStatusRepository(), {
      config: configured,
      getRuntimeStatus: connectedRuntime,
      now: () => new Date("2026-08-27T10:01:00.000Z")
    });
    registerLocalAgentAdminStatusRoutes(
      server,
      routeDependencies(async () => ({ user: { id: "auth-owner" } }), service)
    );

    const response = await server.inject({ method: "GET", url: "/admin/local-agent/status" });
    const serialized = response.body;
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      readOnly: true,
      connection: { state: "connected" }
    });
    expect(serialized).not.toContain(configured.token);
    expect(serialized).not.toContain(identity.deviceId);
  });
});
