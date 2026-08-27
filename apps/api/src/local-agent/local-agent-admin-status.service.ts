import type {
  CapabilityAvailability,
  CapabilityRegistration,
  JsonValue,
  ModuleStatus
} from "@maiks-yt/events";

import type {
  LocalAgentAdminConfigurationIssue,
  LocalAgentAdminConnectionState,
  LocalAgentAdminModuleStatus,
  LocalAgentAdminStatusOptions,
  LocalAgentAdminStatusRepository,
  LocalAgentAdminStatusResult,
  LocalAgentAdminVlcState
} from "./local-agent-admin-status.types.js";

const defaultStaleAfterMs = 60_000;

const parsePermissionArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const hasOwnerWildcard = (values: readonly unknown[]): boolean =>
  values.some((value) => parsePermissionArray(value).includes("*"));

const isRecord = (value: JsonValue | undefined): value is Readonly<Record<string, JsonValue>> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const asBoundedNumber = (value: JsonValue | undefined, min: number, max: number): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;

const vlcPlaybackStatuses = new Set([
  "idle",
  "loading",
  "playing",
  "paused",
  "stopped",
  "ended",
  "error"
]);

const projectVlcState = (state: JsonValue | undefined): LocalAgentAdminVlcState | null => {
  if (!isRecord(state)) {
    return null;
  }

  const playbackId = state.playbackId;
  const playbackStatus = typeof state.status === "string" && vlcPlaybackStatuses.has(state.status)
    ? state.status as LocalAgentAdminVlcState["playbackStatus"]
    : null;

  return {
    hasPlayback: typeof playbackId === "string" && playbackId.length > 0,
    playbackStatus,
    positionSeconds: asBoundedNumber(state.positionSeconds, 0, 24 * 60 * 60),
    volumePercent: asBoundedNumber(state.volumePercent, 0, 100)
  };
};

const availabilityRank: Record<CapabilityAvailability, number> = {
  available: 0,
  degraded: 1,
  unavailable: 2
};

const leastAvailable = (
  advertised: CapabilityAvailability,
  runtime: CapabilityAvailability | undefined
): CapabilityAvailability => {
  if (!runtime) {
    return advertised;
  }

  return availabilityRank[runtime] > availabilityRank[advertised] ? runtime : advertised;
};

const projectModule = (
  capability: CapabilityRegistration,
  runtimeModule: ModuleStatus | undefined
): LocalAgentAdminModuleStatus => ({
  actions: [...capability.actions].sort(),
  availability: leastAvailable(capability.availability, runtimeModule?.availability),
  id: capability.id,
  version: capability.version,
  vlc: capability.id === "vlc-music" ? projectVlcState(runtimeModule?.state) : null
});

const getConfigurationIssues = (
  options: LocalAgentAdminStatusOptions
): LocalAgentAdminConfigurationIssue[] => {
  const issues: LocalAgentAdminConfigurationIssue[] = [];
  if (!options.config.token) {
    issues.push("credential_missing_or_invalid");
  }
  if (!options.config.expectedDeviceId) {
    issues.push("device_identity_missing_or_invalid");
  }
  return issues;
};

const getConnectionState = (input: {
  configured: boolean;
  connected: boolean;
  lastSeenAt: string | null;
  modules: readonly LocalAgentAdminModuleStatus[];
  now: Date;
  staleAfterMs: number;
}): LocalAgentAdminConnectionState => {
  if (!input.configured) {
    return "not_configured";
  }
  if (!input.connected) {
    return "disconnected";
  }

  const lastSeenMs = input.lastSeenAt ? Date.parse(input.lastSeenAt) : Number.NaN;
  const isStale = !Number.isFinite(lastSeenMs)
    || input.now.getTime() - lastSeenMs > input.staleAfterMs;
  const hasModuleProblem = input.modules.some((module) => module.availability !== "available");
  return isStale || hasModuleProblem ? "degraded" : "connected";
};

export class LocalAgentAdminStatusService {
  public constructor(
    private readonly repository: LocalAgentAdminStatusRepository,
    private readonly options: LocalAgentAdminStatusOptions
  ) {}

  public async getStatus(input: { authUserId: string }): Promise<LocalAgentAdminStatusResult> {
    const actor = await this.repository.resolveActor(input.authUserId);
    if (!actor) {
      return { ok: false, reason: "local_agent_user_unlinked" };
    }
    if (!hasOwnerWildcard(actor.rolePermissionValues)) {
      return { ok: false, reason: "local_agent_forbidden" };
    }

    const now = this.options.now?.() ?? new Date();
    const runtime = this.options.getRuntimeStatus();
    const modules = runtime.capabilities
      .map((capability) => projectModule(
        capability,
        runtime.status?.modules.find((module) => module.capabilityId === capability.id)
      ))
      .sort((left, right) => left.id.localeCompare(right.id));

    return {
      ok: true,
      readOnly: true,
      generatedAt: now.toISOString(),
      configuration: {
        configured: this.options.config.configured,
        issues: getConfigurationIssues(this.options)
      },
      connection: {
        state: getConnectionState({
          configured: this.options.config.configured,
          connected: runtime.connected,
          lastSeenAt: runtime.lastSeenAt,
          modules,
          now,
          staleAfterMs: this.options.staleAfterMs ?? defaultStaleAfterMs
        }),
        protocolVersion: runtime.identity?.protocolVersion ?? null,
        serviceVersion: runtime.identity?.serviceVersion ?? null,
        connectedAt: runtime.connectedAt,
        lastSeenAt: runtime.lastSeenAt
      },
      modules
    };
  }
}
