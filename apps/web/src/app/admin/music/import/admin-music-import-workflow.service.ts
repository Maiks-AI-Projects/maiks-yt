import type { MusicAudioUploadResult, MusicYouTubeAudioLibraryManifest } from "../../../music/music-api.types";

export type ImportAudioFileCandidate = {
  readonly name: string;
};

export type ImportAudioUpload = Extract<MusicAudioUploadResult, { ok: true }>["upload"];

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

export const safeImportFileName = (value: string): string => {
  const normalized = value.replaceAll("\\", "/").split("/").pop()?.trim() ?? "";
  return normalized.slice(0, 191) || "unnamed-file";
};

const normalizeFileKey = (value: string): string => safeImportFileName(value).toLowerCase();

export const indexAudioFilesByName = <TFile extends ImportAudioFileCandidate>(
  files: readonly TFile[]
): Map<string, TFile> => {
  const indexed = new Map<string, TFile>();

  for (const file of files) {
    indexed.set(normalizeFileKey(file.name), file);
  }

  return indexed;
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
  const tracks = manifest.tracks.map((track) => {
    const fileName = track.fileName?.trim();

    if (!fileName) {
      return track;
    }

    const safeFileName = safeImportFileName(fileName);
    const upload = uploadsByFileName.get(normalizeFileKey(safeFileName));

    if (!upload) {
      errors.push(`Missing upload for ${safeFileName}.`);
      return track;
    }

    const expectedSha = track.audio?.sha256?.trim().toLowerCase() ?? null;
    if (expectedSha && expectedSha !== upload.sha256.toLowerCase()) {
      errors.push(`Checksum mismatch for ${safeFileName}.`);
      return track;
    }

    uploadedTrackCount += 1;

    return {
      ...track,
      audio: {
        storageRef: upload.storageRef,
        sha256: upload.sha256,
        mimeType: upload.contentType
      }
    };
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
  readonly rejected: number;
  readonly received: number;
  readonly unchanged: number;
  readonly updated: number;
}): string =>
  `${summary.accepted}/${summary.received} accepted, ${summary.rejected} rejected, ${summary.created} create, ${summary.updated} update, ${summary.unchanged} unchanged`;
