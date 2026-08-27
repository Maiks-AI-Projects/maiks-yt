import type { AgentModule, ModuleExecutionContext } from "../agent-module.types.js";
import type { JsonValue } from "../../protocol/agent-protocol.types.js";

export const COUNTDOWN_CAPABILITY = "countdown" as const;

export type CountdownCommand =
  | { action: "start"; countdownId: string; durationMs: number; label?: string }
  | { action: "pause"; countdownId: string }
  | { action: "resume"; countdownId: string }
  | { action: "cancel"; countdownId: string }
  | { action: "set"; countdownId: string; remainingMs: number };

export interface CountdownModule extends AgentModule {
  readonly capabilityId: typeof COUNTDOWN_CAPABILITY;
  executeCountdown(command: CountdownCommand, context: ModuleExecutionContext): Promise<JsonValue>;
}
