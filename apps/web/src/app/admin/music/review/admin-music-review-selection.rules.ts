import type {
  MusicBlacklistEntryRecord,
  MusicTrackAdminRecord,
  MusicTrackSourceRecord
} from "../../../music/music-api.types";
import type { MusicAdminLoadState } from "../admin-music-data.service";

export type AdminMusicReviewSelectionOption = {
  readonly id: string;
  readonly label: string;
};

export type AdminMusicReviewSelectionPayload =
  | {
    readonly ok: true;
    readonly sourceId: string | null;
    readonly trackId: string | null;
  }
  | {
    readonly ok: false;
    readonly reason: string;
  };

export type AdminMusicReviewBlacklistRow = {
  readonly action: string;
  readonly meta: string;
  readonly state: string;
  readonly title: string;
};

export const trackSelectionUnavailableMessage = "Selected track is no longer returned by the music catalog.";
export const sourceSelectionUnavailableMessage = "Selected source is no longer returned by the music catalog.";
export const sourceTrackMismatchMessage = "Selected source is not attached to the selected track.";
export const trackSelectionRequiredMessage = "Select a track before saving a track block.";
export const sourceSelectionRequiredMessage = "Select a source before saving a source block.";
export const relationshipSelectionUnavailableMessage = "Catalog relationships are unavailable. Refresh before saving a track or source block.";

export const getReviewSelectionStateMessage = (loadState: MusicAdminLoadState): string | null => {
  if (loadState === "loading") {
    return "Loading catalog relationships...";
  }

  if (loadState !== "ready") {
    return "Catalog relationships unavailable.";
  }

  return null;
};

export const buildReviewTrackOptions = (
  tracks: readonly MusicTrackAdminRecord[]
): readonly AdminMusicReviewSelectionOption[] =>
  tracks.map((track) => ({
    id: track.id,
    label: `${track.title} / ${track.artist}`
  }));

export const findReviewTrack = (
  tracks: readonly MusicTrackAdminRecord[],
  trackId: string | null
): MusicTrackAdminRecord | null =>
  trackId ? tracks.find((track) => track.id === trackId) ?? null : null;

export const findReviewSource = (
  tracks: readonly MusicTrackAdminRecord[],
  sourceId: string | null
): MusicTrackSourceRecord | null => {
  if (!sourceId) {
    return null;
  }

  for (const track of tracks) {
    const source = track.sources.find((candidate) => candidate.id === sourceId);

    if (source) {
      return source;
    }
  }

  return null;
};

export const buildReviewSourceOptions = (
  tracks: readonly MusicTrackAdminRecord[],
  selectedTrackId: string | null
): readonly AdminMusicReviewSelectionOption[] => {
  const selectedTrack = findReviewTrack(tracks, selectedTrackId);

  if (selectedTrackId && !selectedTrack) {
    return [];
  }

  const sourceTracks = selectedTrack ? [selectedTrack] : tracks;

  return sourceTracks.flatMap((track) =>
    track.sources.map((source) => ({
      id: source.id,
      label: `${track.title} / ${track.artist} / ${source.sourceLabel} / ${source.sourceType} / ${source.providerKey}`
    }))
  );
};

export const buildReviewSelectionPayload = (
  tracks: readonly MusicTrackAdminRecord[],
  scope: string,
  selectedTrackId: string | null,
  selectedSourceId: string | null,
  relationshipsAvailable = true
): AdminMusicReviewSelectionPayload => {
  if (scope !== "track" && scope !== "source") {
    return {
      ok: true,
      sourceId: null,
      trackId: null
    };
  }

  if (!relationshipsAvailable) {
    return { ok: false, reason: relationshipSelectionUnavailableMessage };
  }

  const selectedTrack = findReviewTrack(tracks, selectedTrackId);
  const selectedSource = findReviewSource(tracks, selectedSourceId);

  if (scope === "track" && !selectedTrackId) {
    return { ok: false, reason: trackSelectionRequiredMessage };
  }

  if (scope === "source" && !selectedSourceId) {
    return { ok: false, reason: sourceSelectionRequiredMessage };
  }

  if (selectedTrackId && !selectedTrack) {
    return { ok: false, reason: trackSelectionUnavailableMessage };
  }

  if (scope === "track") {
    return {
      ok: true,
      sourceId: null,
      trackId: selectedTrack?.id ?? null
    };
  }

  if (selectedSourceId && !selectedSource) {
    return { ok: false, reason: sourceSelectionUnavailableMessage };
  }

  if (selectedTrack && selectedSource && selectedSource.trackId !== selectedTrack.id) {
    return { ok: false, reason: sourceTrackMismatchMessage };
  }

  return {
    ok: true,
    sourceId: selectedSource?.id ?? null,
    trackId: selectedSource?.trackId ?? selectedTrack?.id ?? null
  };
};

const formatTrackTitle = (track: MusicTrackAdminRecord): string =>
  `${track.title} / ${track.artist}`;

const formatSourceTitle = (
  source: MusicTrackSourceRecord,
  track: MusicTrackAdminRecord | null
): string =>
  track
    ? `${source.sourceLabel} / ${formatTrackTitle(track)}`
    : `${source.sourceLabel} / Source track unavailable`;

const formatSourceMeta = (source: MusicTrackSourceRecord): string =>
  `${source.sourceType} / ${source.providerKey}`;

const formatProviderContext = (providerKey: string | null): string =>
  providerKey ? `provider / ${providerKey}` : "catalog";

const formatVisibleBlacklistValue = (entry: MusicBlacklistEntryRecord): string => {
  if (entry.normalizedValue === entry.trackId || entry.normalizedValue === entry.sourceId) {
    return "Value unavailable";
  }

  return entry.normalizedValue;
};

export const formatReviewBlacklistRelationship = (
  entry: MusicBlacklistEntryRecord,
  tracks: readonly MusicTrackAdminRecord[]
): {
  readonly meta: string;
  readonly title: string;
} => {
  const source = findReviewSource(tracks, entry.sourceId);
  const track = findReviewTrack(tracks, source?.trackId ?? entry.trackId ?? null);

  if (entry.scope === "source") {
    if (source) {
      return {
        meta: `source / ${formatSourceMeta(source)}`,
        title: formatSourceTitle(source, track)
      };
    }

    return {
      meta: "source / relationship unavailable",
      title: "Source unavailable"
    };
  }

  if (entry.scope === "track") {
    if (track) {
      return {
        meta: `track / ${track.artist}`,
        title: track.title
      };
    }

    return {
      meta: "track / relationship unavailable",
      title: "Track unavailable"
    };
  }

  if (source) {
    return {
      meta: `${entry.scope} / ${formatSourceMeta(source)}`,
      title: formatVisibleBlacklistValue(entry)
    };
  }

  if (entry.sourceId) {
    return {
      meta: `${entry.scope} / Source unavailable`,
      title: formatVisibleBlacklistValue(entry)
    };
  }

  if (track) {
    return {
      meta: `${entry.scope} / ${formatTrackTitle(track)}`,
      title: formatVisibleBlacklistValue(entry)
    };
  }

  if (entry.trackId) {
    return {
      meta: `${entry.scope} / Track unavailable`,
      title: formatVisibleBlacklistValue(entry)
    };
  }

  return {
    meta: `${entry.scope} / ${entry.providerKey ?? formatProviderContext(null)}`,
    title: formatVisibleBlacklistValue(entry)
  };
};

export const buildReviewBlacklistRow = (
  entry: MusicBlacklistEntryRecord,
  tracks: readonly MusicTrackAdminRecord[]
): AdminMusicReviewBlacklistRow => {
  const relationship = formatReviewBlacklistRelationship(entry, tracks);

  return {
    action: entry.revokedAt ? "Revoked" : "Active",
    meta: relationship.meta,
    state: entry.severity,
    title: relationship.title
  };
};
