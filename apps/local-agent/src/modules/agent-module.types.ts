import type {
  CapabilityRegistration,
  CommandEnvelope,
  JsonValue,
  ModuleStatus
} from "../protocol/agent-protocol.types.js";

export type ModuleContext = {
  signal: AbortSignal;
  reportStatus: () => void;
};

export type ModuleExecutionContext = {
  signal: AbortSignal;
};

export interface AgentModule {
  readonly capabilityId: string;
  start(context: ModuleContext): Promise<void>;
  stop(): Promise<void>;
  getCapability(): CapabilityRegistration;
  getStatus(): ModuleStatus;
  execute(command: CommandEnvelope, context: ModuleExecutionContext): Promise<JsonValue>;
}

export class ModuleCommandError extends Error {
  readonly code: string;
  readonly retriable: boolean;

  constructor(code: string, message: string, retriable = false) {
    super(message);
    this.name = "ModuleCommandError";
    this.code = code;
    this.retriable = retriable;
  }
}
