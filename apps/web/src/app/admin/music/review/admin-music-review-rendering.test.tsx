import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sourceSelectionUnavailableMessage } from "./admin-music-review-selection.rules";
import {
  AdminMusicReviewClient,
  buttonText,
  cleanupReviewTestMocks,
  emptyMusicAdminOverview,
  findLabelSelect,
  mockCreateAdminMusicRecord,
  mockFetchAdminMusicOverview,
  okOverview,
  overviewWithoutSources,
  overviewWithTracks,
  renderReviewClient,
  resetReviewTestMocks,
  secondSourceRecord,
  sourceRecord,
  stubFormValues,
  textOf,
  trackRecord,
  visibleTextOf,
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

describe("admin music review rendering", () => {
  it("renders readable compact selections instead of raw relationship id fields", async () => {
    mockFetchAdminMusicOverview.mockResolvedValue(okOverview(overviewWithTracks));
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

  it("shows empty, loading, error, and invalid relationship states without raw ids", async () => {
    mockFetchAdminMusicOverview.mockResolvedValueOnce(okOverview(emptyMusicAdminOverview));
    const emptyRenderer = await renderReviewClient();
    expect(textOf(emptyRenderer)).toContain("No catalog tracks returned.");
    expect(textOf(emptyRenderer)).toContain("No matching sources returned.");
    expect(textOf(emptyRenderer)).not.toContain("Track id");
    await act(async () => {
      emptyRenderer.unmount();
    });

    mockFetchAdminMusicOverview.mockReturnValue(new Promise(() => undefined));
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

    mockFetchAdminMusicOverview.mockResolvedValue({
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
    mockFetchAdminMusicOverview
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

    mockCreateAdminMusicRecord.mockClear();
    expect(textOf(invalidRenderer)).toContain(sourceSelectionUnavailableMessage);
    expect(findLabelSelect(invalidRenderer, "Source").props.disabled).toBe(false);
    await act(async () => {
      await invalidRenderer.root.findByType("form").props.onSubmit({
        currentTarget: {},
        preventDefault: vi.fn()
      });
    });
    expect(mockCreateAdminMusicRecord).not.toHaveBeenCalled();
    expect(textOf(invalidRenderer)).toContain(sourceSelectionUnavailableMessage);

    await act(async () => {
      invalidRenderer.unmount();
    });
  });

  it("keeps visible saved rows readable for current and stale relationships", async () => {
    mockFetchAdminMusicOverview.mockResolvedValue(okOverview(overviewWithTracks));
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
});
