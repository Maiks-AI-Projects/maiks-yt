import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { EventId } from "../protocol/agent-protocol.types.js";
import type {
  AgentState,
  AgentStateStore,
  PersistedAcknowledgement
} from "./agent-state.types.js";

const MAX_COMPLETED_EVENTS = 2_048;

const acknowledgementSchema = z.object({
  eventId: z.string().min(1).max(128),
  commandId: z.string().min(1).max(128),
  status: z.enum(["succeeded", "failed", "rejected", "expired"]),
  acknowledgedAt: z.iso.datetime({ offset: true }),
  replayed: z.boolean(),
  result: z.json().optional(),
  error: z.object({
    code: z.string().min(1).max(128),
    message: z.string().min(1).max(500),
    retriable: z.boolean()
  }).strict().optional()
}).strict();

const stateSchema = z.object({
  schemaVersion: z.literal(1),
  deviceId: z.uuid(),
  completedEvents: z.record(z.string(), acknowledgementSchema)
}).strict();

export class FileAgentStateStore implements AgentStateStore {
  readonly #filePath: string;
  #state: AgentState;
  #writeQueue: Promise<void> = Promise.resolve();

  private constructor(filePath: string, state: AgentState) {
    this.#filePath = filePath;
    this.#state = state;
  }

  static async open(filePath: string): Promise<FileAgentStateStore> {
    try {
      const contents = await readFile(filePath, "utf8");
      return new FileAgentStateStore(filePath, stateSchema.parse(JSON.parse(contents)));
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw new Error(`Unable to load local-agent state from ${filePath}`, { cause: error });
      }
      const store = new FileAgentStateStore(filePath, {
        schemaVersion: 1,
        deviceId: randomUUID(),
        completedEvents: {}
      });
      await store.#persist();
      return store;
    }
  }

  getDeviceId(): string {
    return this.#state.deviceId;
  }

  getAcknowledgement(eventId: EventId): PersistedAcknowledgement | undefined {
    return this.#state.completedEvents[eventId];
  }

  async recordAcknowledgement(acknowledgement: PersistedAcknowledgement): Promise<void> {
    const operation = this.#writeQueue.then(async () => {
      this.#state.completedEvents[acknowledgement.eventId] = acknowledgement;
      this.#prune();
      await this.#persist();
    });
    this.#writeQueue = operation.catch(() => undefined);
    return operation;
  }

  #prune(): void {
    const entries = Object.entries(this.#state.completedEvents);
    if (entries.length <= MAX_COMPLETED_EVENTS) {
      return;
    }
    entries.sort((left, right) => left[1].acknowledgedAt.localeCompare(right[1].acknowledgedAt));
    this.#state.completedEvents = Object.fromEntries(entries.slice(-MAX_COMPLETED_EVENTS));
  }

  async #persist(): Promise<void> {
    const directory = path.dirname(this.#filePath);
    const temporaryPath = `${this.#filePath}.${process.pid}.tmp`;
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const handle = await open(temporaryPath, "w", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(this.#state, null, 2)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporaryPath, this.#filePath);
  }
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
