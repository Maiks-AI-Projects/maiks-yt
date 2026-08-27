import { readFile, stat } from "node:fs/promises";

export async function readDeviceCredential(filePath: string): Promise<string> {
  const file = await stat(filePath);
  if (!file.isFile()) {
    throw new Error(`Device credential is not a regular file: ${filePath}`);
  }
  if (process.platform !== "win32" && (file.mode & 0o077) !== 0) {
    throw new Error(`Device credential permissions must be 0600 or stricter: ${filePath}`);
  }
  const credential = (await readFile(filePath, "utf8")).trim();
  if (credential.length < 32 || credential.length > 4_096 || /\s/.test(credential)) {
    throw new Error("Device credential has an invalid format");
  }
  return credential;
}
