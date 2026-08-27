import { homedir } from "node:os";
import path from "node:path";
import { z } from "zod";

export type LocalAgentConfig = {
  agentId: string;
  credentialFile: string;
  heartbeatIntervalMs: number;
  reconnectBaseMs: number;
  reconnectMaxMs: number;
  stateFile: string;
  url: URL;
};

const agentIdSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9._:-]+$/);

function parseInteger(value: string | undefined, fallback: number, minimum: number): number {
  const parsed = value === undefined ? fallback : Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error(`Expected an integer of at least ${minimum}, received ${value ?? "undefined"}`);
  }
  return parsed;
}

function defaultStateFile(): string {
  const stateHome = process.env.XDG_STATE_HOME ?? path.join(homedir(), ".local", "state");
  return path.join(stateHome, "maiks-yt", "local-agent", "state.json");
}

function defaultCredentialFile(): string {
  const credentialsDirectory = process.env.CREDENTIALS_DIRECTORY;
  if (credentialsDirectory) {
    return path.join(credentialsDirectory, "maiks-local-agent-token");
  }
  const configHome = process.env.XDG_CONFIG_HOME ?? path.join(homedir(), ".config");
  return path.join(configHome, "maiks-yt", "local-agent", "device-token");
}

function parseOutboundUrl(value: string | undefined): URL {
  if (!value) {
    throw new Error("MAIKS_LOCAL_AGENT_URL is required");
  }
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("MAIKS_LOCAL_AGENT_URL must not contain credentials, query parameters, or a fragment");
  }
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (url.protocol !== "wss:" && !(url.protocol === "ws:" && loopbackHosts.has(url.hostname))) {
    throw new Error("MAIKS_LOCAL_AGENT_URL must use wss, except for a loopback-only ws development endpoint");
  }
  return url;
}

export function loadLocalAgentConfig(): LocalAgentConfig {
  const reconnectBaseMs = parseInteger(process.env.MAIKS_LOCAL_AGENT_RECONNECT_BASE_MS, 1_000, 100);
  const reconnectMaxMs = parseInteger(process.env.MAIKS_LOCAL_AGENT_RECONNECT_MAX_MS, 30_000, reconnectBaseMs);
  return {
    agentId: agentIdSchema.parse(process.env.MAIKS_LOCAL_AGENT_ID ?? "maiks-audio-agent"),
    credentialFile: path.resolve(process.env.MAIKS_LOCAL_AGENT_CREDENTIAL_FILE ?? defaultCredentialFile()),
    heartbeatIntervalMs: parseInteger(process.env.MAIKS_LOCAL_AGENT_HEARTBEAT_MS, 15_000, 1_000),
    reconnectBaseMs,
    reconnectMaxMs,
    stateFile: path.resolve(process.env.MAIKS_LOCAL_AGENT_STATE_FILE ?? defaultStateFile()),
    url: parseOutboundUrl(process.env.MAIKS_LOCAL_AGENT_URL)
  };
}
