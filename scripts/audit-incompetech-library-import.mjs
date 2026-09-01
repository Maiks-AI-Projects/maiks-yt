#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const expectedManifestVersion = "incompetech-ccby4.v1";
const expectedSource = "incompetech";
const expectedTrackCount = 20;
const expectedGenres = ["contemporary", "electronica", "jazz", "soundtrack", "world"];
const expectedSha256 = "a9b84960595facde28c3f6b5183b442dfe31168130052bf46a12996841676ce5";
const expectedArtist = "Kevin MacLeod";
const expectedAttributionSource = "incompetech.com";
const expectedAttributionLicensePhrase = "Licensed under Creative Commons: By Attribution 4.0 License";
const sha256Pattern = /^[a-f0-9]{64}$/u;
const isrcPattern = /^USUAN[0-9]{7}$/u;

const usage = () => {
  process.stderr.write("Usage: node scripts/audit-incompetech-library-import.mjs --manifest <path> [--expected-sha256 <sha256>] [--json]\n");
};

const parseArgs = (argv) => {
  const args = {
    manifestPath: null,
    expectedSha256,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--manifest") {
      args.manifestPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (value === "--expected-sha256") {
      args.expectedSha256 = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (value === "--json") {
      args.json = true;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  return args;
};

const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

const sha256Hex = (bytes) => createHash("sha256").update(bytes).digest("hex");

const text = (value) => typeof value === "string" && value.trim() ? value.trim() : null;

const normalizeWhitespace = (value) => value.replace(/\s+/gu, " ").trim();

const hasExactIncompetechArtist = (artist) => normalizeWhitespace(artist) === expectedArtist;

const hasUsableIncompetechAttribution = ({ attributionText, title }) => {
  if (!text(attributionText) || !text(title)) {
    return false;
  }

  const normalizedAttribution = normalizeWhitespace(attributionText);
  const normalizedTitle = normalizeWhitespace(title);
  const expectedCredit = `"${normalizedTitle}" ${expectedArtist} (${expectedAttributionSource})`;

  return normalizedAttribution.includes(expectedCredit)
    && normalizedAttribution.includes(expectedAttributionLicensePhrase)
    && normalizedAttribution.toLowerCase().includes("creativecommons.org/licenses/by/4.0/");
};

const safeUrl = (value, predicate) => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && predicate(url) ? url.toString() : null;
  } catch {
    return null;
  }
};

const safeIncompetechPageUrl = (value) => safeUrl(value, (url) =>
  url.hostname === "incompetech.com"
  && url.pathname === "/music/royalty-free/index.html"
  && isrcPattern.test(url.searchParams.get("isrc") ?? "")
);

const safeIncompetechMp3Url = (value) => safeUrl(value, (url) =>
  url.hostname === "incompetech.com"
  && url.pathname.startsWith("/music/royalty-free/mp3-royaltyfree/")
  && url.pathname.toLowerCase().endsWith(".mp3")
);

const safeIncompetechCatalogUrl = (value) => safeUrl(value, (url) =>
  url.hostname === "incompetech.com"
  && (url.pathname === "/music/royalty-free/music.html" || url.pathname === "/music/royalty-free/pieces.json")
);

const increment = (record, key) => {
  record[key] = (record[key] ?? 0) + 1;
};

const addTrackRejection = (rejectedTracks, index, track, reason) => {
  rejectedTracks.push({
    index,
    externalId: isRecord(track) && typeof track.externalId === "string" ? track.externalId : null,
    title: isRecord(track) && typeof track.title === "string" ? track.title : null,
    reason
  });
};

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const readHash = async (path) => sha256Hex(await readFile(path));

const ffprobeAudio = (path) => {
  const result = spawnSync("ffprobe", [
    "-v", "error",
    "-select_streams", "a:0",
    "-show_entries", "stream=codec_name,duration",
    "-of", "json",
    path
  ], {
    encoding: "utf8"
  });

  if (result.status !== 0 || !result.stdout.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(result.stdout);
    const stream = Array.isArray(parsed.streams) ? parsed.streams[0] : null;
    return isRecord(stream)
      ? {
        codec: typeof stream.codec_name === "string" ? stream.codec_name : null,
        duration: Number(stream.duration)
      }
      : null;
  } catch {
    return null;
  }
};

export const auditIncompetechManifest = async ({
  manifestPath,
  expectedManifestSha256 = expectedSha256
}) => {
  const errors = [];
  const rejectedTracks = [];
  const duplicates = {
    externalIds: [],
    sha256s: [],
    sourceUrls: [],
    directFileUrls: []
  };
  const counts = {
    rightsStatus: {},
    genre: {},
    vocalsClass: {},
    totalUniqueSha256: 0,
    duplicatesRejected: 0
  };

  if (!manifestPath) {
    return {
      ok: false,
      reason: "missing_manifest_path",
      errors: ["missing_manifest_path"],
      rejectedTracks,
      counts
    };
  }

  const manifestBytes = await readFile(manifestPath);
  const manifestSha256 = sha256Hex(manifestBytes);

  if (expectedManifestSha256 && manifestSha256 !== expectedManifestSha256) {
    errors.push("manifest_sha256_mismatch");
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString("utf8"));
  } catch {
    return {
      ok: false,
      reason: "invalid_manifest_json",
      manifestPath,
      manifestSha256,
      expectedManifestSha256,
      errors: ["invalid_manifest_json"],
      rejectedTracks,
      counts
    };
  }

  if (!isRecord(manifest)
    || manifest.manifestVersion !== expectedManifestVersion
    || manifest.source !== expectedSource
    || typeof manifest.generatedAt !== "string"
    || Number.isNaN(Date.parse(manifest.generatedAt))
    || !Array.isArray(manifest.tracks)
    || manifest.tracks.length !== expectedTrackCount) {
    errors.push("invalid_manifest_header");
  }

  const providerEvidence = Array.isArray(manifest.providerEvidence) ? manifest.providerEvidence : [];
  for (const evidence of providerEvidence) {
    if (!isRecord(evidence) || !text(evidence.path) || !sha256Pattern.test(text(evidence.sha256) ?? "")) {
      errors.push("invalid_provider_evidence");
      continue;
    }
    if (await readHash(evidence.path) !== evidence.sha256) {
      errors.push("provider_evidence_hash_mismatch");
    }
  }

  const seen = {
    externalIds: new Set(),
    sha256s: new Set(),
    sourceUrls: new Set(),
    directFileUrls: new Set()
  };

  const tracks = Array.isArray(manifest.tracks) ? manifest.tracks : [];
  for (const [index, track] of tracks.entries()) {
    if (!isRecord(track)) {
      addTrackRejection(rejectedTracks, index, track, "invalid_track");
      continue;
    }

    const externalId = text(track.externalId);
    const isrc = text(track.isrc);
    const title = text(track.title);
    const artist = text(track.artist);
    const downloadedAt = text(track.downloadedAt);
    const genre = text(track.normalizedGenre);
    const vocalsClass = text(track.vocalsClass);
    const sourceUrl = safeIncompetechPageUrl(track.sourceUrl);
    const directFileUrl = safeIncompetechMp3Url(track.directFileUrl);
    const officialCatalogJsonUrl = safeIncompetechCatalogUrl(track.officialCatalogJsonUrl);
    const catalogUrl = safeIncompetechCatalogUrl(track.catalogUrl);
    const audio = isRecord(track.audio) ? track.audio : null;
    const proof = isRecord(track.proof) ? track.proof : null;

    increment(counts.rightsStatus, String(track.rightsStatus ?? "missing"));
    increment(counts.genre, String(track.normalizedGenre ?? "missing"));
    increment(counts.vocalsClass, String(track.vocalsClass ?? "missing"));

    if (!externalId || !isrc || externalId !== isrc || !isrcPattern.test(externalId) || !title || !artist) {
      addTrackRejection(rejectedTracks, index, track, "missing_identity_evidence");
      continue;
    }
    if (!hasExactIncompetechArtist(artist)) {
      addTrackRejection(rejectedTracks, index, track, "wrong_artist");
      continue;
    }
    if (seen.externalIds.has(externalId.toLowerCase())) {
      duplicates.externalIds.push(externalId);
      addTrackRejection(rejectedTracks, index, track, "duplicate_external_id");
      continue;
    }
    seen.externalIds.add(externalId.toLowerCase());

    if (!downloadedAt || Number.isNaN(Date.parse(downloadedAt)) || !genre || !expectedGenres.includes(genre)) {
      addTrackRejection(rejectedTracks, index, track, "missing_classification_evidence");
      continue;
    }
    if (vocalsClass !== "none"
      || track.liveSafe !== true
      || track.vodSafe !== true
      || track.commercialAllowed !== true
      || track.rightsStatus !== "universal-safe") {
      addTrackRejection(rejectedTracks, index, track, "unsafe_rights_or_classification");
      continue;
    }
    if (track.licenseName !== "Creative Commons Attribution 4.0"
      || track.licenseUrl !== "https://creativecommons.org/licenses/by/4.0/"
      || track.attributionRequired !== true
      || !text(track.attributionText)) {
      addTrackRejection(rejectedTracks, index, track, "missing_cc_by_4_evidence");
      continue;
    }
    if (!hasUsableIncompetechAttribution({
      attributionText: track.attributionText,
      title
    })) {
      addTrackRejection(rejectedTracks, index, track, "unusable_attribution");
      continue;
    }
    if (!sourceUrl || !directFileUrl || !officialCatalogJsonUrl || !catalogUrl) {
      addTrackRejection(rejectedTracks, index, track, "unsafe_source_url");
      continue;
    }
    if (seen.sourceUrls.has(sourceUrl.toLowerCase())) {
      duplicates.sourceUrls.push(sourceUrl);
      addTrackRejection(rejectedTracks, index, track, "duplicate_source_url");
      continue;
    }
    seen.sourceUrls.add(sourceUrl.toLowerCase());
    if (seen.directFileUrls.has(directFileUrl.toLowerCase())) {
      duplicates.directFileUrls.push(directFileUrl);
      addTrackRejection(rejectedTracks, index, track, "duplicate_direct_file_url");
      continue;
    }
    seen.directFileUrls.add(directFileUrl.toLowerCase());

    const sha256 = audio && text(audio.sha256);
    const storageRef = audio && text(audio.storageRef);
    const audioPath = audio && text(audio.path);
    const expectedStorageRef = `music-audio:${sha256}:incompetech/${genre}/${sha256}.mp3`;
    if (!audio
      || !sha256
      || !sha256Pattern.test(sha256)
      || !storageRef
      || storageRef !== expectedStorageRef
      || !audioPath
      || !audioPath.endsWith(`/library/${genre}/${sha256}.mp3`)
      || audio.mimeType !== "audio/mpeg"
      || audio.format !== "mp3"
      || audio.codec !== "mp3"
      || typeof track.durationSeconds !== "number"
      || Math.abs(track.durationSeconds - track.catalogDurationSeconds) > 1) {
      addTrackRejection(rejectedTracks, index, track, "invalid_audio_evidence");
      continue;
    }
    if (seen.sha256s.has(sha256)) {
      duplicates.sha256s.push(sha256);
      addTrackRejection(rejectedTracks, index, track, "duplicate_sha256");
      continue;
    }
    seen.sha256s.add(sha256);

    const actualAudioSha256 = await readHash(audioPath);
    if (actualAudioSha256 !== sha256) {
      addTrackRejection(rejectedTracks, index, track, "audio_sha256_mismatch");
      continue;
    }

    const audioProbe = ffprobeAudio(audioPath);
    if (!audioProbe
      || audioProbe.codec !== "mp3"
      || !Number.isFinite(audioProbe.duration)
      || Math.abs(audioProbe.duration - track.durationSeconds) > 0.5) {
      addTrackRejection(rejectedTracks, index, track, "audio_probe_mismatch");
      continue;
    }

    if (!proof
      || safeIncompetechPageUrl(proof.url) !== sourceUrl
      || !text(proof.catalogRowPath)
      || !text(proof.itemPagePath)
      || !text(proof.providerEvidenceManifest)
      || !sha256Pattern.test(text(proof.catalogRowSha256) ?? "")
      || !sha256Pattern.test(text(proof.itemPageSha256) ?? "")
      || !sha256Pattern.test(text(proof.providerSnapshotSha256) ?? "")
      || !text(proof.contentIdCaveat)?.toLowerCase().includes("content id")) {
      addTrackRejection(rejectedTracks, index, track, "missing_item_evidence");
      continue;
    }

    if (await readHash(proof.catalogRowPath) !== proof.catalogRowSha256
      || await readHash(proof.itemPagePath) !== proof.itemPageSha256) {
      addTrackRejection(rejectedTracks, index, track, "item_evidence_hash_mismatch");
      continue;
    }

    if (await readHash(proof.providerEvidenceManifest) !== proof.providerSnapshotSha256) {
      addTrackRejection(rejectedTracks, index, track, "provider_evidence_hash_mismatch");
    }
  }

  counts.totalUniqueSha256 = seen.sha256s.size;
  counts.duplicatesRejected = Object.values(duplicates).reduce((total, values) => total + values.length, 0);

  const exactGenreCounts = expectedGenres.every((genre) => counts.genre[genre] === 4);
  if (!exactGenreCounts) {
    errors.push("unexpected_genre_count");
  }
  if (counts.rightsStatus["universal-safe"] !== expectedTrackCount) {
    errors.push("unexpected_rights_count");
  }
  if (counts.vocalsClass.none !== expectedTrackCount) {
    errors.push("unexpected_vocals_count");
  }
  if (counts.totalUniqueSha256 !== expectedTrackCount) {
    errors.push("unexpected_unique_sha256_count");
  }
  if (rejectedTracks.length > 0) {
    errors.push("rejected_tracks_present");
  }

  const ok = errors.length === 0;

  return {
    ok,
    reason: ok ? null : (rejectedTracks[0]?.reason ?? errors[0] ?? "audit_failed"),
    manifestPath,
    manifestSha256,
    expectedManifestSha256,
    counts,
    duplicates,
    rejectedTracks,
    errors
  };
};

const main = async () => {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    usage();
    throw error;
  }

  if (!args.manifestPath) {
    usage();
    process.exitCode = 2;
    return;
  }

  const result = await auditIncompetechManifest({
    manifestPath: args.manifestPath,
    expectedManifestSha256: args.expectedSha256
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 1;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stdout.write(`${JSON.stringify({
      ok: false,
      reason: "audit_exception",
      errors: [error instanceof Error ? error.message : String(error)]
    }, null, 2)}\n`);
    process.exitCode = 1;
  });
}
