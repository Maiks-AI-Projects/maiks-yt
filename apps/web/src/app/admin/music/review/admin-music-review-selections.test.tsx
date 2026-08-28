import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: {
    readonly children: React.ReactNode;
    readonly href: string;
  }) => <a href={href} {...props}>{children}</a>
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/music/review"
}));

vi.mock("../../../dev-auth-token", () => ({
  captureDevAuthTokenFromUrl: vi.fn(),
  createApiHeaders: vi.fn((headers: HeadersInit = {}) => headers)
}));

vi.mock("../../../music/music-api.service", () => ({
  createAdminMusicRecord: vi.fn(),
  fetchAdminMusicOverview: vi.fn(),
  resolveMusicReviewQueueItem: vi.fn()
}));

const now = "2026-08-29T12:00:00.000Z";

const sourceRecord: MusicTrackSourceRecord = {
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

const secondSourceRecord: MusicTrackSourceRecord = {
  ...sourceRecord,
  id: "source-readable-2",
  trackId: "track-readable-2",
  sourceLabel: "Backup catalog source"
};

const trackRecord: MusicTrackAdminRecord = {
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

const secondTrackRecord: MusicTrackAdminRecord = {
  ...trackRecord,
  id: "track-readable-2",
  slug: "other-readable-track",
  title: "Other Track",
  artist: "Other Artist",
  sources: [secondSourceRecord]
};

const overviewWithTracks: MusicAdminOverview = {
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

const overviewWithoutSources: MusicAdminOverview = {
  ...overviewWithTracks,
  tracks: [{
    ...trackRecord,
    sources: []
  }]
};

const okOverview = (
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

type AdminMusicOverviewResponse = ReturnType<typeof okOverview>;

const blockedOverview = (status: number, reason: string): AdminMusicOverviewResponse => ({
  payload: { ok: false, reason },
  status
});

const createDeferred = <T,>(): {
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

const blacklistEntry = (id: string) => {
  const entry = overviewWithTracks.blacklistEntries.find((candidate) => candidate.id === id);

  if (!entry) {
    throw new Error(`Missing blacklist fixture: ${id}`);
  }

  return entry;
};

const textOf = (renderer: ReactTestRenderer): string => JSON.stringify(renderer.toJSON());

const visibleTextOf = (value: unknown): string => {
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

const renderReviewClient = async (): Promise<ReactTestRenderer> => {
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

const waitForClientUpdates = async (): Promise<void> => {
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

const findLabelSelect = (renderer: ReactTestRenderer, label: string): ReactTestInstance =>
  findLabel(renderer, label).findByType("select");

const buttonText = (button: ReactTestInstance): string =>
  button.children.map((child) => typeof child === "string" ? child : "").join("");

const findRefreshButton = (renderer: ReactTestRenderer): ReactTestInstance => {
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

const stubFormValues = (values: Record<string, string>): void => {
  testFormValues = new Map(Object.entries(values));
  vi.stubGlobal("FormData", TestFormData);
};

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  vi.mocked(createAdminMusicRecord).mockResolvedValue({
    payload: { ok: true },
    status: 200
  });
  vi.mocked(resolveMusicReviewQueueItem).mockResolvedValue({
    payload: { ok: true },
    status: 200
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("admin music review selections", () => {
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

  it("renders readable compact selections instead of raw relationship id fields", async () => {
    vi.mocked(fetchAdminMusicOverview).mockResolvedValue(okOverview(overviewWithTracks));
    const renderer = await renderReviewClient();
    const rendered = textOf(renderer);

    expect(rendered).toContain("Readable Track / Safe Artist");
    expect(rendered).toContain("Creator-safe local file");
    expect(rendered).toContain("youtube-audio-library");
    expect(rendered).not.toContain("Track id");
    expect(rendered).not.toContain("Source id");
    expect(renderer.root.findAllByType("input").some((input) => input.props.name === "trackId")).toBe(false);
    expect(renderer.root.findAllByType("input").some((input) => input.props.name === "sourceId")).toBe(false);

    await act(async () => {
      renderer.unmount();
    });
  });

  it("submits review decisions through the existing queue action path", async () => {
    vi.mocked(fetchAdminMusicOverview).mockResolvedValue(okOverview(overviewWithTracks));
    const renderer = await renderReviewClient();
    const keepButton = renderer.root.findAllByType("button")
      .find((button) => buttonText(button) === "Keep");

    if (!keepButton) {
      throw new Error("Keep button did not render.");
    }

    await act(async () => {
      keepButton.props.onClick();
      await waitForClientUpdates();
    });

    expect(resolveMusicReviewQueueItem).toHaveBeenCalledWith("review-1", "keep", null);

    await act(async () => {
      renderer.unmount();
    });
  });

  it("submits selected relationship ids while keeping them out of visible form fields", async () => {
    stubFormValues({
      normalizedValue: "readable track",
      providerKey: "",
      reason: "Reviewed source block",
      scope: "source",
      severity: "rights"
    });
    vi.mocked(fetchAdminMusicOverview).mockResolvedValue(okOverview(overviewWithTracks));
    const renderer = await renderReviewClient();
    const sourceSelect = findLabelSelect(renderer, "Source");

    await act(async () => {
      sourceSelect.props.onChange({ currentTarget: { value: sourceRecord.id } });
    });

    await act(async () => {
      await renderer.root.findByType("form").props.onSubmit({
        currentTarget: {},
        preventDefault: vi.fn()
      });
    });

    expect(createAdminMusicRecord).toHaveBeenCalledWith("/admin/music/blacklist", {
      normalizedValue: "readable track",
      providerKey: null,
      reason: "Reviewed source block",
      scope: "source",
      severity: "rights",
      sourceId: sourceRecord.id,
      trackId: trackRecord.id
    });

    await act(async () => {
      renderer.unmount();
    });
  });

  it("blocks incomplete relationship scopes before saving the blacklist entry", async () => {
    vi.mocked(fetchAdminMusicOverview).mockResolvedValue(okOverview(overviewWithTracks));

    stubFormValues({
      normalizedValue: "readable track",
      providerKey: "",
      reason: "Track block needs a selected track",
      scope: "track",
      severity: "rights"
    });
    const trackRenderer = await renderReviewClient();
    await act(async () => {
      await trackRenderer.root.findByType("form").props.onSubmit({
        currentTarget: {},
        preventDefault: vi.fn()
      });
    });
    expect(createAdminMusicRecord).not.toHaveBeenCalled();
    expect(textOf(trackRenderer)).toContain(trackSelectionRequiredMessage);
    await act(async () => {
      trackRenderer.unmount();
    });

    vi.mocked(createAdminMusicRecord).mockClear();
    stubFormValues({
      normalizedValue: "readable source",
      providerKey: "",
      reason: "Source block needs a selected source",
      scope: "source",
      severity: "rights"
    });
    const sourceRenderer = await renderReviewClient();
    await act(async () => {
      await sourceRenderer.root.findByType("form").props.onSubmit({
        currentTarget: {},
        preventDefault: vi.fn()
      });
    });
    expect(createAdminMusicRecord).not.toHaveBeenCalled();
    expect(textOf(sourceRenderer)).toContain(sourceSelectionRequiredMessage);
    await act(async () => {
      sourceRenderer.unmount();
    });
  });

  it("shows empty, loading, error, and invalid relationship states without raw ids", async () => {
    vi.mocked(fetchAdminMusicOverview).mockResolvedValueOnce(okOverview(emptyMusicAdminOverview));
    const emptyRenderer = await renderReviewClient();
    expect(textOf(emptyRenderer)).toContain("No catalog tracks returned.");
    expect(textOf(emptyRenderer)).toContain("No matching sources returned.");
    expect(textOf(emptyRenderer)).not.toContain("Track id");
    await act(async () => {
      emptyRenderer.unmount();
    });

    vi.mocked(fetchAdminMusicOverview).mockReturnValue(new Promise(() => undefined));
    let loadingRenderer: ReactTestRenderer | null = null;
    await act(async () => {
      loadingRenderer = create(<AdminMusicReviewClient />);
    });
    if (!loadingRenderer) {
      throw new Error("Loading review client did not render.");
    }

    expect(textOf(loadingRenderer)).toContain("Loading catalog relationships...");
    expect(textOf(loadingRenderer)).not.toContain("Source id");
    await act(async () => {
      loadingRenderer?.unmount();
    });

    vi.mocked(fetchAdminMusicOverview).mockResolvedValue({
      payload: { ok: false, reason: "music_admin_unavailable" },
      status: 500
    });
    const errorRenderer = await renderReviewClient();
    expect(textOf(errorRenderer)).toContain("Catalog relationships unavailable.");
    expect(findLabelSelect(errorRenderer, "Track").props.disabled).toBe(true);
    await act(async () => {
      errorRenderer.unmount();
    });

    stubFormValues({
      normalizedValue: "readable track",
      providerKey: "",
      reason: "Reviewed source block",
      scope: "source",
      severity: "rights"
    });
    vi.mocked(fetchAdminMusicOverview)
      .mockResolvedValueOnce(okOverview(overviewWithTracks))
      .mockResolvedValue(okOverview(overviewWithoutSources));
    const invalidRenderer = await renderReviewClient();
    const sourceSelect = findLabelSelect(invalidRenderer, "Source");
    await act(async () => {
      sourceSelect.props.onChange({ currentTarget: { value: sourceRecord.id } });
    });
    const refreshButton = invalidRenderer.root.findAllByType("button")
      .find((button) => buttonText(button) === "Refresh");

    if (!refreshButton) {
      throw new Error("Refresh button did not render.");
    }

    await act(async () => {
      refreshButton.props.onClick();
      await waitForClientUpdates();
    });

    vi.mocked(createAdminMusicRecord).mockClear();
    expect(textOf(invalidRenderer)).toContain(sourceSelectionUnavailableMessage);
    expect(findLabelSelect(invalidRenderer, "Source").props.disabled).toBe(false);
    await act(async () => {
      await invalidRenderer.root.findByType("form").props.onSubmit({
        currentTarget: {},
        preventDefault: vi.fn()
      });
    });
    expect(createAdminMusicRecord).not.toHaveBeenCalled();
    expect(textOf(invalidRenderer)).toContain(sourceSelectionUnavailableMessage);

    await act(async () => {
      invalidRenderer.unmount();
    });
  });

  it("keeps visible saved rows readable for current and stale relationships", async () => {
    vi.mocked(fetchAdminMusicOverview).mockResolvedValue(okOverview(overviewWithTracks));
    const renderer = await renderReviewClient();
    const rendered = visibleTextOf(renderer.toJSON());

    expect(rendered).toContain("Readable Track");
    expect(rendered).toContain("Creator-safe local file / Readable Track / Safe Artist");
    expect(rendered).toContain("Backup catalog source / Other Track / Other Artist");
    expect(rendered).toContain("Source unavailable");
    expect(rendered).toContain("provider / youtube-audio-library");
    expect(rendered).not.toContain("provider / provider / youtube-audio-library");
    expect(rendered).not.toContain(trackRecord.id);
    expect(rendered).not.toContain(sourceRecord.id);
    expect(rendered).not.toContain(secondSourceRecord.id);
    expect(rendered).not.toContain("track-stale-secret");
    expect(rendered).not.toContain("source-stale-secret");

    await act(async () => {
      renderer.unmount();
    });
  });

  it("clears source when track is cleared or changed away from the selected source", async () => {
    vi.mocked(fetchAdminMusicOverview).mockResolvedValue(okOverview(overviewWithTracks));
    const renderer = await renderReviewClient();

    await act(async () => {
      findLabelSelect(renderer, "Source").props.onChange({ currentTarget: { value: sourceRecord.id } });
    });
    expect(findLabelSelect(renderer, "Track").props.value).toBe(trackRecord.id);
    expect(findLabelSelect(renderer, "Source").props.value).toBe(sourceRecord.id);

    await act(async () => {
      findLabelSelect(renderer, "Track").props.onChange({ currentTarget: { value: "" } });
    });
    expect(findLabelSelect(renderer, "Track").props.value).toBe("");
    expect(findLabelSelect(renderer, "Source").props.value).toBe("");

    await act(async () => {
      findLabelSelect(renderer, "Source").props.onChange({ currentTarget: { value: sourceRecord.id } });
    });
    await act(async () => {
      findLabelSelect(renderer, "Track").props.onChange({ currentTarget: { value: secondTrackRecord.id } });
    });
    expect(findLabelSelect(renderer, "Track").props.value).toBe(secondTrackRecord.id);
    expect(findLabelSelect(renderer, "Source").props.value).toBe("");

    await act(async () => {
      renderer.unmount();
    });
  });

  it("lets unrelated blacklist scopes submit after clearing a stale source selection", async () => {
    stubFormValues({
      normalizedValue: "ambient",
      providerKey: "",
      reason: "Keyword is not stream-safe",
      scope: "keyword",
      severity: "safety"
    });
    vi.mocked(fetchAdminMusicOverview)
      .mockResolvedValueOnce(okOverview(overviewWithTracks))
      .mockResolvedValue(okOverview(overviewWithoutSources));
    const renderer = await renderReviewClient();

    await act(async () => {
      findLabelSelect(renderer, "Source").props.onChange({ currentTarget: { value: sourceRecord.id } });
    });
    const refreshButton = renderer.root.findAllByType("button")
      .find((button) => buttonText(button) === "Refresh");

    if (!refreshButton) {
      throw new Error("Refresh button did not render.");
    }

    await act(async () => {
      refreshButton.props.onClick();
      await waitForClientUpdates();
    });
    await act(async () => {
      findLabelSelect(renderer, "Track").props.onChange({ currentTarget: { value: "" } });
    });
    expect(findLabelSelect(renderer, "Source").props.value).toBe("");

    await act(async () => {
      await renderer.root.findByType("form").props.onSubmit({
        currentTarget: {},
        preventDefault: vi.fn()
      });
    });

    expect(createAdminMusicRecord).toHaveBeenCalledWith("/admin/music/blacklist", {
      normalizedValue: "ambient",
      providerKey: null,
      reason: "Keyword is not stream-safe",
      scope: "keyword",
      severity: "safety",
      sourceId: null,
      trackId: null
    });

    await act(async () => {
      renderer.unmount();
    });
  });

  it("preserves the last loaded overview on refresh error and blocks relationship saves until relationships are available", async () => {
    vi.mocked(fetchAdminMusicOverview)
      .mockResolvedValueOnce(okOverview(overviewWithTracks))
      .mockResolvedValue({
        payload: { ok: false, reason: "music_admin_unavailable" },
        status: 500
      });
    stubFormValues({
      normalizedValue: "readable source",
      providerKey: "",
      reason: "Source block after failed refresh",
      scope: "source",
      severity: "rights"
    });
    const renderer = await renderReviewClient();

    await act(async () => {
      findLabelSelect(renderer, "Source").props.onChange({ currentTarget: { value: sourceRecord.id } });
    });
    const refreshButton = renderer.root.findAllByType("button")
      .find((button) => buttonText(button) === "Refresh");

    if (!refreshButton) {
      throw new Error("Refresh button did not render.");
    }

    await act(async () => {
      refreshButton.props.onClick();
      await waitForClientUpdates();
    });

    expect(textOf(renderer)).toContain("Catalog relationships unavailable.");
    expect(textOf(renderer)).toContain("Readable Track / Safe Artist");
    expect(textOf(renderer)).not.toContain(sourceSelectionUnavailableMessage);

    vi.mocked(createAdminMusicRecord).mockClear();
    await act(async () => {
      await renderer.root.findByType("form").props.onSubmit({
        currentTarget: {},
        preventDefault: vi.fn()
      });
    });
    expect(createAdminMusicRecord).not.toHaveBeenCalled();
    expect(textOf(renderer)).toContain(relationshipSelectionUnavailableMessage);

    stubFormValues({
      normalizedValue: "ambient",
      providerKey: "",
      reason: "Keyword is still independent",
      scope: "keyword",
      severity: "safety"
    });
    await act(async () => {
      await renderer.root.findByType("form").props.onSubmit({
        currentTarget: {},
        preventDefault: vi.fn()
      });
    });
    expect(createAdminMusicRecord).toHaveBeenCalledWith("/admin/music/blacklist", {
      normalizedValue: "ambient",
      providerKey: null,
      reason: "Keyword is still independent",
      scope: "keyword",
      severity: "safety",
      sourceId: null,
      trackId: null
    });

    await act(async () => {
      renderer.unmount();
    });
  });

  it.each([
    ["signed-out", 401, "not_authenticated"],
    ["forbidden", 403, "admin_forbidden"]
  ])("clears private review data and selections after %s refresh", async (_label, status, reason) => {
    vi.mocked(fetchAdminMusicOverview)
      .mockResolvedValueOnce(okOverview(overviewWithTracks))
      .mockResolvedValue({
        payload: { ok: false, reason },
        status
      });
    const renderer = await renderReviewClient();

    await act(async () => {
      findLabelSelect(renderer, "Source").props.onChange({ currentTarget: { value: sourceRecord.id } });
    });
    expect(findLabelSelect(renderer, "Track").props.value).toBe(trackRecord.id);
    expect(findLabelSelect(renderer, "Source").props.value).toBe(sourceRecord.id);

    const refreshButton = renderer.root.findAllByType("button")
      .find((button) => buttonText(button) === "Refresh");

    if (!refreshButton) {
      throw new Error("Refresh button did not render.");
    }

    await act(async () => {
      refreshButton.props.onClick();
      await waitForClientUpdates();
    });

    const renderedText = visibleTextOf(renderer.toJSON());
    const renderedJson = textOf(renderer);
    expect(renderedText).not.toContain("Readable Track");
    expect(renderedText).not.toContain("Creator-safe local file");
    expect(renderedText).not.toContain("Skipped during stream");
    expect(renderedText).not.toContain("Source unavailable");
    expect(renderedJson).not.toContain(trackRecord.id);
    expect(renderedJson).not.toContain(sourceRecord.id);
    expect(findLabelSelect(renderer, "Track").props.value).toBe("");
    expect(findLabelSelect(renderer, "Source").props.value).toBe("");
    expect(renderer.root.findAllByType("button").some((button) => buttonText(button) === "Keep")).toBe(false);
    expect(renderer.root.findAllByType("button").some((button) => buttonText(button) === "Blacklist")).toBe(false);

    await act(async () => {
      renderer.unmount();
    });
  });

  it("keeps a newer signed-out refresh cleared when an older success resolves afterward", async () => {
    const olderSuccess = createDeferred<AdminMusicOverviewResponse>();
    const newerSignedOut = createDeferred<AdminMusicOverviewResponse>();
    vi.mocked(fetchAdminMusicOverview)
      .mockReturnValueOnce(olderSuccess.promise)
      .mockReturnValueOnce(newerSignedOut.promise);

    const mountedRenderer = await renderReviewClient();
    await act(async () => {
      findRefreshButton(mountedRenderer).props.onClick();
      await waitForClientUpdates();
    });
    await act(async () => {
      newerSignedOut.resolve(blockedOverview(401, "not_authenticated"));
      await waitForClientUpdates();
    });
    await act(async () => {
      olderSuccess.resolve(okOverview(overviewWithTracks));
      await waitForClientUpdates();
    });

    const renderedText = visibleTextOf(mountedRenderer.toJSON());
    const renderedJson = textOf(mountedRenderer);
    expect(renderedText).not.toContain("Readable Track");
    expect(renderedText).not.toContain("Creator-safe local file");
    expect(renderedText).not.toContain("Skipped during stream");
    expect(renderedJson).not.toContain(trackRecord.id);
    expect(renderedJson).not.toContain(sourceRecord.id);
    expect(findLabelSelect(mountedRenderer, "Track").props.value).toBe("");
    expect(findLabelSelect(mountedRenderer, "Source").props.value).toBe("");
    expect(mountedRenderer.root.findAllByType("button").some((button) => buttonText(button) === "Keep")).toBe(false);

    await act(async () => {
      mountedRenderer.unmount();
    });
  });

  it("keeps a newer successful refresh when an older auth failure resolves afterward", async () => {
    const olderForbidden = createDeferred<AdminMusicOverviewResponse>();
    const newerSuccess = createDeferred<AdminMusicOverviewResponse>();
    vi.mocked(fetchAdminMusicOverview)
      .mockReturnValueOnce(olderForbidden.promise)
      .mockReturnValueOnce(newerSuccess.promise);

    const mountedRenderer = await renderReviewClient();
    await act(async () => {
      findRefreshButton(mountedRenderer).props.onClick();
      await waitForClientUpdates();
    });
    await act(async () => {
      newerSuccess.resolve(okOverview(overviewWithTracks));
      await waitForClientUpdates();
    });
    await act(async () => {
      olderForbidden.resolve(blockedOverview(403, "admin_forbidden"));
      await waitForClientUpdates();
    });

    const renderedText = visibleTextOf(mountedRenderer.toJSON());
    expect(renderedText).toContain("Readable Track");
    expect(renderedText).toContain("Creator-safe local file / Readable Track / Safe Artist");
    expect(renderedText).toContain("Skipped during stream");
    expect(findLabelSelect(mountedRenderer, "Track").props.disabled).toBe(false);
    expect(mountedRenderer.root.findAllByType("button").some((button) => buttonText(button) === "Keep")).toBe(true);

    await act(async () => {
      mountedRenderer.unmount();
    });
  });
});
