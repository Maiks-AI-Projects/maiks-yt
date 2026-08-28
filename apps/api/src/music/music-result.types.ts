import type { MusicPlayHistoryRecord } from "./music-record.types.js";

export type MusicTrackRequestCreateResult =
  | {
    ok: true;
    request: {
      id: string;
      trackId: string;
      sourceId: string;
      status: string;
      amsterdamDate: string;
      createdAt: string;
    };
  }
  | {
    ok: false;
    reason: "music_request_daily_limit" | "music_track_not_selectable";
  };

export type MusicPlayHistoryAppendResult =
  | {
    ok: true;
    history: MusicPlayHistoryRecord;
    reviewQueued: boolean;
  }
  | {
    ok: false;
    reason: "music_track_not_found" | "music_track_not_selectable";
  };
