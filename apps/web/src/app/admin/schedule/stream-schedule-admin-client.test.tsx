import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StreamScheduleEntry, StreamScheduleGameLink } from "@maiks-yt/domain/schedule";

import StreamScheduleAdminClient from "./stream-schedule-admin-client";

vi.mock("../../dev-auth-token", () => ({
  captureDevAuthTokenFromUrl: vi.fn(),
  createApiHeaders: vi.fn((headers: HeadersInit = {}) => headers)
}));

const createJsonResponse = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
  headers: { "Content-Type": "application/json" },
  status
});

const createGameLink = (
  gameId: string,
  overrides: Partial<StreamScheduleGameLink> = {}
): StreamScheduleGameLink => ({
  id: `link-${gameId}`,
  gameId,
  slug: gameId,
  title: `Game ${gameId}`,
  platformLabel: null,
  ownershipStatus: "owned",
  interestStatus: "interested",
  relationship: "planned",
  publicNote: null,
  sortOrder: 0,
  ...overrides
});

const twoLinkStream: StreamScheduleEntry = {
  id: "stream-1",
  title: "Friday stream",
  description: null,
  startsAt: "2026-09-28T18:00:00.000Z",
  endsAt: "2026-09-28T21:00:00.000Z",
  channelKey: "coding",
  topicKey: "maiks-yt",
  themeKey: "default",
  projectId: null,
  focusLabel: null,
  focusNote: null,
  focusProject: null,
  gameLinks: [
    createGameLink("game-primary", {
      publicNote: "Original primary",
      sortOrder: 0
    }),
    createGameLink("game-secondary", {
      relationship: "current",
      publicNote: "Keep secondary",
      sortOrder: 1
    })
  ],
  channelTargets: [{
    channelRef: "11111111-1111-4111-8111-111111111111",
    provider: "twitch",
    providerChannelId: "1531201792",
    displayName: "MaiksPlays",
    handle: "maiksplays"
  }],
  visibility: "public",
  status: "planned",
  cancellationReasonCode: null,
  cancellationReason: null,
  createdAt: "2026-08-28T12:00:00.000Z",
  updatedAt: "2026-08-28T12:00:00.000Z"
};

const renderScheduleEditor = async (
  fetchMock: ReturnType<typeof vi.fn>
): Promise<ReactTestRenderer> => {
  vi.stubGlobal("fetch", fetchMock);

  let renderer: ReactTestRenderer | null = null;
  await act(async () => {
    renderer = create(<StreamScheduleAdminClient />);
    await Promise.resolve();
  });

  if (!renderer) {
    throw new Error("Schedule editor did not render.");
  }

  return renderer;
};

const createScheduleFetchMock = () => vi.fn((
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  const url = String(input);

  if (url.endsWith("/admin/schedule") && (!init?.method || init.method === "GET")) {
    return Promise.resolve(createJsonResponse({
      ok: true,
      streams: [twoLinkStream],
      projectOptions: [],
      gameOptions: [
        {
          id: "game-primary",
          slug: "game-primary",
          title: "Game primary",
          platformLabel: null,
          ownershipStatus: "owned",
          interestStatus: "interested",
          visibility: "public"
        },
        {
          id: "game-secondary",
          slug: "game-secondary",
          title: "Game secondary",
          platformLabel: null,
          ownershipStatus: "owned",
          interestStatus: "interested",
          visibility: "public"
        }
      ],
      channelOptions: [{
        channelRef: "11111111-1111-4111-8111-111111111111",
        provider: "twitch",
        providerChannelId: "1531201792",
        displayName: "MaiksPlays",
        handle: "maiksplays"
      }]
    }));
  }

  if (url.endsWith(`/admin/schedule/${twoLinkStream.id}`) && init?.method === "PATCH") {
    return Promise.resolve(createJsonResponse({
      ok: true,
      stream: twoLinkStream
    }));
  }

  if (url.endsWith(`/admin/schedule/${twoLinkStream.id}/games`) && init?.method === "PUT") {
    return Promise.resolve(createJsonResponse({
      ok: true,
      stream: twoLinkStream
    }));
  }

  return Promise.reject(new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`));
});

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("stream schedule admin client game focus saving", () => {
  it("opens a new stream form instead of editing a hidden historical stream", async () => {
    const historicalStream: StreamScheduleEntry = {
      ...twoLinkStream,
      id: "historical-stream",
      startsAt: "2026-08-20T18:00:00.000Z",
      endsAt: "2026-08-20T21:00:00.000Z"
    };
    const fetchMock = vi.fn(() => Promise.resolve(createJsonResponse({
      ok: true,
      streams: [historicalStream],
      projectOptions: [],
      gameOptions: []
    })));
    const renderer = await renderScheduleEditor(fetchMock);

    expect(renderer.root.findAllByType("h2").some((heading) =>
      heading.children.join("") === "Create stream"
    )).toBe(true);
    expect(renderer.root.findAllByType("h2").some((heading) =>
      heading.children.join("") === "Edit stream"
    )).toBe(false);

    await act(async () => {
      renderer.unmount();
    });
  });

  it("submits untouched additional game links when editing the visible primary note", async () => {
    const fetchMock = createScheduleFetchMock();
    const renderer = await renderScheduleEditor(fetchMock);

    const noteInput = renderer.root.findAllByType("input")
      .find((input) => input.props.placeholder === "Optional public context");
    expect(noteInput).toBeDefined();

    await act(async () => {
      noteInput?.props.onChange({ target: { value: "Updated primary" } });
    });

    await act(async () => {
      await renderer.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() });
    });

    const gameRequest = fetchMock.mock.calls.find((call) =>
      String(call[0]).endsWith(`/admin/schedule/${twoLinkStream.id}/games`)
    );
    expect(gameRequest).toBeDefined();
    expect(JSON.parse(String(gameRequest?.[1]?.body))).toEqual({
      links: [
        {
          gameId: "game-primary",
          relationship: "planned",
          publicNote: "Updated primary",
          sortOrder: 0
        },
        {
          gameId: "game-secondary",
          relationship: "current",
          publicNote: "Keep secondary",
          sortOrder: 1
        }
      ]
    });

    await act(async () => {
      renderer.unmount();
    });
  });

  it("does not replace game links during ordinary schedule-only edits", async () => {
    const fetchMock = createScheduleFetchMock();
    const renderer = await renderScheduleEditor(fetchMock);
    const titleInput = renderer.root.findAllByType("input")
      .find((input) => input.props.value === twoLinkStream.title);
    expect(titleInput).toBeDefined();

    await act(async () => {
      titleInput?.props.onChange({ target: { value: "Retitled stream" } });
    });

    await act(async () => {
      await renderer.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() });
    });

    expect(fetchMock.mock.calls.some((call) =>
      String(call[0]).endsWith(`/admin/schedule/${twoLinkStream.id}/games`)
    )).toBe(false);

    await act(async () => {
      renderer.unmount();
    });
  });

  it("keeps form values and shows a clear midnight/date error without sending a rejected save", async () => {
    const fetchMock = createScheduleFetchMock();
    const renderer = await renderScheduleEditor(fetchMock);
    const endDate = renderer.root.findAllByType("input").find((input) => input.props.id === "schedule-endsAt");
    const endTime = renderer.root.findAllByType("input").find((input) => input.props["aria-label"] === "End time (24-hour)");
    const titleInput = renderer.root.findAllByType("input").find((input) => input.props.id === "schedule-title");

    await act(async () => {
      endDate?.props.onChange({ target: { value: "2026-09-28" } });
      endTime?.props.onChange({ target: { value: "00:00" } });
    });
    await act(async () => {
      await renderer.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() });
    });

    expect(renderer.root.findByProps({ role: "alert" }).findAllByType("li").map((node) => node.children.join("")).join(" "))
      .toContain("00:00 is the beginning of the selected date");
    expect(titleInput?.props.value).toBe(twoLinkStream.title);
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === "PATCH")).toBe(false);

    await act(async () => { renderer.unmount(); });
  });

  it("renders connected Twitch and YouTube destinations as multi-select checkboxes", async () => {
    const fetchMock = createScheduleFetchMock();
    const renderer = await renderScheduleEditor(fetchMock);
    const channelCheckboxes = renderer.root.findAllByType("input").filter((input) => input.props.type === "checkbox");

    expect(channelCheckboxes).toHaveLength(1);
    expect(channelCheckboxes[0]?.props.checked).toBe(true);
    expect(renderer.root.findAllByType("strong").some((node) => node.children.join("") === "MaiksPlays")).toBe(true);

    await act(async () => { renderer.unmount(); });
  });

  it("keeps the edited form and renders server validation details after a rejected save", async () => {
    const baseFetchMock = createScheduleFetchMock();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => init?.method === "PATCH"
      ? Promise.resolve(createJsonResponse({
        ok: false,
        reason: "stream_schedule_invalid_input",
        issues: ["The connected channel is no longer available."]
      }, 400))
      : baseFetchMock(input, init));
    const renderer = await renderScheduleEditor(fetchMock);
    const titleInput = renderer.root.findAllByType("input").find((input) => input.props.id === "schedule-title");

    await act(async () => {
      titleInput?.props.onChange({ target: { value: "Retained after failure" } });
    });
    await act(async () => {
      await renderer.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() });
    });

    expect(renderer.root.findByProps({ role: "alert" }).findAllByType("li")[0]?.children.join(""))
      .toContain("connected channel is no longer available");
    expect(renderer.root.findAllByType("input").find((input) => input.props.id === "schedule-title")?.props.value)
      .toBe("Retained after failure");

    await act(async () => { renderer.unmount(); });
  });
});
