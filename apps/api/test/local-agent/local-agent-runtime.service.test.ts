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
});
