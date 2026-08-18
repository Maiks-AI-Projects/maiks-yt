import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseBuffer } from "music-metadata";

import { requireMusicManageActor } from "./music-service-authorization.service.js";
import type { MusicRepository } from "./music.types.js";
import type { MusicAudioUploadResult } from "./music-youtube-audio-library-import.types.js";

export const musicAudioUploadMaxBytes = 75 * 1024 * 1024;

const musicAudioStorageDir = path.resolve(
  process.env.MUSIC_AUDIO_STORAGE_DIR ?? path.join(process.cwd(), ".private", "music-audio")
);

const allowedAudioContentTypes = new Set([
  "audio/aac",
  "audio/flac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/vnd.wave",
  "audio/wav",
  "audio/webm",
  "audio/x-wav"
]);

const musicAudioStorageRefPattern = /^music-audio:([a-f0-9]{64}):[A-Za-z0-9._:-]+$/u;

type MusicAudioUploadMetadata = {
  sha256: string;
  filename: string;
  contentType: string;
  detectedFormat: string | null;
  durationSeconds: number | null;
  sizeBytes: number;
  uploadedAt: string;
  uploadedByUserId: string;
};

const normalizeAudioFilename = (value: string): string => {
  const cleaned = value
    .trim()
    .replaceAll("\\", "/")
    .split("/")
    .pop()
    ?.replace(/[^A-Za-z0-9._ -]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120)
    .trim();

  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : "music-audio";
};

const getAudioUploadPaths = (sha256: string): {
  filePath: string;
  metadataPath: string;
} => ({
  filePath: path.join(musicAudioStorageDir, `${sha256}.bin`),
  metadataPath: path.join(musicAudioStorageDir, `${sha256}.json`)
});

export const parseMusicAudioStorageRef = (storageRef: string): { sha256: string } | null => {
  const match = musicAudioStorageRefPattern.exec(storageRef.trim());
  const sha256 = match?.[1];
  return sha256 ? { sha256 } : null;
};

const normalizeDetectedAudioMime = (containerValue: string | undefined): string | null => {
  const container = containerValue?.trim().toLowerCase();
  if (container === "wave" || container === "wav") {
    return "audio/wav";
  }
  if (container === "mpeg" || container === "mp3") {
    return "audio/mpeg";
  }
  if (container === "flac") {
    return "audio/flac";
  }
  if (container === "ogg" || container === "opus") {
    return "audio/ogg";
  }
  if (container === "mp4" || container === "m4a") {
    return "audio/mp4";
  }
  if (container === "webm") {
    return "audio/webm";
  }
  return null;
};

const isCredibleDuration = (value: number | undefined): boolean =>
  value === undefined || (Number.isFinite(value) && value > 0 && value <= 24 * 60 * 60);

const detectAudio = async (
  bytes: Buffer
): Promise<{
  contentType: string;
  detectedFormat: string | null;
  durationSeconds: number | null;
} | null> => {
  try {
    const metadata = await parseBuffer(bytes);
    const contentType = normalizeDetectedAudioMime(metadata.format.container);

    if (!contentType
      || !metadata.format.container
      || metadata.format.hasAudio !== true
      || metadata.format.hasVideo === true
      || !isCredibleDuration(metadata.format.duration)) {
      return null;
    }

    return {
      contentType,
      detectedFormat: metadata.format.container,
      durationSeconds: metadata.format.duration === undefined ? null : Math.max(1, Math.round(metadata.format.duration))
    };
  } catch {
    return null;
  }
};

const parseStoredMetadata = (value: string): MusicAudioUploadMetadata | null => {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const metadata = parsed as Partial<MusicAudioUploadMetadata>;

    return typeof metadata.sha256 === "string"
      && typeof metadata.filename === "string"
      && typeof metadata.contentType === "string"
      && (typeof metadata.detectedFormat === "string" || metadata.detectedFormat === null)
      && (typeof metadata.durationSeconds === "number" || metadata.durationSeconds === null)
      && typeof metadata.sizeBytes === "number"
      && typeof metadata.uploadedAt === "string"
      && typeof metadata.uploadedByUserId === "string"
      ? metadata as MusicAudioUploadMetadata
      : null;
  } catch {
    return null;
  }
};

export class MusicAudioUploadService {
  public constructor(private readonly authRepository: Pick<MusicRepository, "resolveActor">) {}

  public async upload(input: {
    authUserId: string;
    filename: string;
    contentType: string;
    dataBase64: string;
  }): Promise<MusicAudioUploadResult> {
    const actor = await requireMusicManageActor(this.authRepository, input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const contentType = input.contentType.trim().toLowerCase();
    if (!allowedAudioContentTypes.has(contentType) || input.dataBase64.trim().length === 0) {
      return {
        ok: false,
        reason: "music_audio_upload_invalid_input"
      };
    }

    const bytes = Buffer.from(input.dataBase64, "base64");
    const normalizedBase64 = bytes.toString("base64").replace(/=+$/u, "");
    const providedBase64 = input.dataBase64.trim().replace(/=+$/u, "");

    if (bytes.length === 0 || bytes.length > musicAudioUploadMaxBytes || normalizedBase64 !== providedBase64) {
      return {
        ok: false,
        reason: "music_audio_upload_invalid_input"
      };
    }

    const detectedAudio = await detectAudio(bytes);
    if (!detectedAudio) {
      return {
        ok: false,
        reason: "music_audio_upload_invalid_input"
      };
    }

    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const filename = normalizeAudioFilename(input.filename);
    const paths = getAudioUploadPaths(sha256);
    const metadata: MusicAudioUploadMetadata = {
      sha256,
      filename,
      contentType: detectedAudio.contentType,
      detectedFormat: detectedAudio.detectedFormat,
      durationSeconds: detectedAudio.durationSeconds,
      sizeBytes: bytes.length,
      uploadedAt: new Date().toISOString(),
      uploadedByUserId: actor.domainUserId
    };

    await mkdir(musicAudioStorageDir, { recursive: true, mode: 0o700 });

    try {
      const [existingMetadata, existingBytes] = await Promise.all([
        readFile(paths.metadataPath, "utf8"),
        readFile(paths.filePath)
      ]);
      const parsed = parseStoredMetadata(existingMetadata);

      if (parsed?.sha256 === sha256 && existingBytes.length === bytes.length) {
        return {
          ok: true,
          upload: {
            storageRef: `music-audio:${sha256}:${parsed.filename}`,
            filename: parsed.filename,
            contentType: parsed.contentType,
            sizeBytes: parsed.sizeBytes,
            sha256
          }
        };
      }
    } catch {
      // A missing prior upload just means this checksum is new to local storage.
    }

    await writeFile(paths.filePath, bytes, { mode: 0o600 });
    await writeFile(paths.metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });

    return {
      ok: true,
        upload: {
          storageRef: `music-audio:${sha256}:${filename}`,
          filename,
        contentType: detectedAudio.contentType,
          sizeBytes: bytes.length,
          sha256
        }
    };
  }
}

export class MusicAudioStorageVerificationService {
  public async verify(input: {
    storageRef: string;
    sha256: string;
  }): Promise<
    | {
      ok: true;
      contentType: string;
    }
    | {
      ok: false;
    }
  > {
    const parsed = parseMusicAudioStorageRef(input.storageRef);
    if (!parsed || parsed.sha256 !== input.sha256) {
      return {
        ok: false
      };
    }

    try {
      const bytes = await readFile(getAudioUploadPaths(parsed.sha256).filePath);
      const detectedAudio = await detectAudio(bytes);
      if (!detectedAudio || createHash("sha256").update(bytes).digest("hex") !== input.sha256) {
        return {
          ok: false
        };
      }

      return {
        ok: true,
        contentType: detectedAudio.contentType
      };
    } catch {
      return {
        ok: false
      };
    }
  }
}
