import type {
  MusicApiCatalogTrack,
  MusicTopTrackPick,
  MusicTrackAdminRecord,
  MusicUiTrack
} from "./music-api.types";

export const buildMusicUiTrackId = (trackId: string, sourceId: string | null): string =>
  sourceId ? `${trackId}::source::${sourceId}` : trackId;

export const toMusicSelectTrack = (track: MusicApiCatalogTrack): MusicUiTrack => ({
  artist: track.artist,
  attributionCue: track.attributionText,
  durationSeconds: track.durationSeconds,
  id: buildMusicUiTrackId(track.trackId, track.sourceId),
  liveSafe: track.liveSafe,
  previewMimeType: track.previewMimeType,
  previewUrl: track.previewUrl,
  provider: track.providerName,
  providerKey: track.providerKey,
  sourceId: track.sourceId,
  sourceLabel: track.sourceLabel,
  title: track.title,
  trackId: track.trackId,
  vodSafe: track.vodSafe
});

export const adminTrackToMusicSelectTrack = (track: MusicTrackAdminRecord): MusicUiTrack => {
  const firstSource = track.sources[0] ?? null;
  const firstLicense = track.licenseSnapshots[0] ?? null;

  return {
    artist: track.artist,
    attributionCue: firstSource?.attributionText ?? firstLicense?.attributionText ?? null,
    durationSeconds: track.durationSeconds,
    id: track.id,
    liveSafe: track.liveSafe,
    previewMimeType: firstSource?.previewMimeType ?? null,
    previewUrl: firstSource?.previewUrl ?? null,
    provider: firstSource?.providerKey ?? "Manual catalog",
    providerKey: firstSource?.providerKey ?? "manual",
    sourceId: firstSource?.id ?? null,
    sourceLabel: firstSource?.sourceLabel ?? null,
    title: track.title,
    trackId: track.id,
    unavailableReason: track.reviewState === "blacklisted" ? "Blacklisted." : null,
    vodSafe: track.vodSafe
  };
};

export const topTrackPickToMusicTrack = (track: MusicTopTrackPick): MusicUiTrack => ({
  artist: track.artist,
  attributionCue: track.attributionText ?? track.licenseName,
  durationSeconds: track.durationSeconds,
  id: track.trackId,
  liveSafe: true,
  previewMimeType: null,
  previewUrl: null,
  provider: track.providerKey,
  providerKey: track.providerKey,
  sourceId: null,
  sourceLabel: null,
  title: track.title,
  trackId: track.trackId,
  vodSafe: true
});

export const formatMusicDuration = (seconds: number | null): string => {
  if (!seconds || seconds < 1) {
    return "Unknown length";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};
