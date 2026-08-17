import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import sharp from "sharp";

export const profileImageMaxInputBytes = 5 * 1024 * 1024;
export const profileImageOutputSize = 512;

const profileImageStorageDirectory = process.env.PROFILE_IMAGE_STORAGE_DIR
  ?? "/tmp/maiks-yt-profile-images";

const isCanonicalBase64 = (value: string, bytes: Buffer): boolean =>
  bytes.toString("base64").replace(/=+$/u, "") === value.trim().replace(/=+$/u, "");

const getProfileImagePath = (userId: string): string => join(profileImageStorageDirectory, `${userId}.webp`);

export const processProfileImage = async (dataBase64: string): Promise<Buffer | null> => {
  const bytes = Buffer.from(dataBase64.trim(), "base64");

  if (
    bytes.length === 0
    || bytes.length > profileImageMaxInputBytes
    || !isCanonicalBase64(dataBase64, bytes)
  ) {
    return null;
  }

  try {
    return await sharp(bytes, { failOn: "warning", limitInputPixels: 40_000_000 })
      .rotate()
      .resize(profileImageOutputSize, profileImageOutputSize, {
        fit: "cover",
        position: "attention"
      })
      .webp({ quality: 84, effort: 4 })
      .toBuffer();
  } catch {
    return null;
  }
};

export const saveProfileImage = async (userId: string, bytes: Buffer): Promise<void> => {
  await mkdir(profileImageStorageDirectory, { recursive: true, mode: 0o700 });
  const destination = getProfileImagePath(userId);
  const temporary = `${destination}.${randomUUID()}.tmp`;

  await writeFile(temporary, bytes, { mode: 0o600 });
  await rename(temporary, destination);
};

export const readProfileImage = async (userId: string): Promise<Buffer | null> => {
  try {
    return await readFile(getProfileImagePath(userId));
  } catch {
    return null;
  }
};

export const deleteProfileImage = async (userId: string): Promise<void> => {
  await rm(getProfileImagePath(userId), { force: true });
};
