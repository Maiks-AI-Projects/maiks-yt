import { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  sourceSelectionRequiredMessage,
  trackSelectionRequiredMessage
} from "./admin-music-review-selection.rules";
import {
  buttonText,
  cleanupReviewTestMocks,
  findLabelSelect,
  mockCreateAdminMusicRecord,
  mockFetchAdminMusicOverview,
  mockResolveMusicReviewQueueItem,
  okOverview,
  overviewWithoutSources,
  overviewWithTracks,
  renderReviewClient,
  resetReviewTestMocks,
  secondTrackRecord,
  sourceRecord,
  stubFormValues,
  textOf,
  trackRecord,
  waitForClientUpdates
} from "./admin-music-review-test-support";

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

beforeEach(resetReviewTestMocks);
afterEach(cleanupReviewTestMocks);

describe("admin music review submissions", () => {
  it("submits review decisions through the existing queue action path", async () => {
    mockFetchAdminMusicOverview.mockResolvedValue(okOverview(overviewWithTracks));
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

    expect(mockResolveMusicReviewQueueItem).toHaveBeenCalledWith("review-1", "keep", null);

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
    mockFetchAdminMusicOverview.mockResolvedValue(okOverview(overviewWithTracks));
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

    expect(mockCreateAdminMusicRecord).toHaveBeenCalledWith("/admin/music/blacklist", {
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
    mockFetchAdminMusicOverview.mockResolvedValue(okOverview(overviewWithTracks));

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
    expect(mockCreateAdminMusicRecord).not.toHaveBeenCalled();
    expect(textOf(trackRenderer)).toContain(trackSelectionRequiredMessage);
    await act(async () => {
      trackRenderer.unmount();
    });

    mockCreateAdminMusicRecord.mockClear();
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
    expect(mockCreateAdminMusicRecord).not.toHaveBeenCalled();
    expect(textOf(sourceRenderer)).toContain(sourceSelectionRequiredMessage);
    await act(async () => {
      sourceRenderer.unmount();
    });
  });

  it("clears source when track is cleared or changed away from the selected source", async () => {
    mockFetchAdminMusicOverview.mockResolvedValue(okOverview(overviewWithTracks));
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
    mockFetchAdminMusicOverview
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

    expect(mockCreateAdminMusicRecord).toHaveBeenCalledWith("/admin/music/blacklist", {
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
});
