"use client";

import { createApiHeaders } from "../dev-auth-token";
import type {
  MusicAdminOverview,
  MusicAudioUploadResult,
  MusicApiCatalogTrack,
  MusicApiResult,
  MusicRequestResult,
  MusicReviewAction,
  MusicTopTrackPick,
  MusicYouTubeAudioLibraryImportResult,
  MusicYouTubeAudioLibraryManifest
} from "./music-api.types";

export const musicApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.maiks.yt";

type ApiRequestOptions = {
  readonly body?: unknown;
  readonly method?: "GET" | "POST" | "PUT";
};

export type MusicApiResponse<TPayload> = {
  readonly payload: TPayload;
  readonly status: number;
};

const requestMusicJson = async <TPayload>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<MusicApiResponse<TPayload>> => {
  const headers = createApiHeaders(options.body === undefined
    ? {}
    : { "Content-Type": "application/json" });
  const init: RequestInit = {
    cache: "no-store",
    credentials: "include",
    headers,
    method: options.method ?? "GET"
  };

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${musicApiBaseUrl}${path}`, init);
  const payload = await response.json() as TPayload;

  return {
    payload,
    status: response.status
  };
};

export const fetchMusicCatalog = async (input: {
  readonly context?: "live" | "vod";
  readonly limit?: number;
  readonly query?: string;
} = {}): Promise<MusicApiResponse<MusicApiResult<{ readonly tracks: readonly MusicApiCatalogTrack[] }>>> => {
  const query = new URLSearchParams({
    context: input.context ?? "live",
    limit: String(input.limit ?? 100),
    query: input.query ?? ""
  });

  return await requestMusicJson(`/music/catalog?${query.toString()}`);
};

export const createMusicRequest = async (input: {
  readonly context?: "live" | "vod";
  readonly requestText?: string | null;
  readonly sourceId: string | null;
  readonly trackId: string;
}): Promise<MusicApiResponse<MusicRequestResult>> =>
  await requestMusicJson("/music/requests", {
    body: {
      context: input.context ?? "live",
      requestText: input.requestText ?? null,
      sourceId: input.sourceId,
      trackId: input.trackId
    },
    method: "POST"
  });

export const fetchMusicTopTracks = async (): Promise<MusicApiResponse<MusicApiResult<{
  readonly limit: number;
  readonly tracks: readonly MusicTopTrackPick[];
}>>> => await requestMusicJson("/account/music/top-tracks");

export const saveMusicTopTracks = async (
  tracks: readonly { readonly rank: number; readonly trackId: string }[]
): Promise<MusicApiResponse<MusicApiResult<{
  readonly limit: number;
  readonly tracks: readonly MusicTopTrackPick[];
}>>> => await requestMusicJson("/account/music/top-tracks", {
  body: { tracks },
  method: "PUT"
});

export const fetchAdminMusicOverview = async (): Promise<MusicApiResponse<MusicApiResult<MusicAdminOverview>>> =>
  await requestMusicJson("/admin/music");

export const createAdminMusicRecord = async <TResult>(
  path: string,
  body: Record<string, unknown>
): Promise<MusicApiResponse<MusicApiResult<TResult>>> =>
  await requestMusicJson(path, {
    body,
    method: "POST"
  });

export const updateAdminMusicRecord = async <TResult>(
  path: string,
  body: Record<string, unknown>
): Promise<MusicApiResponse<MusicApiResult<TResult>>> =>
  await requestMusicJson(path, {
    body,
    method: "PUT"
  });

export const resolveMusicReviewQueueItem = async (
  id: string,
  action: MusicReviewAction,
  note: string | null
): Promise<MusicApiResponse<MusicApiResult<{ readonly reviewQueueItem?: unknown }>>> =>
  await updateAdminMusicRecord(`/admin/music/review-queue/${encodeURIComponent(id)}/resolve`, {
    action,
    note
  });

export const uploadAdminMusicAudio = async (input: {
  readonly contentType: string;
  readonly dataBase64: string;
  readonly filename: string;
}): Promise<MusicApiResponse<MusicAudioUploadResult>> =>
  await requestMusicJson("/admin/music/imports/audio", {
    body: input,
    method: "POST"
  });

export const dryRunYouTubeAudioLibraryImport = async (
  manifest: MusicYouTubeAudioLibraryManifest
): Promise<MusicApiResponse<MusicYouTubeAudioLibraryImportResult>> =>
  await requestMusicJson("/admin/music/imports/youtube-audio-library/dry-run", {
    body: { manifest },
    method: "POST"
  });

export const applyYouTubeAudioLibraryImport = async (
  manifest: MusicYouTubeAudioLibraryManifest
): Promise<MusicApiResponse<MusicYouTubeAudioLibraryImportResult>> =>
  await requestMusicJson("/admin/music/imports/youtube-audio-library/apply", {
    body: { manifest },
    method: "POST"
  });
