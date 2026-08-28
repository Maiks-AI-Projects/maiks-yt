import { publicMusicPreviewUrlMaxLength } from "@maiks-yt/domain/music";

import type { PublicMusicCatalogTrack } from "./music.types.js";
import { buildPublicMusicSelectionReference } from "./music-public-selection-reference.service.js";

export const safeHttpUrlOrNull = (value: string | null, maxLength?: number): string | null => {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const canonicalUrl = url.toString();
    return (url.protocol === "http:" || url.protocol === "https:")
      && (maxLength === undefined || canonicalUrl.length <= maxLength)
      ? canonicalUrl
      : null;
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
}): PublicMusicCatalogTrack => {
  const previewUrl = safeHttpUrlOrNull(track.previewUrl, publicMusicPreviewUrlMaxLength);

  return {
    selectionReference: buildPublicMusicSelectionReference({
      trackId: track.trackId,
      sourceId: track.sourceId
    }),
    title: track.title,
    artist: track.artist,
    durationSeconds: track.durationSeconds,
    providerName: track.providerName,
    sourceLabel: track.sourceLabel,
    liveSafe: track.liveSafe,
    vodSafe: track.vodSafe,
    previewUrl,
    previewMimeType: previewUrl ? track.previewMimeType : null,
    attributionText: track.attributionText
  };
};

export const toAccountCatalogTrack = (track: {
  trackId: string;
  title: string;
  artist: string;
  durationSeconds: number | null;
  providerName: string;
  sourceLabel: string;
  liveSafe: boolean;
  vodSafe: boolean;
  previewUrl: string | null;
  previewMimeType: string | null;
  attributionText: string | null;
}) => {
  const previewUrl = safeHttpUrlOrNull(track.previewUrl, publicMusicPreviewUrlMaxLength);

  return {
    trackId: track.trackId,
    title: track.title,
    artist: track.artist,
    durationSeconds: track.durationSeconds,
    providerName: track.providerName,
    sourceLabel: track.sourceLabel,
    liveSafe: track.liveSafe,
    vodSafe: track.vodSafe,
    previewUrl,
    previewMimeType: previewUrl ? track.previewMimeType : null,
    attributionText: track.attributionText
  };
};
