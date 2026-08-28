import {
  isPublicMusicSelectionReference,
  publicMusicPreviewUrlMaxLength,
  publicMusicSelectionReferenceMaxLength
} from "@maiks-yt/domain/music";

import type {
  MusicPublicApiCatalogTrack,
  MusicRequestResult
} from "./music-api.types";

type PublicMusicCatalogFailureReason = "music_unavailable";
type PublicMusicRequestFailureReason =
  | "music_invalid_input"
  | "music_request_daily_limit"
  | "music_request_unavailable"
  | "music_track_not_selectable";

export type PublicMusicCatalogResponse =
  | { readonly ok: true; readonly tracks: readonly MusicPublicApiCatalogTrack[] }
  | { readonly ok: false; readonly reason: PublicMusicCatalogFailureReason };

const catalogFailureReasons = new Set<PublicMusicCatalogFailureReason>(["music_unavailable"]);
const requestFailureReasons = new Set<PublicMusicRequestFailureReason>([
  "music_invalid_input",
  "music_request_daily_limit",
  "music_request_unavailable",
  "music_track_not_selectable"
]);
const publicMusicCatalogTrackMaxCount = 100;
const publicMusicTextMaxLength = 191;
const publicMusicAttributionMaxLength = 1_000;
const publicMusicMimeTypeMaxLength = 120;
const catalogEnvelopeKeys = ["ok", "tracks", "reason"] as const;
const catalogTrackKeys = [
  "selectionReference",
  "title",
  "artist",
  "durationSeconds",
  "providerName",
  "sourceLabel",
  "liveSafe",
  "vodSafe",
  "previewUrl",
  "previewMimeType",
  "attributionText"
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).every((key) => keys.includes(key));

const hasRequiredKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  keys.every((key) => Object.hasOwn(value, key));

const isBoundedNonEmptyString = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;

const isBoundedStringOrNull = (value: unknown, maxLength: number): value is string | null =>
  value === null || (typeof value === "string" && value.length <= maxLength);

const isDurationOrNull = (value: unknown): value is number | null =>
  value === null
  || (typeof value === "number"
    && Number.isSafeInteger(value)
    && value > 0);

const isHttpUrlOrNull = (value: unknown): value is string | null => {
  if (value === null) return true;
  if (typeof value !== "string" || value.length > publicMusicPreviewUrlMaxLength) return false;

  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:")
      && url.toString().length <= publicMusicPreviewUrlMaxLength;
  } catch {
    return false;
  }
};

const isCatalogFailureReason = (value: unknown): value is PublicMusicCatalogFailureReason =>
  typeof value === "string" && catalogFailureReasons.has(value as PublicMusicCatalogFailureReason);

const isRequestFailureReason = (value: unknown): value is PublicMusicRequestFailureReason =>
  typeof value === "string" && requestFailureReasons.has(value as PublicMusicRequestFailureReason);

const parsePublicMusicCatalogTrack = (value: unknown): MusicPublicApiCatalogTrack | null => {
  if (!isRecord(value)
    || !hasOnlyKeys(value, catalogTrackKeys)
    || !hasRequiredKeys(value, catalogTrackKeys)
    || typeof value.selectionReference !== "string"
    || value.selectionReference.length !== publicMusicSelectionReferenceMaxLength
    || !isPublicMusicSelectionReference(value.selectionReference)
    || !isBoundedNonEmptyString(value.title, publicMusicTextMaxLength)
    || !isBoundedNonEmptyString(value.artist, publicMusicTextMaxLength)
    || !isDurationOrNull(value.durationSeconds)
    || !isBoundedNonEmptyString(value.providerName, publicMusicTextMaxLength)
    || !isBoundedNonEmptyString(value.sourceLabel, publicMusicTextMaxLength)
    || typeof value.liveSafe !== "boolean"
    || typeof value.vodSafe !== "boolean"
    || !isHttpUrlOrNull(value.previewUrl)
    || !isBoundedStringOrNull(value.previewMimeType, publicMusicMimeTypeMaxLength)
    || (value.previewUrl === null && value.previewMimeType !== null)
    || !isBoundedStringOrNull(value.attributionText, publicMusicAttributionMaxLength)) {
    return null;
  }

  return {
    selectionReference: value.selectionReference,
    title: value.title,
    artist: value.artist,
    durationSeconds: value.durationSeconds,
    providerName: value.providerName,
    sourceLabel: value.sourceLabel,
    liveSafe: value.liveSafe,
    vodSafe: value.vodSafe,
    previewUrl: value.previewUrl,
    previewMimeType: value.previewMimeType,
    attributionText: value.attributionText
  };
};

export const parsePublicMusicCatalogResponse = (value: unknown): PublicMusicCatalogResponse | null => {
  if (!isRecord(value) || !hasOnlyKeys(value, catalogEnvelopeKeys)) return null;

  if (value.ok === false) {
    return hasOnlyKeys(value, ["ok", "reason"]) && isCatalogFailureReason(value.reason)
      ? { ok: false, reason: value.reason }
      : null;
  }

  if (value.ok !== true
    || !hasOnlyKeys(value, ["ok", "tracks"])
    || !Array.isArray(value.tracks)
    || value.tracks.length > publicMusicCatalogTrackMaxCount) {
    return null;
  }

  const tracks = value.tracks.map(parsePublicMusicCatalogTrack);
  if (tracks.some((track) => track === null)) return null;

  const parsedTracks = tracks as MusicPublicApiCatalogTrack[];
  const references = new Set(parsedTracks.map((track) => track.selectionReference));
  return references.size === parsedTracks.length
    ? { ok: true, tracks: parsedTracks }
    : null;
};

export const parsePublicMusicRequestResponse = (value: unknown): MusicRequestResult | null => {
  if (!isRecord(value) || !hasOnlyKeys(value, ["ok", "accepted", "reason"])) return null;

  if (value.ok === true) {
    return hasOnlyKeys(value, ["ok", "accepted"]) && value.accepted === true
      ? { ok: true, accepted: true }
      : null;
  }

  return value.ok === false && hasOnlyKeys(value, ["ok", "reason"]) && isRequestFailureReason(value.reason)
    ? { ok: false, reason: value.reason }
    : null;
};
