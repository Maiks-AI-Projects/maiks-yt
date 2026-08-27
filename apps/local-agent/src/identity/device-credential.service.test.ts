import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readDeviceCredential } from "./device-credential.service.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {
    force: true,
    recursive: true
  })));
});

describe("readDeviceCredential", () => {
  it("reads a private device token without returning its newline", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maiks-local-agent-credential-"));
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, "device-token");
    const token = "device_test_012345678901234567890123456789";
    await writeFile(filePath, `${token}\n`, { encoding: "utf8", mode: 0o600 });

    await expect(readDeviceCredential(filePath)).resolves.toBe(token);
  });

  it.runIf(process.platform !== "win32")("rejects group/world-readable credentials", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "maiks-local-agent-credential-"));
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, "device-token");
    await writeFile(filePath, "device_test_012345678901234567890123456789", "utf8");
    await chmod(filePath, 0o644);

    await expect(readDeviceCredential(filePath)).rejects.toThrow("0600 or stricter");
  });
});
