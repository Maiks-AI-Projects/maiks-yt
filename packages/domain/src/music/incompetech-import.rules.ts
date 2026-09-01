import {
  incompetechExpectedGenres,
  incompetechExpectedTrackCount,
  incompetechManifestVersion,
  incompetechProviderKey,
  incompetechVocalsClasses,
  type IncompetechBulkManifest,
  type IncompetechGenre,
  type IncompetechImportRejectReason,
  type IncompetechManifestAudio,
  type IncompetechManifestProof,
  type IncompetechManifestTrack,
  type IncompetechManifestValidationResult,
  type IncompetechProviderEvidence,
  type IncompetechRejectedTrack,
  type IncompetechValidatedTrack
} from "./incompetech-import.types.js";

const ccBy4LicenseUrl = "https://creativecommons.org/licenses/by/4.0/";
const sha256Pattern = /^[a-f0-9]{64}$/u;
const musicAudioStorageRefPattern = /^music-audio:([a-f0-9]{64}):incompetech\/([a-z0-9-]+)\/([a-f0-9]{64})\.mp3$/u;
const isrcPattern = /^USUAN[0-9]{7}$/u;
const incompetechHost = "incompetech.com";
const incompetechArtistName = "Kevin MacLeod";
const incompetechAttributionSource = "incompetech.com";
const incompetechAttributionLicensePhrase = "Licensed under Creative Commons: By Attribution 4.0 License";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown, maxLength: number): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, maxLength) : null;

const textArray = (value: unknown): readonly string[] =>
  Array.isArray(value)
    ? value.flatMap((item) => typeof item === "string" && item.trim() ? [item.trim().slice(0, 80)] : [])
    : [];

const normalizeWhitespace = (value: string): string => value.replace(/\s+/gu, " ").trim();

const safeHttpsUrl = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};

const safeIncompetechPageUrl = (value: unknown): string | null => {
  const url = safeHttpsUrl(value);
  if (!url) {
    return null;
  }

  const parsed = new URL(url);
  return parsed.hostname === incompetechHost
    && parsed.pathname === "/music/royalty-free/index.html"
    && isrcPattern.test(parsed.searchParams.get("isrc") ?? "")
    ? parsed.toString()
    : null;
};

const safeIncompetechMp3Url = (value: unknown): string | null => {
  const url = safeHttpsUrl(value);
  if (!url) {
    return null;
  }

  const parsed = new URL(url);
  return parsed.hostname === incompetechHost
    && parsed.pathname.startsWith("/music/royalty-free/mp3-royaltyfree/")
    && parsed.pathname.toLowerCase().endsWith(".mp3")
    ? parsed.toString()
    : null;
};

const safeIncompetechCatalogUrl = (value: unknown): string | null => {
  const url = safeHttpsUrl(value);
  if (!url) {
    return null;
  }

  const parsed = new URL(url);
  return parsed.hostname === incompetechHost
    && (
      parsed.pathname === "/music/royalty-free/music.html"
      || parsed.pathname === "/music/royalty-free/pieces.json"
    )
    ? parsed.toString()
    : null;
};

const normalizeGenre = (value: unknown): IncompetechGenre | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return (incompetechExpectedGenres as readonly string[]).includes(normalized)
    ? normalized as IncompetechGenre
    : null;
};

const normalizeProviderEvidence = (value: unknown): readonly IncompetechProviderEvidence[] =>
  Array.isArray(value)
    ? value.map((item): IncompetechProviderEvidence | null => {
      if (!isRecord(item)) {
        return null;
      }

      return {
        label: text(item.label, 191),
        url: safeHttpsUrl(item.url),
        path: text(item.path, 1024),
        sha256: text(item.sha256, 64)?.toLowerCase() ?? null
      };
    }).filter((item): item is IncompetechProviderEvidence => item !== null)
    : [];

const normalizeAudio = (value: unknown): IncompetechManifestAudio | null => {
  if (!isRecord(value)) {
    return null;
  }

  return {
    path: text(value.path, 1024),
    storageRef: text(value.storageRef, 512),
    sha256: text(value.sha256, 64)?.toLowerCase() ?? null,
    mimeType: text(value.mimeType, 120)?.toLowerCase() ?? null,
    format: text(value.format, 80)?.toLowerCase() ?? null,
    codec: text(value.codec, 80)?.toLowerCase() ?? null,
    bitrate: typeof value.bitrate === "number" && Number.isFinite(value.bitrate) ? value.bitrate : null,
    headStatus: typeof value.headStatus === "number" && Number.isInteger(value.headStatus) ? value.headStatus : null,
    headContentType: text(value.headContentType, 120)?.toLowerCase() ?? null,
    getContentType: text(value.getContentType, 120)?.toLowerCase() ?? null
  };
};

const normalizeProof = (value: unknown): IncompetechManifestProof | null => {
  if (!isRecord(value)) {
    return null;
  }

  return {
    accessedAt: typeof value.accessedAt === "string" && Number.isFinite(Date.parse(value.accessedAt))
      ? new Date(value.accessedAt).toISOString()
      : null,
    catalogRowPath: text(value.catalogRowPath, 1024),
    catalogRowSha256: text(value.catalogRowSha256, 64)?.toLowerCase() ?? null,
    itemPagePath: text(value.itemPagePath, 1024),
    itemPageSha256: text(value.itemPageSha256, 64)?.toLowerCase() ?? null,
    provider: text(value.provider, 191),
    providerEvidenceManifest: text(value.providerEvidenceManifest, 1024),
    providerSnapshotSha256: text(value.providerSnapshotSha256, 64)?.toLowerCase() ?? null,
    contentIdCaveat: text(value.contentIdCaveat, 1000),
    url: safeIncompetechPageUrl(value.url)
  };
};

const normalizeManifestTrack = (value: unknown): IncompetechManifestTrack | null => {
  if (!isRecord(value)) {
    return null;
  }

  const externalId = text(value.externalId, 32);
  const isrc = text(value.isrc, 32);
  const title = text(value.title, 191);
  const artist = text(value.artist, 191);
  const downloadedAt = typeof value.downloadedAt === "string" && Number.isFinite(Date.parse(value.downloadedAt))
    ? new Date(value.downloadedAt).toISOString()
    : null;
  const genre = normalizeGenre(value.normalizedGenre);
  const vocalsClass = typeof value.vocalsClass === "string"
    && (incompetechVocalsClasses as readonly string[]).includes(value.vocalsClass)
    ? value.vocalsClass as IncompetechManifestTrack["vocalsClass"]
    : null;
  const licenseName = text(value.licenseName, 191);
  const licenseUrl = safeHttpsUrl(value.licenseUrl);
  const sourceUrl = safeIncompetechPageUrl(value.sourceUrl);
  const directFileUrl = safeIncompetechMp3Url(value.directFileUrl);
  const officialCatalogJsonUrl = safeIncompetechCatalogUrl(value.officialCatalogJsonUrl);
  const catalogUrl = safeIncompetechCatalogUrl(value.catalogUrl);
  const audio = normalizeAudio(value.audio);
  const proof = normalizeProof(value.proof);

  if (!externalId
    || !isrc
    || externalId !== isrc
    || !isrcPattern.test(externalId)
    || !title
    || !artist
    || typeof value.durationSeconds !== "number"
    || !Number.isFinite(value.durationSeconds)
    || value.durationSeconds <= 0
    || typeof value.catalogDurationSeconds !== "number"
    || !Number.isInteger(value.catalogDurationSeconds)
    || value.catalogDurationSeconds <= 0
    || !downloadedAt
    || !genre
    || !text(value.sourceGenre, 80)
    || !vocalsClass
    || typeof value.liveSafe !== "boolean"
    || typeof value.vodSafe !== "boolean"
    || typeof value.commercialAllowed !== "boolean"
    || !text(value.rightsStatus, 80)
    || !licenseName
    || !licenseUrl
    || typeof value.attributionRequired !== "boolean"
    || !text(value.attributionText, 1000)
    || !sourceUrl
    || !directFileUrl
    || !officialCatalogJsonUrl
    || !catalogUrl
    || !text(value.classificationEvidence, 2000)
    || !audio
    || !proof) {
    return null;
  }

  return {
    externalId,
    isrc,
    title,
    artist,
    durationSeconds: value.durationSeconds,
    catalogDurationSeconds: value.catalogDurationSeconds,
    downloadedAt,
    normalizedGenre: genre,
    sourceGenre: text(value.sourceGenre, 80) ?? genre,
    vocalsClass,
    liveSafe: value.liveSafe,
    vodSafe: value.vodSafe,
    commercialAllowed: value.commercialAllowed,
    rightsStatus: text(value.rightsStatus, 80) ?? "",
    licenseName,
    licenseUrl,
    attributionRequired: value.attributionRequired,
    attributionText: text(value.attributionText, 1000) ?? "",
    sourceUrl,
    directFileUrl,
    officialCatalogJsonUrl,
    catalogUrl,
    description: text(value.description, 4000),
    instruments: text(value.instruments, 2000),
    moods: textArray(value.moods),
    classificationEvidence: text(value.classificationEvidence, 2000) ?? "",
    qualityUseCaseNote: text(value.qualityUseCaseNote, 2000),
    audio,
    proof
  };
};

const rejectTrack = (
  index: number,
  track: IncompetechManifestTrack | null,
  reason: IncompetechImportRejectReason
): IncompetechRejectedTrack => ({
  index,
  externalId: track?.externalId ?? null,
  title: track?.title ?? null,
  reason
});

const validateAudio = (
  track: IncompetechManifestTrack
): IncompetechValidatedTrack["audio"] | null => {
  const audio = track.audio;

  if (!audio.storageRef
    || !audio.sha256
    || !audio.mimeType
    || !audio.path
    || !sha256Pattern.test(audio.sha256)
    || audio.mimeType !== "audio/mpeg"
    || audio.format !== "mp3"
    || audio.codec !== "mp3") {
    return null;
  }

  const storageMatch = musicAudioStorageRefPattern.exec(audio.storageRef);
  if (!storageMatch
    || storageMatch[1] !== audio.sha256
    || storageMatch[2] !== track.normalizedGenre
    || storageMatch[3] !== audio.sha256
    || !audio.path.endsWith(`/library/${track.normalizedGenre}/${audio.sha256}.mp3`)) {
    return null;
  }

  return {
    sourceType: "local_audio",
    storageRef: audio.storageRef,
    sha256: audio.sha256,
    mimeType: audio.mimeType
  };
};

const hasExactIncompetechArtist = (artist: string): boolean =>
  normalizeWhitespace(artist) === incompetechArtistName;

const hasUsableIncompetechAttribution = (track: IncompetechManifestTrack): boolean => {
  const attributionText = normalizeWhitespace(track.attributionText);
  const title = normalizeWhitespace(track.title);
  const expectedCredit = `"${title}" ${incompetechArtistName} (${incompetechAttributionSource})`;
  const lowerAttribution = attributionText.toLowerCase();

  return attributionText.includes(expectedCredit)
    && attributionText.includes(incompetechAttributionLicensePhrase)
    && lowerAttribution.includes("creativecommons.org/licenses/by/4.0/");
};

const validateProof = (track: IncompetechManifestTrack): boolean => {
  const proof = track.proof;

  return proof.url === track.sourceUrl
    && proof.accessedAt !== null
    && proof.catalogRowPath !== null
    && proof.itemPagePath !== null
    && proof.providerEvidenceManifest !== null
    && proof.provider === "Incompetech"
    && typeof proof.contentIdCaveat === "string"
    && proof.contentIdCaveat.toLowerCase().includes("content id")
    && typeof proof.catalogRowSha256 === "string"
    && sha256Pattern.test(proof.catalogRowSha256)
    && typeof proof.itemPageSha256 === "string"
    && sha256Pattern.test(proof.itemPageSha256)
    && typeof proof.providerSnapshotSha256 === "string"
    && sha256Pattern.test(proof.providerSnapshotSha256);
};

const buildSafetyTags = (track: IncompetechManifestTrack): readonly string[] => {
  const values = [
    incompetechProviderKey,
    "cc-by-4.0",
    track.normalizedGenre,
    ...textArray(track.moods)
  ];

  return [...new Set(values.map((value) => value.toLowerCase()).filter(Boolean))].slice(0, 24);
};

const validateTrack = (
  index: number,
  track: IncompetechManifestTrack,
  seen: {
    externalIds: Set<string>;
    sha256s: Set<string>;
    sourceUrls: Set<string>;
    directFileUrls: Set<string>;
  },
  providerEvidence: readonly IncompetechProviderEvidence[]
): IncompetechValidatedTrack | IncompetechRejectedTrack => {
  const externalIdKey = track.externalId.toLowerCase();
  if (seen.externalIds.has(externalIdKey)) {
    return rejectTrack(index, track, "duplicate_external_id");
  }
  seen.externalIds.add(externalIdKey);

  const sourceUrlKey = track.sourceUrl.toLowerCase();
  if (seen.sourceUrls.has(sourceUrlKey)) {
    return rejectTrack(index, track, "duplicate_source_url");
  }
  seen.sourceUrls.add(sourceUrlKey);

  const directFileUrlKey = track.directFileUrl.toLowerCase();
  if (seen.directFileUrls.has(directFileUrlKey)) {
    return rejectTrack(index, track, "duplicate_direct_file_url");
  }
  seen.directFileUrls.add(directFileUrlKey);

  if (track.licenseUrl !== ccBy4LicenseUrl
    || track.licenseName !== "Creative Commons Attribution 4.0"
    || !track.attributionRequired) {
    return rejectTrack(index, track, "not_cc_by_4");
  }

  if (!hasExactIncompetechArtist(track.artist)) {
    return rejectTrack(index, track, "wrong_artist");
  }

  if (!track.liveSafe
    || !track.vodSafe
    || !track.commercialAllowed
    || track.rightsStatus !== "universal-safe"
    || track.vocalsClass !== "none"
    || Math.abs(track.durationSeconds - track.catalogDurationSeconds) > 1) {
    return rejectTrack(index, track, "invalid_required_field");
  }

  if (!track.attributionText.trim()) {
    return rejectTrack(index, track, "missing_attribution");
  }

  if (!hasUsableIncompetechAttribution(track)) {
    return rejectTrack(index, track, "unusable_attribution");
  }

  const audio = validateAudio(track);
  if (!audio) {
    return rejectTrack(index, track, "invalid_audio_reference");
  }

  if (seen.sha256s.has(audio.sha256)) {
    return rejectTrack(index, track, "duplicate_sha256");
  }
  seen.sha256s.add(audio.sha256);

  if (!validateProof(track)) {
    return rejectTrack(index, track, "missing_license_evidence");
  }

  const hasRequiredProviderEvidence = providerEvidence.some((evidence) => evidence.url === track.officialCatalogJsonUrl)
    && providerEvidence.some((evidence) => evidence.url === "https://incompetech.com/music/royalty-free/licenses/")
    && providerEvidence.some((evidence) => evidence.url === "https://incompetech.com/music/royalty-free/youtube-contentid.html");
  if (!hasRequiredProviderEvidence) {
    return rejectTrack(index, track, "invalid_license_evidence");
  }

  return {
    externalId: track.externalId,
    isrc: track.isrc,
    title: track.title,
    artist: incompetechArtistName,
    durationSeconds: track.catalogDurationSeconds,
    downloadedAt: track.downloadedAt,
    genre: track.normalizedGenre,
    vocalsClass: "none",
    liveSafe: true,
    vodSafe: true,
    commercialAllowed: true,
    rightsStatus: "universal-safe",
    licenseName: "Creative Commons Attribution 4.0",
    licenseUrl: track.licenseUrl,
    attributionText: track.attributionText.trim(),
    audio,
    proofUrl: track.sourceUrl,
    proofStorageRef: null,
    safetyTags: buildSafetyTags(track),
    explicitContent: false,
    instrumental: true,
    licensePayload: {
      manifestVersion: incompetechManifestVersion,
      source: incompetechProviderKey,
      sourceClass: "official-provider-manifest",
      externalId: track.externalId,
      isrc: track.isrc,
      title: track.title,
      artist: incompetechArtistName,
      sourceUrl: track.sourceUrl,
      directFileUrl: track.directFileUrl,
      officialCatalogJsonUrl: track.officialCatalogJsonUrl,
      catalogUrl: track.catalogUrl,
      downloadedAt: track.downloadedAt,
      durationSeconds: track.durationSeconds,
      catalogDurationSeconds: track.catalogDurationSeconds,
      genre: track.normalizedGenre,
      sourceGenre: track.sourceGenre,
      vocalsClass: "none",
      classificationEvidence: track.classificationEvidence,
      liveSafe: true,
      vodSafe: true,
      commercialAllowed: true,
      rightsStatus: "universal-safe",
      licenseName: track.licenseName,
      licenseUrl: track.licenseUrl,
      attributionRequired: true,
      attributionText: track.attributionText.trim(),
      attributionCode: track.attributionText.trim(),
      audio: track.audio,
      proof: track.proof,
      providerEvidence,
      contentIdCaveat: track.proof.contentIdCaveat,
      description: track.description ?? null,
      instruments: track.instruments ?? null,
      moods: track.moods,
      qualityUseCaseNote: track.qualityUseCaseNote ?? null
    }
  };
};

export const validateIncompetechManifest = (input: unknown): IncompetechManifestValidationResult => {
  if (!isRecord(input)
    || input.manifestVersion !== incompetechManifestVersion
    || input.source !== incompetechProviderKey
    || typeof input.generatedAt !== "string"
    || !Number.isFinite(Date.parse(input.generatedAt))
    || !Array.isArray(input.tracks)) {
    return {
      ok: false,
      reason: "invalid_manifest",
      rejectedTracks: [{ index: 0, externalId: null, title: null, reason: "invalid_manifest" }]
    };
  }

  if (input.tracks.length !== incompetechExpectedTrackCount) {
    return {
      ok: false,
      reason: "unexpected_track_count",
      rejectedTracks: [{ index: 0, externalId: null, title: null, reason: "unexpected_track_count" }]
    };
  }

  const providerEvidence = normalizeProviderEvidence(input.providerEvidence);
  if (providerEvidence.length === 0
    || providerEvidence.some((evidence) => !evidence.path || !evidence.sha256 || !sha256Pattern.test(evidence.sha256))) {
    return {
      ok: false,
      reason: "missing_license_evidence",
      rejectedTracks: [{ index: 0, externalId: null, title: null, reason: "missing_license_evidence" }]
    };
  }

  const rejectedTracks: IncompetechRejectedTrack[] = [];
  const validatedTracks: IncompetechValidatedTrack[] = [];
  const genreCounts = new Map<IncompetechGenre, number>();
  const seen = {
    externalIds: new Set<string>(),
    sha256s: new Set<string>(),
    sourceUrls: new Set<string>(),
    directFileUrls: new Set<string>()
  };

  input.tracks.forEach((rawTrack, index) => {
    const track = normalizeManifestTrack(rawTrack);
    if (!track) {
      rejectedTracks.push(rejectTrack(index, null, "invalid_required_field"));
      return;
    }

    const validated = validateTrack(index, track, seen, providerEvidence);
    if ("reason" in validated) {
      rejectedTracks.push(validated);
      return;
    }

    genreCounts.set(validated.genre, (genreCounts.get(validated.genre) ?? 0) + 1);
    validatedTracks.push(validated);
  });

  if (rejectedTracks.length > 0) {
    return {
      ok: false,
      reason: rejectedTracks[0]?.reason ?? "invalid_manifest",
      rejectedTracks
    };
  }

  const hasExactGenreCounts = incompetechExpectedGenres.every((genre) => genreCounts.get(genre) === 4);
  if (!hasExactGenreCounts) {
    return {
      ok: false,
      reason: "unexpected_genre_count",
      rejectedTracks: [{ index: 0, externalId: null, title: null, reason: "unexpected_genre_count" }]
    };
  }

  const normalizedManifest: IncompetechBulkManifest & { refreshMode: "full" } = {
    manifestVersion: incompetechManifestVersion,
    source: incompetechProviderKey,
    sourceClass: text(input.sourceClass, 191),
    generatedAt: new Date(input.generatedAt).toISOString(),
    providerEvidence,
    tracks: input.tracks.map((track) => normalizeManifestTrack(track)).filter((track): track is IncompetechManifestTrack => track !== null),
    refreshMode: "full"
  };

  if (input.rejectedCandidatesLog !== undefined) {
    normalizedManifest.rejectedCandidatesLog = input.rejectedCandidatesLog;
  }
  if (isRecord(input.counts)) {
    normalizedManifest.counts = input.counts;
  }
  if (input.acceptedRightsReport !== undefined) {
    normalizedManifest.acceptedRightsReport = input.acceptedRightsReport;
  }
  if (input.selectionRule !== undefined) {
    normalizedManifest.selectionRule = input.selectionRule;
  }

  return {
    ok: true,
    manifest: normalizedManifest,
    tracks: validatedTracks,
    rejectedTracks
  };
};
