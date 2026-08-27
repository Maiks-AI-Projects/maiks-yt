import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileAgentStateStore } from "./file-agent.state.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {
    force: true,
    recursive: true
  })));
});

describe("FileAgentStateStore", () => {
  it("persists a stable device identity and terminal acknowledgement", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maiks-local-agent-state-"));
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, "nested", "state.json");
    const first = await FileAgentStateStore.open(filePath);
    await first.recordAcknowledgement({
      eventId: "event-1",
      commandId: "command-1",
      status: "succeeded",
      acknowledgedAt: new Date().toISOString(),
      replayed: false,
      result: { ok: true }
    });

    const second = await FileAgentStateStore.open(filePath);
    expect(second.getDeviceId()).toBe(first.getDeviceId());
    expect(second.getAcknowledgement("event-1")).toMatchObject({
      commandId: "command-1",
      status: "succeeded"
    });
    expect(JSON.parse(await readFile(filePath, "utf8"))).not.toHaveProperty("credential");
  });

  it("fails closed on corrupt state instead of losing dedupe history", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maiks-local-agent-state-"));
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, "state.json");
    await import("node:fs/promises").then(({ writeFile }) => writeFile(filePath, "not json", "utf8"));

    await expect(FileAgentStateStore.open(filePath)).rejects.toThrow("Unable to load local-agent state");
  });
});
