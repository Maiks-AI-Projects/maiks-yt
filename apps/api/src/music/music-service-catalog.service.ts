import type { PublicMusicCatalogTrack } from "./music.types.js";

export const safeHttpUrlOrNull = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};

export const toPublicCatalogTrack = (track: {
  trackId: string;
  sourceId: string;
  title: string;
  artist: string;
  durationSeconds: number | null;
  providerKey: string;
  providerName: string;
  sourceLabel: string;
  liveSafe: boolean;
  vodSafe: boolean;
  previewUrl: string | null;
  previewMimeType: string | null;
  sourceUrl: string | null;
  attributionText: string | null;
  licenseName: string;
  licenseKind: string;
  providerPolicyUrl: string | null;
  providerTermsUrl: string | null;
}): PublicMusicCatalogTrack => ({
  trackId: track.trackId,
  sourceId: track.sourceId,
  title: track.title,
  artist: track.artist,
  durationSeconds: track.durationSeconds,
  providerKey: track.providerKey,
  providerName: track.providerName,
  sourceLabel: track.sourceLabel,
  liveSafe: track.liveSafe,
  vodSafe: track.vodSafe,
  previewUrl: safeHttpUrlOrNull(track.previewUrl),
  previewMimeType: track.previewMimeType,
  sourceUrl: safeHttpUrlOrNull(track.sourceUrl),
  attributionText: track.attributionText,
  licenseName: track.licenseName,
  licenseKind: track.licenseKind,
  licenseUrl: null,
  providerPolicyUrl: safeHttpUrlOrNull(track.providerPolicyUrl),
  providerTermsUrl: safeHttpUrlOrNull(track.providerTermsUrl)
});
