import {
  incompetechExpectedTrackCount,
  incompetechManifestVersion,
  incompetechProviderKey,
  validateIncompetechManifest,
  type IncompetechBulkManifest
} from "@maiks-yt/domain/music";

import type { MusicAudioUploadResult, MusicYouTubeAudioLibraryManifest } from "../../../music/music-api.types";

export type ImportAudioFileCandidate = {
  readonly name: string;
  readonly webkitRelativePath?: string;
};

export type ImportAudioUpload = Extract<MusicAudioUploadResult, { ok: true }>["upload"];
export type ImportManifestProvider = "youtube-audio-library" | "incompetech";

export type ManifestTrackWithFileName = MusicYouTubeAudioLibraryManifest["tracks"][number] & {
  readonly fileName?: string | null;
};

export type ManifestWithFileNames = Omit<MusicYouTubeAudioLibraryManifest, "tracks"> & {
  readonly tracks: readonly ManifestTrackWithFileName[];
};

export type PreparedManifestResult =
  | {
    readonly ok: true;
    readonly manifest: MusicYouTubeAudioLibraryManifest;
    readonly uploadedTrackCount: number;
  }
  | {
    readonly ok: false;
    readonly errors: readonly string[];
  };

export type PreparedIncompetechManifestResult =
  | {
    readonly ok: true;
    readonly manifest: IncompetechBulkManifest;
    readonly uploadedTrackCount: number;
  }
  | {
    readonly ok: false;
    readonly errors: readonly string[];
  };

export type IncompetechAudioSelectionReport = {
  readonly duplicates: readonly string[];
  readonly expectedCount: number;
  readonly extra: readonly string[];
  readonly missing: readonly string[];
};

export const expectedIncompetechManifestSha256 = "a9b84960595facde28c3f6b5183b442dfe31168130052bf46a12996841676ce5";

export const safeImportFileName = (value: string): string => {
  const normalized = value.replaceAll("\\", "/").split("/").pop()?.trim() ?? "";
  return normalized.slice(0, 191) || "unnamed-file";
};

const normalizeFileKey = (value: string): string => safeImportFileName(value).toLowerCase();
const musicAudioStorageRefPattern = /^music-audio:([a-f0-9]{64}):[A-Za-z0-9._:-]+$/u;
const safeVocalsClasses = new Set(["none", "minimal"]);
const sha256Mp3FilePattern = /^([a-f0-9]{64})\.mp3$/u;

const normalizeGenre = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 &/-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 80);

  return normalized.length > 0 ? normalized : null;
};

const validatePreparedTrackEvidence = (
  track: ManifestTrackWithFileName,
  index: number
): string | null => {
  const label = `Track ${index + 1}`;
  const sha256 = track.audio?.sha256?.trim().toLowerCase() ?? null;
  const storageRef = track.audio?.storageRef?.trim() ?? null;
  const storageRefMatch = storageRef ? musicAudioStorageRefPattern.exec(storageRef) : null;
  const genre = normalizeGenre(track.genre);

  if (!Number.isInteger(track.durationSeconds) || track.durationSeconds <= 0) {
    return `${label} is missing duration evidence.`;
  }
  if (!track.downloadedAt || !Number.isFinite(Date.parse(track.downloadedAt))) {
    return `${label} is missing download timestamp evidence.`;
  }
  if (!genre || genre !== track.genre) {
    return `${label} is missing normalized genre evidence.`;
  }
  if (!safeVocalsClasses.has(track.vocalsClass)) {
    return `${label} must be instrumental or minimal-vocal.`;
  }
  if (track.liveSafe !== true || track.vodSafe !== true) {
    return `${label} must be live-safe and VOD-safe.`;
  }
  if (!sha256 || !storageRefMatch || storageRefMatch[1] !== sha256 || !track.audio?.mimeType?.startsWith("audio/")) {
    return `${label} is missing deterministic uploaded audio evidence.`;
  }
  if (!track.attributionRequired || !track.attributionText?.trim()) {
    return `${label} is missing attribution evidence.`;
  }
  if (!track.proof?.url || !track.studioEvidence?.proofUrl || track.proof.url !== track.studioEvidence.proofUrl) {
    return `${label} is missing item proof evidence.`;
  }

  return null;
};

export const indexAudioFilesByName = <TFile extends ImportAudioFileCandidate>(
  files: readonly TFile[]
): Map<string, TFile> => {
  const indexed = new Map<string, TFile>();

  for (const file of files) {
    indexed.set(normalizeFileKey(file.name), file);
  }

  return indexed;
};

const normalizeRelativeFilePath = (value: string | undefined): string | null => {
  const normalized = value?.replaceAll("\\", "/").trim() ?? "";
  return normalized.length > 0 ? normalized.toLowerCase() : null;
};

const incompetechAudioExpectation = (track: IncompetechBulkManifest["tracks"][number]): {
  readonly fileName: string;
  readonly key: string;
  readonly relativeTail: string;
  readonly sha256: string;
} | null => {
  const sha256 = track.audio?.sha256?.trim().toLowerCase() ?? "";
  const genre = track.normalizedGenre?.trim().toLowerCase() ?? "";

  if (!sha256Mp3FilePattern.test(`${sha256}.mp3`) || !genre) {
    return null;
  }

  return {
    fileName: `${sha256}.mp3`,
    key: sha256,
    relativeTail: `library/${genre}/${sha256}.mp3`,
    sha256
  };
};

const candidateHashKey = (file: ImportAudioFileCandidate): string | null => {
  const fileName = normalizeFileKey(file.name);
  const nameMatch = sha256Mp3FilePattern.exec(fileName);
  if (nameMatch) {
    return nameMatch[1] ?? null;
  }

  const relativePath = normalizeRelativeFilePath(file.webkitRelativePath);
  const relativeName = relativePath?.split("/").pop() ?? null;
  const relativeMatch = relativeName ? sha256Mp3FilePattern.exec(relativeName) : null;

  return relativeMatch?.[1] ?? null;
};

export const analyzeIncompetechAudioSelection = (
  manifest: IncompetechBulkManifest,
  files: readonly ImportAudioFileCandidate[]
): IncompetechAudioSelectionReport => {
  const expected = manifest.tracks
    .map(incompetechAudioExpectation)
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const expectedByHash = new Map(expected.map((item) => [item.key, item]));
  const seenByHash = new Map<string, string[]>();
  const missing = new Set(expected.map((item) => item.fileName));
  const extra: string[] = [];

  for (const file of files) {
    const safeName = safeImportFileName(file.name);
    const hashKey = candidateHashKey(file);
    const expectation = hashKey ? expectedByHash.get(hashKey) : undefined;
    const relativePath = normalizeRelativeFilePath(file.webkitRelativePath);
    const relativeMatches = !relativePath
      || relativePath.endsWith(expectation?.relativeTail ?? "\0");

    if (!hashKey || !expectation || !relativeMatches) {
      extra.push(safeName);
      continue;
    }

    missing.delete(expectation.fileName);
    seenByHash.set(hashKey, [...seenByHash.get(hashKey) ?? [], safeName]);
  }

  return {
    duplicates: [...seenByHash.values()]
      .filter((names) => names.length > 1)
      .map((names) => names[0] ?? "duplicate audio"),
    expectedCount: expected.length,
    extra,
    missing: [...missing]
  };
};

export const getManifestAudioFileNames = (
  manifest: ManifestWithFileNames
): readonly string[] => [...new Set(manifest.tracks
  .map((track) => track.fileName?.trim() ?? "")
  .filter(Boolean)
  .map(safeImportFileName))];

export const findMissingAudioFiles = (
  manifest: ManifestWithFileNames,
  files: readonly ImportAudioFileCandidate[]
): readonly string[] => {
  const indexedFiles = indexAudioFilesByName(files);

  return getManifestAudioFileNames(manifest)
    .filter((fileName) => !indexedFiles.has(normalizeFileKey(fileName)));
};

export const buildPreparedManifest = (
  manifest: ManifestWithFileNames,
  uploadsByFileName: ReadonlyMap<string, ImportAudioUpload>
): PreparedManifestResult => {
  const errors: string[] = [];
  let uploadedTrackCount = 0;
  const tracks = manifest.tracks.map((track, index) => {
    const fileName = track.fileName?.trim();
    let nextTrack: ManifestTrackWithFileName = track;
    let uploadError = false;

    if (!fileName) {
      const evidenceError = validatePreparedTrackEvidence(nextTrack, index);
      if (evidenceError) {
        errors.push(evidenceError);
      }
      return nextTrack;
    }

    const safeFileName = safeImportFileName(fileName);
    const upload = uploadsByFileName.get(normalizeFileKey(safeFileName));

    if (!upload) {
      errors.push(`Missing upload for ${safeFileName}.`);
      uploadError = true;
    } else {
      const expectedSha = track.audio?.sha256?.trim().toLowerCase() ?? null;
      if (expectedSha && expectedSha !== upload.sha256.toLowerCase()) {
        errors.push(`Checksum mismatch for ${safeFileName}.`);
        uploadError = true;
      } else {
        uploadedTrackCount += 1;
        nextTrack = {
          ...track,
          audio: {
            storageRef: upload.storageRef,
            sha256: upload.sha256,
            mimeType: upload.contentType
          }
        };
      }
    }

    const evidenceError = uploadError ? null : validatePreparedTrackEvidence(nextTrack, index);
    if (evidenceError) {
      errors.push(evidenceError);
    }

    return nextTrack;
  });

  if (errors.length > 0) {
    return {
      ok: false,
      errors
    };
  }

  return {
    ok: true,
    manifest: {
      ...manifest,
      tracks
    },
    uploadedTrackCount
  };
};

export const buildPreparedIncompetechManifest = (
  manifest: IncompetechBulkManifest,
  uploadsBySha256: ReadonlyMap<string, ImportAudioUpload>
): PreparedIncompetechManifestResult => {
  const errors: string[] = [];

  if (manifest.manifestVersion !== incompetechManifestVersion || manifest.source !== incompetechProviderKey) {
    errors.push("Manifest must be a typed Incompetech CC BY 4.0 export.");
  }
  if (manifest.tracks.length !== incompetechExpectedTrackCount) {
    errors.push(`Incompetech manifest must contain exactly ${incompetechExpectedTrackCount} tracks.`);
  }

  let uploadedTrackCount = 0;
  for (const track of manifest.tracks) {
    const expected = incompetechAudioExpectation(track);
    if (!expected) {
      errors.push(`Track ${track.title || track.externalId || "unknown"} is missing SHA-256 MP3 audio evidence.`);
      continue;
    }

    const upload = uploadsBySha256.get(expected.sha256);
    if (!upload) {
      errors.push(`Missing upload for ${expected.fileName}.`);
      continue;
    }
    if (upload.sha256.toLowerCase() !== expected.sha256 || upload.contentType !== "audio/mpeg") {
      errors.push(`Uploaded audio evidence does not match ${expected.fileName}.`);
      continue;
    }

    uploadedTrackCount += 1;
  }

  const validation = validateIncompetechManifest(manifest);
  if (!validation.ok) {
    errors.push(`Incompetech manifest rejected: ${validation.reason}.`);
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors
    };
  }

  return {
    ok: true,
    manifest,
    uploadedTrackCount
  };
};

export const hasUnsavedImportSelection = (input: {
  readonly applied: boolean;
  readonly audioFileCount: number;
  readonly manifestSelected: boolean;
  readonly prepared: boolean;
}): boolean =>
  !input.applied && (input.manifestSelected || input.audioFileCount > 0);

export const summarizeImportCounts = (summary: {
  readonly accepted: number;
  readonly created: number;
  readonly licenseSnapshotsAppended?: number;
  readonly markedUnavailable?: number;
  readonly rejected: number;
  readonly received: number;
  readonly unchanged: number;
  readonly updated: number;
}): string =>
  `${summary.accepted}/${summary.received} accepted, ${summary.rejected} rejected, ${summary.created} created, ${summary.updated} updated, ${summary.unchanged} unchanged, ${summary.markedUnavailable ?? 0} unavailable, ${summary.licenseSnapshotsAppended ?? 0} snapshots`;
