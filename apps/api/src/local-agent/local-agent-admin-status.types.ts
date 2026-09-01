import { LOCAL_AGENT_PROTOCOL_VERSION } from "@maiks-yt/events";
import type { CapabilityAvailability, LocalAgentAudioRouteId, LocalAgentAudioRouteStatus } from "@maiks-yt/events";

import type { LocalAgentRuntimeStatus } from "./local-agent-runtime.service.js";

export type LocalAgentAdminStatusActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export interface LocalAgentAdminStatusRepository {
  resolveActor(authUserId: string): Promise<LocalAgentAdminStatusActor | null>;
}

export type LocalAgentAdminConfigurationIssue =
  | "credential_missing_or_invalid"
  | "device_identity_missing_or_invalid";

export type LocalAgentAdminConnectionState =
  | "not_configured"
  | "disconnected"
  | "connected"
  | "degraded";

export type LocalAgentAdminVlcState = {
  activeAudioRouteId: LocalAgentAudioRouteId;
  hasPlayback: boolean;
  playbackStatus: "idle" | "loading" | "playing" | "paused" | "stopped" | "ended" | "error" | null;
  positionSeconds: number | null;
  routes: readonly LocalAgentAudioRouteStatus[];
  volumePercent: number | null;
};

export type LocalAgentAdminModuleStatus = {
  actions: readonly string[];
  availability: CapabilityAvailability;
  id: string;
  version: number;
  vlc: LocalAgentAdminVlcState | null;
};

export type LocalAgentAdminStatusSnapshot = {
  ok: true;
  readOnly: true;
  generatedAt: string;
  configuration: {
    configured: boolean;
    issues: readonly LocalAgentAdminConfigurationIssue[];
  };
  connection: {
    state: LocalAgentAdminConnectionState;
    protocolVersion: typeof LOCAL_AGENT_PROTOCOL_VERSION | null;
    serviceVersion: string | null;
    connectedAt: string | null;
    lastSeenAt: string | null;
  };
  modules: readonly LocalAgentAdminModuleStatus[];
};

export type LocalAgentAdminStatusResult =
  | LocalAgentAdminStatusSnapshot
  | {
    ok: false;
    reason: "local_agent_user_unlinked" | "local_agent_forbidden";
  };

export type LocalAgentAdminStatusOptions = {
  config: {
    configured: boolean;
    expectedDeviceId: string | null;
    token: string | null;
  };
  getRuntimeStatus: () => LocalAgentRuntimeStatus;
  now?: () => Date;
  staleAfterMs?: number;
};
