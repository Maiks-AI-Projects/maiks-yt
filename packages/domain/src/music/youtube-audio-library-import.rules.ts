import {
  youtubeAudioLibraryManifestVersion,
  youtubeAudioLibraryMaxManifestTracks,
  youtubeAudioLibraryVocalsClasses,
  type YouTubeAudioLibraryBulkManifest,
  type YouTubeAudioLibraryManifestAudio,
  type YouTubeAudioLibraryManifestProof,
  type YouTubeAudioLibraryManifestStudioEvidence,
  type YouTubeAudioLibraryManifestTrack,
  type YouTubeAudioLibraryManifestValidationResult,
  type YouTubeAudioLibraryRejectedTrack,
  type YouTubeAudioLibraryValidatedTrack
} from "./youtube-audio-library-import.types.js";

const ccBy4LicenseUrl = "https://creativecommons.org/licenses/by/4.0/";
const audioMimePrefix = "audio/";
const validStorageRefPattern = /^[a-z][a-z0-9-]*:[A-Za-z0-9._:-]+$/u;
const musicAudioStorageRefPattern = /^music-audio:([a-f0-9]{64}):[A-Za-z0-9._:-]+$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown, maxLength: number): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, maxLength) : null;

const textArray = (value: unknown): readonly string[] =>
  Array.isArray(value)
    ? value.flatMap((item) => typeof item === "string" && item.trim() ? [item.trim().slice(0, 80)] : [])
    : [];

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

const isVocalsClass = (value: unknown): value is YouTubeAudioLibraryManifestTrack["vocalsClass"] =>
  typeof value === "string"
    && (youtubeAudioLibraryVocalsClasses as readonly string[]).includes(value);

const isSafeUniversalVocalsClass = (
  value: YouTubeAudioLibraryManifestTrack["vocalsClass"]
): value is YouTubeAudioLibraryValidatedTrack["vocalsClass"] =>
  value === "none" || value === "minimal";

const safeHttpUrl = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};

const safeStudioMusicUrl = (value: unknown): string | null => {
  const url = safeHttpUrl(value);
  if (!url) {
    return null;
  }

  const parsed = new URL(url);
  const pathSegments = parsed.pathname
    .split("/")
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);

  return parsed.protocol === "https:"
    && parsed.hostname === "studio.youtube.com"
    && pathSegments.includes("music")
    ? parsed.toString()
    : null;
};

const looksLikeCcBy4 = (licenseName: string, licenseUrl: string | null): boolean => {
  const normalizedName = licenseName.toLowerCase();
  const normalizedUrl = licenseUrl?.toLowerCase() ?? "";

  return (
    normalizedUrl.startsWith(ccBy4LicenseUrl)
    || (
      normalizedName.includes("creative commons")
      && normalizedName.includes("attribution")
      && normalizedName.includes("4.0")
    )
    || normalizedName === "cc by 4.0"
    || normalizedName === "cc-by-4.0"
  );
};

const normalizeProof = (value: unknown): YouTubeAudioLibraryManifestProof => {
  if (!isRecord(value)) {
    return {};
  }

  return {
    url: text(value.url, 1024),
    storageRef: text(value.storageRef, 512)
  };
};

const normalizeStudioEvidence = (value: unknown): YouTubeAudioLibraryManifestStudioEvidence => {
  if (!isRecord(value)) {
    return {};
  }

  return {
    studioUrl: text(value.studioUrl, 1024),
    dialogText: text(value.dialogText, 10_000),
    attributionText: text(value.attributionText, 2_000),
    licenseText: text(value.licenseText, 10_000),
    sourceText: text(value.sourceText, 4_000),
    sourceUrl: text(value.sourceUrl, 1024),
    proofUrl: text(value.proofUrl, 1024)
  };
};

const normalizeAudio = (value: unknown): YouTubeAudioLibraryManifestAudio => {
  if (!isRecord(value)) {
    return {};
  }

  return {
    storageRef: text(value.storageRef, 512),
    sha256: text(value.sha256, 64)?.toLowerCase() ?? null,
    mimeType: text(value.mimeType, 120)?.toLowerCase() ?? null
  };
};

const normalizeManifestTrack = (value: unknown): YouTubeAudioLibraryManifestTrack | null => {
  if (!isRecord(value)) {
    return null;
  }

  const externalId = text(value.externalId, 191);
  const title = text(value.title, 191);
  const artist = text(value.artist, 191);
  const licenseName = text(value.licenseName, 191);
  const durationSeconds = typeof value.durationSeconds === "number" && Number.isInteger(value.durationSeconds) && value.durationSeconds > 0
    ? value.durationSeconds
    : null;
  const downloadedAt = typeof value.downloadedAt === "string" && Number.isFinite(Date.parse(value.downloadedAt))
    ? new Date(value.downloadedAt).toISOString()
    : null;
  const genre = normalizeGenre(value.genre);
  const vocalsClass = isVocalsClass(value.vocalsClass) ? value.vocalsClass : null;

  if (!externalId
    || !title
    || !artist
    || !licenseName
    || !durationSeconds
    || !downloadedAt
    || !genre
    || !vocalsClass
    || typeof value.attributionRequired !== "boolean"
    || typeof value.liveSafe !== "boolean"
    || typeof value.vodSafe !== "boolean") {
    return null;
  }

  return {
    externalId,
    title,
    artist,
    durationSeconds,
    downloadedAt,
    genre,
    vocalsClass,
    liveSafe: value.liveSafe,
    vodSafe: value.vodSafe,
    licenseName,
    licenseUrl: text(value.licenseUrl, 1024),
    attributionRequired: value.attributionRequired,
    attributionText: text(value.attributionText, 1000),
    audio: normalizeAudio(value.audio),
    proof: normalizeProof(value.proof),
    studioEvidence: normalizeStudioEvidence(value.studioEvidence),
    genres: textArray(value.genres),
    moods: textArray(value.moods),
    tags: textArray(value.tags),
    explicitContent: value.explicitContent === true,
    instrumental: value.instrumental === true
  };
};

const rejectTrack = (
  index: number,
  track: YouTubeAudioLibraryManifestTrack | null,
  reason: YouTubeAudioLibraryRejectedTrack["reason"]
): YouTubeAudioLibraryRejectedTrack => ({
  index,
  externalId: track?.externalId ?? null,
  title: track?.title ?? null,
  reason
});

const validateAudio = (
  audio: YouTubeAudioLibraryManifestAudio | null | undefined
): YouTubeAudioLibraryValidatedTrack["audio"] | null | "invalid" => {
  const storageRef = text(audio?.storageRef, 512);
  const sha256 = text(audio?.sha256, 64)?.toLowerCase() ?? null;
  const mimeType = text(audio?.mimeType, 120)?.toLowerCase() ?? null;

  if (!storageRef && !sha256 && !mimeType) {
    return null;
  }

  if (!storageRef || !sha256 || !mimeType || !sha256Pattern.test(sha256) || !mimeType.startsWith(audioMimePrefix)) {
    return "invalid";
  }

  const storageRefMatch = musicAudioStorageRefPattern.exec(storageRef);
  if (!storageRefMatch || storageRefMatch[1] !== sha256) {
    return "invalid";
  }

  return {
    sourceType: "local_audio",
    storageRef,
    sha256,
    mimeType
  };
};

const buildSafetyTags = (track: YouTubeAudioLibraryManifestTrack): readonly string[] => {
  const values = [
    "youtube-audio-library",
    "cc-by-4.0",
    track.genre,
    ...textArray(track.genres),
    ...textArray(track.moods),
    ...textArray(track.tags)
  ];

  return [...new Set(values.map((value) => value.toLowerCase()).filter(Boolean))].slice(0, 24);
};

const validateTrack = (
  index: number,
  track: YouTubeAudioLibraryManifestTrack,
  seenExternalIds: Set<string>
): YouTubeAudioLibraryValidatedTrack | YouTubeAudioLibraryRejectedTrack => {
  const externalIdKey = track.externalId.toLowerCase();
  if (seenExternalIds.has(externalIdKey)) {
    return rejectTrack(index, track, "duplicate_external_id");
  }
  seenExternalIds.add(externalIdKey);

  const explicitLicenseUrl = safeHttpUrl(track.licenseUrl);
  const licenseUrl = explicitLicenseUrl ?? ccBy4LicenseUrl;

  if (!track.attributionRequired || !looksLikeCcBy4(track.licenseName, licenseUrl)) {
    return rejectTrack(index, track, "not_cc_by_4");
  }

  if (!track.liveSafe || !track.vodSafe || !isSafeUniversalVocalsClass(track.vocalsClass)) {
    return rejectTrack(index, track, "invalid_required_field");
  }

  if (!track.attributionText?.trim()) {
    return rejectTrack(index, track, "missing_attribution");
  }

  const audio = validateAudio(track.audio);
  if (audio === "invalid") {
    return rejectTrack(index, track, "invalid_audio_reference");
  }
  if (!audio) {
    return rejectTrack(index, track, "missing_audio");
  }

  const proofUrl = safeHttpUrl(track.proof?.url);
  const proofStorageRef = text(track.proof?.storageRef, 512);
  const studioEvidence = normalizeStudioEvidence(track.studioEvidence);
  const evidenceStudioUrl = safeStudioMusicUrl(studioEvidence.studioUrl);
  const evidenceProofUrl = safeHttpUrl(studioEvidence.proofUrl);
  const evidenceSourceUrl = safeHttpUrl(studioEvidence.sourceUrl);

  if (proofStorageRef
    && (!validStorageRefPattern.test(proofStorageRef)
      || proofStorageRef.startsWith("/")
      || proofStorageRef.toLowerCase().startsWith("file:"))) {
    return rejectTrack(index, track, "invalid_license_evidence");
  }

  if (!proofUrl) {
    return rejectTrack(index, track, "missing_license_evidence");
  }

  if (!evidenceStudioUrl
    || !studioEvidence.dialogText
    || !studioEvidence.attributionText
    || !studioEvidence.licenseText
    || !studioEvidence.sourceText
    || !evidenceSourceUrl
    || !evidenceProofUrl
    || proofUrl !== evidenceProofUrl) {
    return rejectTrack(index, track, "missing_license_evidence");
  }

  return {
    externalId: track.externalId,
    title: track.title,
    artist: track.artist,
    durationSeconds: track.durationSeconds,
    downloadedAt: track.downloadedAt,
    genre: track.genre,
    vocalsClass: track.vocalsClass,
    liveSafe: true,
    vodSafe: true,
    licenseName: "Creative Commons Attribution 4.0",
    licenseUrl,
    attributionText: track.attributionText.trim(),
    audio,
    proofUrl,
    proofStorageRef,
    safetyTags: buildSafetyTags(track),
    explicitContent: track.explicitContent === true,
    instrumental: track.instrumental === true,
    licensePayload: {
      manifestVersion: youtubeAudioLibraryManifestVersion,
      source: "youtube-studio",
      externalId: track.externalId,
      downloadedAt: track.downloadedAt,
      genre: track.genre,
      vocalsClass: track.vocalsClass,
      liveSafe: true,
      vodSafe: true,
      licenseName: track.licenseName,
      licenseUrl,
      attributionRequired: track.attributionRequired,
      attributionText: track.attributionText.trim(),
      proofUrl,
      proofStorageRef: proofStorageRef ?? null,
      studioEvidence: {
        studioUrl: evidenceStudioUrl,
        dialogText: studioEvidence.dialogText ?? null,
        attributionText: studioEvidence.attributionText ?? null,
        licenseText: studioEvidence.licenseText ?? null,
        sourceText: studioEvidence.sourceText ?? null,
        sourceUrl: evidenceSourceUrl,
        proofUrl: evidenceProofUrl
      }
    }
  };
};

export const validateYouTubeAudioLibraryManifest = (
  value: unknown
): YouTubeAudioLibraryManifestValidationResult => {
  if (!isRecord(value)
    || value.manifestVersion !== youtubeAudioLibraryManifestVersion
    || value.source !== "youtube-studio"
    || (value.refreshMode !== "full" && value.refreshMode !== "partial")
    || typeof value.exportedAt !== "string"
    || !Number.isFinite(Date.parse(value.exportedAt))
    || !Array.isArray(value.tracks)
  ) {
    return {
      ok: false,
      reason: "invalid_manifest",
      rejectedTracks: [rejectTrack(0, null, "invalid_manifest")]
    };
  }

  if (value.tracks.length > youtubeAudioLibraryMaxManifestTracks) {
    return {
      ok: false,
      reason: "too_many_tracks",
      rejectedTracks: [rejectTrack(0, null, "too_many_tracks")]
    };
  }

  const rejectedTracks: YouTubeAudioLibraryRejectedTrack[] = [];
  const tracks: YouTubeAudioLibraryValidatedTrack[] = [];
  const seenExternalIds = new Set<string>();

  for (const [index, rawTrack] of value.tracks.entries()) {
    const track = normalizeManifestTrack(rawTrack);

    if (!track) {
      rejectedTracks.push(rejectTrack(index, null, "invalid_required_field"));
      continue;
    }

    const result = validateTrack(index, track, seenExternalIds);
    if ("reason" in result) {
      rejectedTracks.push(result);
    } else {
      tracks.push(result);
    }
  }

  return {
    ok: true,
    manifest: value as YouTubeAudioLibraryBulkManifest,
    tracks,
    rejectedTracks
  };
};
