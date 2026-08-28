import { describe, expect, it } from "vitest";

import {
  blacklistEntry,
  overviewWithTracks,
  secondSourceRecord,
  secondTrackRecord,
  sourceRecord,
  trackRecord
} from "./admin-music-review-test-support";
import {
  buildReviewBlacklistRow,
  buildReviewSelectionPayload,
  buildReviewSourceOptions,
  buildReviewTrackOptions,
  relationshipSelectionUnavailableMessage,
  sourceSelectionRequiredMessage,
  sourceSelectionUnavailableMessage,
  sourceTrackMismatchMessage,
  trackSelectionRequiredMessage
} from "./admin-music-review-selection.rules";

describe("admin music review selection rules", () => {
  it("builds readable track and source options from the current admin overview", () => {
    expect(buildReviewTrackOptions([trackRecord])).toEqual([{
      id: "track-readable-1",
      label: "Readable Track / Safe Artist"
    }]);

    expect(buildReviewSourceOptions([trackRecord], null)).toEqual([{
      id: "source-readable-1",
      label: "Readable Track / Safe Artist / Creator-safe local file / local_audio / youtube-audio-library"
    }]);
  });

  it("maps readable selections back to private API ids and rejects stale combinations", () => {
    expect(buildReviewSelectionPayload([trackRecord], "source", trackRecord.id, sourceRecord.id)).toEqual({
      ok: true,
      sourceId: sourceRecord.id,
      trackId: trackRecord.id
    });

    expect(buildReviewSelectionPayload([trackRecord], "source", trackRecord.id, secondSourceRecord.id)).toEqual({
      ok: false,
      reason: sourceSelectionUnavailableMessage
    });

    expect(buildReviewSelectionPayload([trackRecord, secondTrackRecord], "source", trackRecord.id, secondSourceRecord.id)).toEqual({
      ok: false,
      reason: sourceTrackMismatchMessage
    });

    expect(buildReviewSelectionPayload([trackRecord], "keyword", "track-stale-secret", "source-stale-secret")).toEqual({
      ok: true,
      sourceId: null,
      trackId: null
    });

    expect(buildReviewSelectionPayload([trackRecord], "track", null, null)).toEqual({
      ok: false,
      reason: trackSelectionRequiredMessage
    });
    expect(buildReviewSelectionPayload([trackRecord], "source", trackRecord.id, null)).toEqual({
      ok: false,
      reason: sourceSelectionRequiredMessage
    });
    expect(buildReviewSelectionPayload([trackRecord], "source", trackRecord.id, sourceRecord.id, false)).toEqual({
      ok: false,
      reason: relationshipSelectionUnavailableMessage
    });
  });

  it("formats saved blacklist relationships without rendering private track or source ids", () => {
    expect(buildReviewBlacklistRow(blacklistEntry("blacklist-track"), overviewWithTracks.tracks)).toMatchObject({
      meta: "track / Safe Artist",
      title: "Readable Track"
    });
    expect(buildReviewBlacklistRow(blacklistEntry("blacklist-source"), overviewWithTracks.tracks)).toMatchObject({
      meta: "source / local_audio / youtube-audio-library",
      title: "Creator-safe local file / Readable Track / Safe Artist"
    });
    expect(buildReviewBlacklistRow(blacklistEntry("blacklist-stale-source"), overviewWithTracks.tracks)).toMatchObject({
      meta: "source / relationship unavailable",
      title: "Source unavailable"
    });
    expect(buildReviewBlacklistRow(blacklistEntry("blacklist-provider"), overviewWithTracks.tracks)).toMatchObject({
      meta: "provider / youtube-audio-library",
      title: "youtube-audio-library"
    });
    expect(buildReviewBlacklistRow(blacklistEntry("blacklist-mismatched-source"), overviewWithTracks.tracks)).toMatchObject({
      meta: "source / local_audio / youtube-audio-library",
      title: "Backup catalog source / Other Track / Other Artist"
    });
  });
});
