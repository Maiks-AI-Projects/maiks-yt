import { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  relationshipSelectionUnavailableMessage,
  sourceSelectionUnavailableMessage
} from "./admin-music-review-selection.rules";
import {
  type AdminMusicOverviewResponse,
  blockedOverview,
  buttonText,
  cleanupReviewTestMocks,
  createDeferred,
  findLabelSelect,
  findRefreshButton,
  mockCreateAdminMusicRecord,
  mockFetchAdminMusicOverview,
  okOverview,
  overviewWithTracks,
  renderReviewClient,
  resetReviewTestMocks,
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

describe("admin music review refresh state", () => {
  it("preserves the last loaded overview on refresh error and blocks relationship saves until relationships are available", async () => {
    mockFetchAdminMusicOverview
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
    await act(async () => {
      findRefreshButton(renderer).props.onClick();
      await waitForClientUpdates();
    });

    expect(textOf(renderer)).toContain("Catalog relationships unavailable.");
    expect(textOf(renderer)).toContain("Readable Track / Safe Artist");
    expect(textOf(renderer)).not.toContain(sourceSelectionUnavailableMessage);

    mockCreateAdminMusicRecord.mockClear();
    await act(async () => {
      await renderer.root.findByType("form").props.onSubmit({
        currentTarget: {},
        preventDefault: vi.fn()
      });
    });
    expect(mockCreateAdminMusicRecord).not.toHaveBeenCalled();
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
    expect(mockCreateAdminMusicRecord).toHaveBeenCalledWith("/admin/music/blacklist", {
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
    mockFetchAdminMusicOverview
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

    await act(async () => {
      findRefreshButton(renderer).props.onClick();
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
    mockFetchAdminMusicOverview
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
    mockFetchAdminMusicOverview
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
