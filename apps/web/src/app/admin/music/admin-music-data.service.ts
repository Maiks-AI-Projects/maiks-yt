"use client";

import { fetchAdminMusicOverview } from "../../music/music-api.service";
import type { MusicAdminOverview } from "../../music/music-api.types";

export type MusicAdminLoadState = "loading" | "ready" | "signed-out" | "forbidden" | "error";

export type MusicAdminLoadResult = {
  readonly loadState: MusicAdminLoadState;
  readonly overview: MusicAdminOverview;
};

export const emptyMusicAdminOverview: MusicAdminOverview = {
  blacklistEntries: [],
  playHistory: [],
  playlists: [],
  providerPolicies: [],
  reviewQueue: [],
  tracks: []
};

export const loadMusicAdminOverview = async (): Promise<MusicAdminLoadResult> => {
  try {
    const response = await fetchAdminMusicOverview();

    if (!response.payload.ok) {
      if (response.status === 401 || response.payload.reason === "not_authenticated") {
        return { loadState: "signed-out", overview: emptyMusicAdminOverview };
      }

      if (response.status === 403 || response.payload.reason.includes("forbidden")) {
        return { loadState: "forbidden", overview: emptyMusicAdminOverview };
      }

      return { loadState: "error", overview: emptyMusicAdminOverview };
    }

    return {
      loadState: "ready",
      overview: {
        blacklistEntries: response.payload.blacklistEntries,
        playHistory: response.payload.playHistory,
        playlists: response.payload.playlists,
        providerPolicies: response.payload.providerPolicies,
        reviewQueue: response.payload.reviewQueue,
        tracks: response.payload.tracks
      }
    };
  } catch {
    return { loadState: "error", overview: emptyMusicAdminOverview };
  }
};

export const formatAdminMusicDate = (value: string | null): string =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "No date";

export const stringValue = (formData: FormData, key: string): string => {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
};

export const nullableStringValue = (formData: FormData, key: string): string | null => {
  const value = stringValue(formData, key);

  return value.length > 0 ? value : null;
};

export const booleanValue = (formData: FormData, key: string): boolean => formData.get(key) === "on";

export const integerValue = (formData: FormData, key: string): number | null => {
  const value = stringValue(formData, key);
  const numberValue = Number.parseInt(value, 10);

  return Number.isFinite(numberValue) ? numberValue : null;
};
