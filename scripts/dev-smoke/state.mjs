import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

export const readState = async (stateFile) => {
  try {
    return JSON.parse(await readFile(stateFile, "utf8"));
  } catch {
    return {};
  }
};

export const writeState = async (stateFile, state) => {
  await mkdir(dirname(stateFile), { recursive: true });
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
};

export const hashFailures = (failures) => createHash("sha256")
  .update(JSON.stringify(failures.map((failure) => ({
    critical: Boolean(failure.critical),
    message: failure.message,
    name: failure.name
  })).sort((left, right) => left.name.localeCompare(right.name))), "utf8")
  .digest("hex");
