import type { MusicCatalogTrack, MusicSafetyContext } from "./music-track.types";

const normalizeSearchText = (value: string): string => value.trim().toLocaleLowerCase();

const trackSearchText = (track: MusicCatalogTrack): string =>
  [
    track.title,
    track.artist,
    track.provider,
    track.sourceLabel ?? "",
    track.attributionCue ?? ""
  ].join(" ").toLocaleLowerCase();

export const filterMusicTracks = (
  tracks: readonly MusicCatalogTrack[],
  query: string
): readonly MusicCatalogTrack[] => {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [...tracks];
  }

  return tracks.filter((track) => trackSearchText(track).includes(normalizedQuery));
};

export const getMusicTrackUnavailableReason = (
  track: MusicCatalogTrack,
  safetyContext: MusicSafetyContext
): string | null => {
  if (track.disabledReason?.trim()) {
    return track.disabledReason.trim();
  }

  if (track.unavailableReason?.trim()) {
    return track.unavailableReason.trim();
  }

  if ((safetyContext === "live" || safetyContext === "live-and-vod") && !track.liveSafe) {
    return "Not marked safe for live playback.";
  }

  if ((safetyContext === "vod" || safetyContext === "live-and-vod") && !track.vodSafe) {
    return "Not marked safe for VOD playback.";
  }

  return null;
};

export const isMusicTrackSelectable = (
  track: MusicCatalogTrack,
  safetyContext: MusicSafetyContext
): boolean => getMusicTrackUnavailableReason(track, safetyContext) === null;

export const getEnabledMusicTrackIndexes = (
  tracks: readonly MusicCatalogTrack[],
  safetyContext: MusicSafetyContext
): readonly number[] =>
  tracks.reduce<number[]>((indexes, track, index) => {
    if (isMusicTrackSelectable(track, safetyContext)) {
      indexes.push(index);
    }

    return indexes;
  }, []);

export const getInitialActiveMusicTrackIndex = (
  tracks: readonly MusicCatalogTrack[],
  selectedTrackId: string | null,
  safetyContext: MusicSafetyContext
): number => {
  if (tracks.length === 0) {
    return -1;
  }

  const selectedIndex = selectedTrackId
    ? tracks.findIndex((track) => track.id === selectedTrackId)
    : -1;

  if (
    selectedIndex >= 0
    && isMusicTrackSelectable(tracks[selectedIndex] as MusicCatalogTrack, safetyContext)
  ) {
    return selectedIndex;
  }

  return getEnabledMusicTrackIndexes(tracks, safetyContext)[0] ?? -1;
};

export const getNextMusicTrackIndex = (
  tracks: readonly MusicCatalogTrack[],
  currentIndex: number,
  movement: "next" | "previous" | "first" | "last",
  safetyContext: MusicSafetyContext
): number => {
  const enabledIndexes = getEnabledMusicTrackIndexes(tracks, safetyContext);

  if (enabledIndexes.length === 0) {
    return -1;
  }

  if (movement === "first") {
    return enabledIndexes[0] as number;
  }

  if (movement === "last") {
    return enabledIndexes[enabledIndexes.length - 1] as number;
  }

  const enabledPosition = enabledIndexes.indexOf(currentIndex);
  const fallbackPosition = movement === "next" ? -1 : 0;
  const currentPosition = enabledPosition >= 0 ? enabledPosition : fallbackPosition;
  const offset = movement === "next" ? 1 : -1;
  const nextPosition = (currentPosition + offset + enabledIndexes.length) % enabledIndexes.length;

  return enabledIndexes[nextPosition] as number;
};

export const getMusicSafetyLabels = (track: MusicCatalogTrack): readonly string[] => [
  track.liveSafe ? "Live safe" : "Live review",
  track.vodSafe ? "VOD safe" : "VOD review"
];
