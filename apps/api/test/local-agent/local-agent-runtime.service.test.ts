import type { AgentIdentity, AgentStatus } from "@maiks-yt/events";
import { describe, expect, it, vi } from "vitest";

import { LocalAgentRuntimeService } from "../../src/local-agent/local-agent-runtime.service.js";

const identity: AgentIdentity = {
  agentId: "maiks-audio-agent",
  deviceId: "aef3d04c-4483-43f5-921c-ff4700a62f70",
  protocolVersion: 1,
  serviceVersion: "test"
};
const status: AgentStatus = {
  startedAt: new Date().toISOString(),
  observedAt: new Date().toISOString(),
  modules: []
};

describe("LocalAgentRuntimeService", () => {
  it("registers one device and issues only advertised commands", () => {
    const runtime = new LocalAgentRuntimeService();
    const send = vi.fn();
    runtime.register({
      capabilities: [{
        id: "vlc-music",
        version: 1,
        actions: ["track.play"],
        availability: "available"
      }],
      identity,
      socket: { close: vi.fn(), send },
      status
    });

    expect(runtime.issueCommand({
      capability: "vlc-music",
      action: "track.play",
      payload: { playbackId: "playback-1" }
    })).toMatchObject({ ok: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(runtime.issueCommand({
      capability: "vlc-music",
      action: "track.delete",
      payload: null
    })).toEqual({ ok: false, reason: "local_agent_capability_unavailable" });
  });

  it("replaces stale sockets and rejects acknowledgements for unknown commands", () => {
    const runtime = new LocalAgentRuntimeService();
    const firstClose = vi.fn();
    runtime.register({ capabilities: [], identity, socket: { close: firstClose, send: vi.fn() }, status });
    runtime.register({ capabilities: [], identity, socket: { close: vi.fn(), send: vi.fn() }, status });

    expect(firstClose).toHaveBeenCalledWith(1012, "replaced_by_reconnect");
    expect(runtime.acknowledge({
      identity,
      acknowledgement: {
        eventId: "missing",
        commandId: "missing",
        status: "succeeded",
        acknowledgedAt: new Date().toISOString(),
        replayed: false
      }
    })).toBe(false);
  });

  it("publishes bounded status and acknowledgement changes to consumers", () => {
    const runtime = new LocalAgentRuntimeService();
    const statusListener = vi.fn();
    const acknowledgementListener = vi.fn();
    runtime.subscribeToStatus(statusListener);
    runtime.subscribeToAcknowledgements(acknowledgementListener);
    runtime.register({
      capabilities: [{
        id: "vlc-music",
        version: 1,
        actions: ["status.get"],
        availability: "available"
      }],
      identity,
      socket: { close: vi.fn(), send: vi.fn() },
      status
    });
    const issued = runtime.issueCommand({
      capability: "vlc-music",
      action: "status.get",
      payload: {}
    });
    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      return;
    }

    runtime.heartbeat({
      identity,
      status: {
        ...status,
        modules: [{
          capabilityId: "vlc-music",
          availability: "available",
          state: { playbackId: "playback-1", status: "ended" }
        }]
      }
    });
    runtime.acknowledge({
      identity,
      acknowledgement: {
        eventId: issued.command.eventId,
        commandId: issued.command.commandId,
        status: "succeeded",
        acknowledgedAt: new Date().toISOString(),
        replayed: false,
        result: { playbackId: "playback-1", status: "playing" }
      }
    });

    expect(statusListener).toHaveBeenLastCalledWith(expect.objectContaining({
      connected: true,
      status: expect.objectContaining({
        modules: [expect.objectContaining({
          state: { playbackId: "playback-1", status: "ended" }
        })]
      })
    }));
    expect(acknowledgementListener).toHaveBeenCalledWith(
      expect.objectContaining({ status: "succeeded" }),
      expect.objectContaining({ action: "status.get" })
    );
  });

  it("expires abandoned commands without waiting for a terminal agent acknowledgement", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T12:00:00.000Z"));
    try {
      const runtime = new LocalAgentRuntimeService();
      const acknowledgementListener = vi.fn();
      runtime.subscribeToAcknowledgements(acknowledgementListener);
      const firstClose = vi.fn();
      runtime.register({
        capabilities: [{
          id: "vlc-music",
          version: 1,
          actions: ["track.play"],
          availability: "available"
        }],
        identity,
        socket: { close: firstClose, send: vi.fn() },
        status
      });

      const issued = runtime.issueCommand({
        capability: "vlc-music",
        action: "track.play",
        expiresAt: "2026-08-27T12:00:15.000Z",
        payload: { playbackId: "playback-1" }
      });
      expect(issued.ok).toBe(true);
      if (!issued.ok) {
        return;
      }
      expect(runtime.getStatus().pendingCommands).toBe(1);
      runtime.register({
        capabilities: [{
          id: "vlc-music",
          version: 1,
          actions: ["track.play"],
          availability: "available"
        }],
        identity,
        socket: { close: vi.fn(), send: vi.fn() },
        status
      });
      expect(firstClose).toHaveBeenCalledWith(1012, "replaced_by_reconnect");
      expect(runtime.getStatus().pendingCommands).toBe(1);

      vi.advanceTimersByTime(15_000);

      expect(runtime.getStatus().pendingCommands).toBe(0);
      expect(acknowledgementListener).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: issued.command.eventId,
          commandId: issued.command.commandId,
          status: "expired",
          error: expect.objectContaining({ code: "COMMAND_EXPIRED" })
        }),
        expect.objectContaining({ action: "track.play" })
      );
      expect(runtime.acknowledge({
        identity,
        acknowledgement: {
          eventId: issued.command.eventId,
          commandId: issued.command.commandId,
          status: "succeeded",
          acknowledgedAt: new Date().toISOString(),
          replayed: false
        }
      })).toBe(true);
      expect(acknowledgementListener).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reschedules command expiry beyond the maximum Node timer delay", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T12:00:00.000Z"));
    try {
      const runtime = new LocalAgentRuntimeService();
      const acknowledgementListener = vi.fn();
      runtime.subscribeToAcknowledgements(acknowledgementListener);
      runtime.register({
        capabilities: [{
          id: "vlc-music",
          version: 1,
          actions: ["track.play"],
          availability: "available"
        }],
        identity,
        socket: { close: vi.fn(), send: vi.fn() },
        status
      });
      const maximumTimerDelayMs = 2_147_483_647;
      const issued = runtime.issueCommand({
        capability: "vlc-music",
        action: "track.play",
        expiresAt: new Date(Date.now() + maximumTimerDelayMs + 1_000).toISOString(),
        payload: { playbackId: "long-lived-command" }
      });

      expect(issued.ok).toBe(true);
      vi.advanceTimersByTime(maximumTimerDelayMs);
      expect(runtime.getStatus().pendingCommands).toBe(1);
      expect(acknowledgementListener).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1_000);
      expect(runtime.getStatus().pendingCommands).toBe(0);
      expect(acknowledgementListener).toHaveBeenCalledWith(
        expect.objectContaining({ status: "expired" }),
        expect.objectContaining({ action: "track.play" })
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
