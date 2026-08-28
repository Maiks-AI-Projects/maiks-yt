import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { vi } from "vitest";

import type {
  MusicAdminOverview,
  MusicApiResult,
  MusicTrackAdminRecord,
  MusicTrackSourceRecord
} from "../../../music/music-api.types";
import {
  createAdminMusicRecord,
  fetchAdminMusicOverview,
  resolveMusicReviewQueueItem
} from "../../../music/music-api.service";
import { emptyMusicAdminOverview } from "../admin-music-data.service";
import AdminMusicReviewClient from "./admin-music-review-client";

export { AdminMusicReviewClient, emptyMusicAdminOverview };

export const mockCreateAdminMusicRecord = vi.mocked(createAdminMusicRecord);
export const mockFetchAdminMusicOverview = vi.mocked(fetchAdminMusicOverview);
export const mockResolveMusicReviewQueueItem = vi.mocked(resolveMusicReviewQueueItem);

const now = "2026-08-29T12:00:00.000Z";

export const sourceRecord: MusicTrackSourceRecord = {
  id: "source-readable-1",
  trackId: "track-readable-1",
  providerPolicyId: null,
  providerKey: "youtube-audio-library",
  sourceType: "local_audio",
  sourceLabel: "Creator-safe local file",
  sourceExternalId: "yt-audio-1",
  sourceUrl: null,
  previewUrl: "https://example.test/preview.mp3",
  previewMimeType: "audio/mpeg",
  storageRef: "music/audio/file.mp3",
  sha256: "a".repeat(64),
  mimeType: "audio/mpeg",
  durationSeconds: 122,
  rightsState: "eligible",
  availabilityStatus: "available",
  attributionText: "Music by Safe Artist",
  createdAt: now,
  updatedAt: now
};

export const secondSourceRecord: MusicTrackSourceRecord = {
  ...sourceRecord,
  id: "source-readable-2",
  trackId: "track-readable-2",
  sourceLabel: "Backup catalog source"
};

export const trackRecord: MusicTrackAdminRecord = {
  id: "track-readable-1",
  slug: "readable-track",
  title: "Readable Track",
  artist: "Safe Artist",
  album: null,
  durationSeconds: 122,
  isrc: null,
  rightsState: "eligible",
  reviewState: "approved",
  liveSafe: true,
  vodSafe: true,
  explicitContent: false,
  instrumental: true,
  safetyTags: [],
  notesPrivate: null,
  createdAt: now,
  updatedAt: now,
  sources: [sourceRecord],
  licenseSnapshots: []
};

export const secondTrackRecord: MusicTrackAdminRecord = {
  ...trackRecord,
  id: "track-readable-2",
  slug: "other-readable-track",
  title: "Other Track",
  artist: "Other Artist",
  sources: [secondSourceRecord]
};

export const overviewWithTracks: MusicAdminOverview = {
  ...emptyMusicAdminOverview,
  blacklistEntries: [
    {
      id: "blacklist-track",
      scope: "track",
      trackId: trackRecord.id,
      sourceId: null,
      providerKey: null,
      normalizedValue: trackRecord.id,
      reason: "Manual review",
      severity: "rights",
      createdByUserId: "owner",
      revokedByUserId: null,
      revokedAt: null,
      revocationReason: null,
      createdAt: now
    },
    {
      id: "blacklist-source",
      scope: "source",
      trackId: trackRecord.id,
      sourceId: sourceRecord.id,
      providerKey: null,
      normalizedValue: sourceRecord.id,
      reason: "Manual review",
      severity: "safety",
      createdByUserId: "owner",
      revokedByUserId: null,
      revokedAt: null,
      revocationReason: null,
      createdAt: now
    },
    {
      id: "blacklist-stale-source",
      scope: "source",
      trackId: "track-stale-secret",
      sourceId: "source-stale-secret",
      providerKey: null,
      normalizedValue: "source-stale-secret",
      reason: "Manual review",
      severity: "permanent",
      createdByUserId: "owner",
      revokedByUserId: null,
      revokedAt: null,
      revocationReason: null,
      createdAt: now
    },
    {
      id: "blacklist-provider",
      scope: "provider",
      trackId: null,
      sourceId: null,
      providerKey: "youtube-audio-library",
      normalizedValue: "youtube-audio-library",
      reason: "Provider block",
      severity: "temporary",
      createdByUserId: "owner",
      revokedByUserId: null,
      revokedAt: null,
      revocationReason: null,
      createdAt: now
    },
    {
      id: "blacklist-mismatched-source",
      scope: "source",
      trackId: trackRecord.id,
      sourceId: secondSourceRecord.id,
      providerKey: null,
      normalizedValue: secondSourceRecord.id,
      reason: "Legacy mismatch",
      severity: "rights",
      createdByUserId: "owner",
      revokedByUserId: null,
      revokedAt: null,
      revocationReason: null,
      createdAt: now
    }
  ],
  reviewQueue: [{
    id: "review-1",
    trackId: trackRecord.id,
    sourceId: sourceRecord.id,
    requestId: null,
    playHistoryId: null,
    queueKind: "skip_review",
    status: "open",
    priority: "high",
    reasonCode: "skip",
    summary: "Skipped during stream",
    details: null,
    createdByUserId: null,
    assignedToUserId: null,
    resolvedByUserId: null,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now
  }],
  tracks: [trackRecord, secondTrackRecord]
};

export const overviewWithoutSources: MusicAdminOverview = {
  ...overviewWithTracks,
  tracks: [{
    ...trackRecord,
    sources: []
  }]
};

export const okOverview = (
  overview: MusicAdminOverview
): {
  readonly payload: MusicApiResult<MusicAdminOverview>;
  readonly status: number;
} => ({
  payload: {
    ok: true,
    ...overview
  },
  status: 200
});

export type AdminMusicOverviewResponse = ReturnType<typeof okOverview>;

export const blockedOverview = (status: number, reason: string): AdminMusicOverviewResponse => ({
  payload: { ok: false, reason },
  status
});

export const createDeferred = <T,>(): {
  readonly promise: Promise<T>;
  readonly reject: (error: unknown) => void;
  readonly resolve: (value: T) => void;
} => {
  let rejectPromise: (error: unknown) => void = () => undefined;
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    rejectPromise = reject;
    resolvePromise = resolve;
  });

  return {
    promise,
    reject: rejectPromise,
    resolve: resolvePromise
  };
};

export const blacklistEntry = (id: string) => {
  const entry = overviewWithTracks.blacklistEntries.find((candidate) => candidate.id === id);

  if (!entry) {
    throw new Error(`Missing blacklist fixture: ${id}`);
  }

  return entry;
};

export const textOf = (renderer: ReactTestRenderer): string => JSON.stringify(renderer.toJSON());

export const visibleTextOf = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(visibleTextOf).join(" ");
  }

  if (typeof value === "object" && value !== null && "children" in value) {
    return visibleTextOf((value as { readonly children?: unknown }).children);
  }

  return "";
};

export const renderReviewClient = async (): Promise<ReactTestRenderer> => {
  let renderer: ReactTestRenderer | null = null;

  await act(async () => {
    renderer = create(<AdminMusicReviewClient />);
    await Promise.resolve();
  });

  if (!renderer) {
    throw new Error("Review client did not render.");
  }

  return renderer;
};

export const waitForClientUpdates = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const findLabel = (renderer: ReactTestRenderer, label: string): ReactTestInstance => {
  const labels = renderer.root.findAllByType("label");
  const matchingLabel = labels.find((candidate) =>
    candidate.findAllByType("span").some((span) => span.children.includes(label))
  );

  if (!matchingLabel) {
    throw new Error(`Label did not render: ${label}`);
  }

  return matchingLabel;
};

export const findLabelSelect = (renderer: ReactTestRenderer, label: string): ReactTestInstance =>
  findLabel(renderer, label).findByType("select");

export const buttonText = (button: ReactTestInstance): string =>
  button.children.map((child) => typeof child === "string" ? child : "").join("");

export const findRefreshButton = (renderer: ReactTestRenderer): ReactTestInstance => {
  const refreshButton = renderer.root.findAllByType("button")
    .find((button) => buttonText(button) === "Refresh");

  if (!refreshButton) {
    throw new Error("Refresh button did not render.");
  }

  return refreshButton;
};

let testFormValues = new Map<string, string>();

class TestFormData {
  private readonly values = testFormValues;

  get(key: string): string | null {
    return this.values.get(key) ?? null;
  }
}

export const stubFormValues = (values: Record<string, string>): void => {
  testFormValues = new Map(Object.entries(values));
  vi.stubGlobal("FormData", TestFormData);
};

export const resetReviewTestMocks = (): void => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  mockCreateAdminMusicRecord.mockResolvedValue({
    payload: { ok: true },
    status: 200
  });
  mockResolveMusicReviewQueueItem.mockResolvedValue({
    payload: { ok: true },
    status: 200
  });
};

export const cleanupReviewTestMocks = (): void => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
};
