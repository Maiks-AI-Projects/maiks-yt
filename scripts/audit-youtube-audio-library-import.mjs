#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const manifestVersion = "youtube-audio-library.v1";
const ccBy4Url = "https://creativecommons.org/licenses/by/4.0/";
const sha256Pattern = /^[a-f0-9]{64}$/u;
const musicAudioStorageRefPattern = /^music-audio:([a-f0-9]{64}):[A-Za-z0-9._:-]+$/u;
const safeVocalsClasses = new Set(["none", "minimal"]);

const usage = `
Usage:
  node scripts/audit-youtube-audio-library-import.mjs --manifest <manifest.json> [--import-result <dry-run-or-apply-result.json>]

Reads only local JSON files. It never writes to the database or calls the API.
`;

const parseArgs = () => {
  const parsed = {
    manifest: null,
    importResult: null
  };
  const args = process.argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (!next) {
      throw new Error(`Missing value for ${arg}`);
    }

    if (arg === "--manifest") {
      parsed.manifest = next;
    } else if (arg === "--import-result") {
      parsed.importResult = next;
    } else {
      throw new Error(`Unknown option ${arg}`);
    }
    index += 1;
  }

  if (!parsed.manifest) {
    throw new Error("--manifest is required.");
  }

  return parsed;
};

const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));

const sortedRecord = (record) =>
  Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));

const increment = (record, key) => {
  record[key] = (record[key] ?? 0) + 1;
};

const normalizeGenre = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 &/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  return normalized.length > 0 ? normalized : null;
};

const safeHttpUrl = (value) => {
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

const safeStudioMusicUrl = (value) => {
  const url = safeHttpUrl(value);
  if (!url) {
    return null;
  }

  const parsed = new URL(url);
  const pathSegments = parsed.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  const channelId = pathSegments[1] ?? "";

  return parsed.protocol === "https:"
    && parsed.hostname === "studio.youtube.com"
    && pathSegments.length === 3
    && pathSegments[0] === "channel"
    && channelId.startsWith("UC")
    && channelId.length > 2
    && pathSegments[2] === "music"
    ? parsed.toString()
    : null;
};

const rejectTrack = (index, track, reason) => ({
  index,
  externalId: typeof track?.externalId === "string" ? track.externalId : null,
  title: typeof track?.title === "string" ? track.title : null,
  reason
});

const validateTrackEvidence = (track, index) => {
  if (!track || typeof track !== "object" || Array.isArray(track)) {
    return { ok: false, rejection: rejectTrack(index, track, "invalid_required_field") };
  }

  const genre = normalizeGenre(track.genre);
  const vocalsClass = typeof track.vocalsClass === "string" ? track.vocalsClass.trim().toLowerCase() : "";
  const sha256 = typeof track.audio?.sha256 === "string" ? track.audio.sha256.trim().toLowerCase() : null;
  const storageRef = typeof track.audio?.storageRef === "string" ? track.audio.storageRef.trim() : null;
  const storageRefMatch = storageRef ? musicAudioStorageRefPattern.exec(storageRef) : null;
  const proofUrl = safeHttpUrl(track.proof?.url);
  const studioEvidence = track.studioEvidence;
  const studioUrl = safeStudioMusicUrl(studioEvidence?.studioUrl);
  const studioProofUrl = safeHttpUrl(studioEvidence?.proofUrl);
  const studioSourceUrl = safeHttpUrl(studioEvidence?.sourceUrl);

  if (typeof track.externalId !== "string" || !track.externalId.trim()
    || typeof track.title !== "string" || !track.title.trim()
    || typeof track.artist !== "string" || !track.artist.trim()
    || !Number.isInteger(track.durationSeconds) || track.durationSeconds <= 0
    || typeof track.downloadedAt !== "string" || !Number.isFinite(Date.parse(track.downloadedAt))
    || !genre || genre !== track.genre
    || !["none", "minimal", "prominent", "unknown"].includes(vocalsClass)
    || track.liveSafe !== true || track.vodSafe !== true) {
    return { ok: false, rejection: rejectTrack(index, track, "invalid_required_field") };
  }

  if (!safeVocalsClasses.has(vocalsClass)) {
    return { ok: false, rejection: rejectTrack(index, track, "unsafe_vocals_class") };
  }

  if (typeof track.licenseName !== "string"
    || !track.licenseName.toLowerCase().includes("creative commons")
    || typeof track.licenseUrl !== "string"
    || !track.licenseUrl.toLowerCase().startsWith(ccBy4Url)
    || track.attributionRequired !== true) {
    return { ok: false, rejection: rejectTrack(index, track, "not_cc_by_4") };
  }

  if (typeof track.attributionText !== "string" || !track.attributionText.trim()) {
    return { ok: false, rejection: rejectTrack(index, track, "missing_attribution") };
  }

  if (!sha256 || !sha256Pattern.test(sha256)
    || !storageRefMatch || storageRefMatch[1] !== sha256
    || typeof track.audio?.mimeType !== "string"
    || !track.audio.mimeType.toLowerCase().startsWith("audio/")) {
    return { ok: false, rejection: rejectTrack(index, track, "invalid_audio_reference") };
  }

  if (!proofUrl
    || !studioUrl
    || !studioEvidence?.dialogText
    || !studioEvidence.attributionText
    || !studioEvidence.licenseText
    || !studioEvidence.sourceText
    || !studioProofUrl
    || !studioSourceUrl
    || proofUrl !== studioProofUrl) {
    return { ok: false, rejection: rejectTrack(index, track, "missing_license_evidence") };
  }

  return {
    ok: true,
    track: {
      externalId: track.externalId.trim(),
      title: track.title.trim(),
      genre,
      vocalsClass,
      sha256
    }
  };
};

const validateImportResultCounts = (importResult, counts, rejectedTracks) => {
  if (!importResult) {
    return null;
  }

  const summary = importResult.summary;
  if (importResult.ok !== true || !summary) {
    return "import_result_not_successful";
  }
  if (summary.received !== counts.received
    || summary.accepted !== counts.accepted
    || summary.rejected !== rejectedTracks.length) {
    return "import_result_count_mismatch";
  }

  return null;
};

export const auditYouTubeAudioLibraryImport = ({ manifest, importResult = null }) => {
  const rejectedTracks = [];
  const acceptedTracks = [];
  const seenExternalIds = new Set();
  const seenSha256 = new Set();
  let duplicatesRejected = 0;

  if (manifest?.manifestVersion !== manifestVersion || manifest.source !== "youtube-studio" || !Array.isArray(manifest.tracks)) {
    return {
      ok: false,
      reason: "invalid_manifest",
      counts: {
        received: 0,
        accepted: 0,
        rejected: 1,
        duplicatesRejected: 0,
        totalUniqueSha256: 0,
        byRightsStatus: { rejected: 1 },
        byGenre: {},
        byVocalsClass: {}
      },
      rejectedTracks: [rejectTrack(0, null, "invalid_manifest")]
    };
  }

  for (const [index, track] of manifest.tracks.entries()) {
    const validated = validateTrackEvidence(track, index);
    if (!validated.ok) {
      rejectedTracks.push(validated.rejection);
      continue;
    }

    const externalIdKey = validated.track.externalId.toLowerCase();
    if (seenExternalIds.has(externalIdKey)) {
      rejectedTracks.push(rejectTrack(index, track, "duplicate_external_id"));
      continue;
    }
    seenExternalIds.add(externalIdKey);

    if (seenSha256.has(validated.track.sha256)) {
      duplicatesRejected += 1;
      rejectedTracks.push(rejectTrack(index, track, "duplicate_content"));
      continue;
    }

    seenSha256.add(validated.track.sha256);
    acceptedTracks.push(validated.track);
  }

  const byGenre = {};
  const byVocalsClass = {};
  for (const track of acceptedTracks) {
    increment(byGenre, track.genre);
    increment(byVocalsClass, track.vocalsClass);
  }

  const counts = {
    received: manifest.tracks.length,
    accepted: acceptedTracks.length,
    rejected: rejectedTracks.length,
    duplicatesRejected,
    totalUniqueSha256: seenSha256.size,
    byRightsStatus: sortedRecord({
      "universal-safe": acceptedTracks.length,
      rejected: rejectedTracks.length
    }),
    byGenre: sortedRecord(byGenre),
    byVocalsClass: sortedRecord(byVocalsClass)
  };
  const importResultMismatch = validateImportResultCounts(importResult, counts, rejectedTracks);

  if (rejectedTracks.length > 0 || importResultMismatch) {
    return {
      ok: false,
      reason: importResultMismatch ?? "manifest_evidence_incomplete",
      counts,
      rejectedTracks
    };
  }

  return {
    ok: true,
    counts,
    rejectedTracks: []
  };
};

const main = async () => {
  const args = parseArgs();
  const manifestPath = path.resolve(args.manifest);
  const importResultPath = args.importResult ? path.resolve(args.importResult) : null;
  const manifest = await readJson(manifestPath);
  const importResult = importResultPath ? await readJson(importResultPath) : null;
  const result = auditYouTubeAudioLibraryImport({ manifest, importResult });

  console.log(JSON.stringify({
    manifestPath,
    importResultPath,
    ...result
  }, null, 2));

  if (!result.ok) {
    process.exit(1);
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage.trim());
    process.exit(1);
  });
}
