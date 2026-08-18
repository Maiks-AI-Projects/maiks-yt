import type { ReactNode } from "react";

export type MusicSafetyContext = "live" | "vod" | "live-and-vod" | "none";

export type MusicCatalogTrack = {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly durationSeconds?: number | null;
  readonly provider: string;
  readonly sourceLabel?: string | null;
  readonly liveSafe: boolean;
  readonly vodSafe: boolean;
  readonly attributionCue?: string | null;
  readonly previewUrl?: string | null;
  readonly previewMimeType?: string | null;
  readonly unavailableReason?: string | null;
  readonly disabledReason?: string | null;
};

export type MusicTrackActionSlot = (track: MusicCatalogTrack) => ReactNode;

export type MusicSearchableSelectState = "idle" | "loading" | "error";
