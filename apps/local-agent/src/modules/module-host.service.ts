import type {
  CapabilityRegistration,
  CommandEnvelope,
  JsonValue,
  ModuleStatus
} from "../protocol/agent-protocol.types.js";
import { ModuleCommandError, type AgentModule } from "./agent-module.types.js";

export class ModuleHost {
  readonly #modules: Map<string, AgentModule>;
  readonly #startedModules: AgentModule[] = [];

  constructor(modules: readonly AgentModule[]) {
    this.#modules = new Map();
    for (const module of modules) {
      if (this.#modules.has(module.capabilityId)) {
        throw new Error(`Duplicate module capability: ${module.capabilityId}`);
      }
      this.#modules.set(module.capabilityId, module);
    }
  }

  async start(signal: AbortSignal): Promise<void> {
    try {
      for (const module of this.#modules.values()) {
        await module.start({ signal });
        this.#startedModules.push(module);
      }
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop(): Promise<void> {
    const failures: unknown[] = [];
    for (const module of this.#startedModules.splice(0).reverse()) {
      try {
        await module.stop();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, "One or more local-agent modules failed to stop");
    }
  }

  getCapabilities(): readonly CapabilityRegistration[] {
    return [...this.#modules.values()].map((module) => module.getCapability());
  }

  getStatuses(): readonly ModuleStatus[] {
    return [...this.#modules.values()].map((module) => module.getStatus());
  }

  async execute(command: CommandEnvelope, signal: AbortSignal): Promise<JsonValue> {
    const module = this.#modules.get(command.capability);
    if (!module) {
      throw new ModuleCommandError(
        "CAPABILITY_NOT_REGISTERED",
        `Capability ${command.capability} is not registered`
      );
    }
    return module.execute(command, { signal });
  }
}
