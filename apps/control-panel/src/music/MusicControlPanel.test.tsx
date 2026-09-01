import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localAgentAudioRouteDefinitions } from "@maiks-yt/events";
// @ts-expect-error Test-only import from the workspace package that already owns this renderer dependency.
import testRenderer from "../../../web/node_modules/react-test-renderer/index.js";

import { apiFetch } from "../dev-auth-token.js";
import {
  MusicControlPanel,
  createUnavailableMusicPlaybackState,
  createRouteControlPayload,
  mergeMusicPlaybackState,
  readRouteControlMessage,
  shouldClearMusicPlaybackState,
  type MusicPlaybackState
} from "./MusicControlPanel.js";

vi.mock("../dev-auth-token.js", () => ({
  apiFetch: vi.fn()
}));

type TestRendererNode = {
  readonly children?: readonly unknown[] | null;
  readonly props?: Readonly<Record<string, unknown>>;
};

type TestRendererInstance = {
  readonly root: {
    findAllByType(type: string): readonly TestRendererNode[];
  };
  toJSON(): unknown;
  unmount(): void;
};

type TestRendererModule = {
  act(callback: () => Promise<void> | void): Promise<void>;
  create(element: React.ReactElement): TestRendererInstance;
};

const { act, create } = testRenderer as TestRendererModule;
const apiFetchMock = vi.mocked(apiFetch);

let mountedPanel: TestRendererInstance | null = null;
let intervalCallback: (() => void) | null = null;

const flushPromises = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const deferredResponse = (): {
  readonly promise: Promise<Response>;
  readonly resolve: (response: Response) => void;
} => {
  let resolveResponse!: (response: Response) => void;
  const promise = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });

  return {
    promise,
    resolve: resolveResponse
  };
};

const jsonResponse = <TPayload,>(payload: TPayload, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });

const collectText = (node: unknown): string => {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(collectText).join("");
  }
  if (typeof node === "object") {
    return collectText((node as TestRendererNode).children ?? []);
  }

  return "";
};

const route = (
  revision: number,
  controlState: MusicPlaybackState["audioRoutes"][number]["controlState"],
  overrides: Partial<MusicPlaybackState["audioRoutes"][number]> = {}
): MusicPlaybackState["audioRoutes"][number] => ({
  id: "music",
  label: "Music",
  mediaRole: "Music",
  pipeWireSink: "stream_music",
  controlState,
  muted: false,
  revision,
  state: "available",
  volumePercent: 70,
  ...overrides
});

const state = (musicRoute: MusicPlaybackState["audioRoutes"][number]): MusicPlaybackState => ({
  ok: true,
  status: "idle",
  audioRouteId: "music",
  audioRoutes: [musicRoute],
  playbackId: null,
  currentTrack: null,
  reason: null,
  player: {
    authority: "local-agent",
    blockedReason: null,
    connected: true,
    kind: "local-agent",
    lastCommand: null,
    owned: false,
    state: "active"
  }
});

const liveRoutes = (): readonly MusicPlaybackState["audioRoutes"][number][] =>
  localAgentAudioRouteDefinitions.map((definition, index) => route(index + 1, "acknowledged", {
    ...definition,
    volumePercent: definition.id === "music" ? 65 : 70
  }));

const playbackState = (
  title = "Current Playing Track",
  overrides: Partial<MusicPlaybackState> = {}
): MusicPlaybackState => ({
  ok: true,
  status: "playing",
  audioRouteId: "music",
  audioRoutes: liveRoutes(),
  playbackId: "playback-live",
  currentTrack: {
    artist: "Catalog Artist",
    attributionText: "Catalog attribution",
    licenseName: "Creator-safe license",
    providerName: "YouTube Audio Library",
    title,
    trackId: "track-live"
  },
  reason: null,
  player: {
    authority: "local-agent",
    blockedReason: null,
    connected: true,
    kind: "local-agent",
    lastCommand: null,
    owned: true,
    state: "active"
  },
  ...overrides
});

const catalogResponse = {
  ok: true as const,
  tracks: [{
    artist: "Catalog Artist",
    providerName: "YouTube Audio Library",
    title: "Current Playing Track",
    trackId: "track-live"
  }]
};

const renderMountedPanel = async (): Promise<TestRendererInstance> => {
  await act(async () => {
    mountedPanel = create(<MusicControlPanel />);
    await flushPromises();
  });

  if (!mountedPanel) {
    throw new Error("Music control panel did not mount.");
  }

  return mountedPanel;
};

const findButton = (renderer: TestRendererInstance, label: string): TestRendererNode => {
  const button = renderer.root.findAllByType("button").find((candidate) =>
    collectText(candidate.children ?? []) === label
  );

  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }

  return button;
};

beforeEach(() => {
  apiFetchMock.mockReset();
  intervalCallback = null;
  mountedPanel = null;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("window", {
    clearInterval: vi.fn(),
    setInterval: vi.fn((callback: () => void) => {
      intervalCallback = callback;

      return 1;
    })
  });
});

afterEach(async () => {
  if (mountedPanel) {
    await act(async () => {
      mountedPanel?.unmount();
      await flushPromises();
    });
  }
  vi.unstubAllGlobals();
});

describe("MusicControlPanel route controls", () => {
  it("keeps pending truth over stale polling and accepts the matching acknowledgement", () => {
    const pending = state(route(4, "pending", { volumePercent: 42 }));
    const stale = state(route(3, "acknowledged", { volumePercent: 70 }));
    const acknowledged = state(route(4, "acknowledged", { volumePercent: 42 }));
    const failed = state(route(4, "error", { lastError: "PIPEWIRE_WRITE_FAILED", volumePercent: 70 }));

    expect(mergeMusicPlaybackState(pending, stale).audioRoutes[0]).toMatchObject({
      controlState: "pending",
      revision: 4,
      volumePercent: 42
    });
    expect(mergeMusicPlaybackState(pending, acknowledged).audioRoutes[0]).toMatchObject({
      controlState: "acknowledged",
      revision: 4,
      volumePercent: 42
    });
    expect(mergeMusicPlaybackState(pending, failed).audioRoutes[0]).toMatchObject({
      controlState: "error",
      lastError: "PIPEWIRE_WRITE_FAILED",
      revision: 4
    });
  });

  it("shows pending, acknowledged mute, unavailable, and error truth", () => {
    expect(readRouteControlMessage(route(4, "pending", { volumePercent: 42 }))).toBe("Pending revision 4");
    expect(readRouteControlMessage(route(5, "acknowledged", { muted: true, volumePercent: 42 })))
      .toBe("42% / Muted / revision 5");
    expect(readRouteControlMessage(route(0, "unavailable", {
      muted: null,
      state: "unavailable",
      volumePercent: null
    }))).toBe("Unavailable");
    expect(readRouteControlMessage(route(6, "error", { lastError: "PIPEWIRE_READ_FAILED" })))
      .toBe("Error: PIPEWIRE_READ_FAILED");
  });

  it("builds logical route actions without PipeWire sink or node ids", () => {
    const volume = createRouteControlPayload({ audioRouteId: "communication", volumePercent: 35 });
    const mute = createRouteControlPayload({ audioRouteId: "private", muted: true });

    expect(volume).toEqual({ action: "route.volume.set", audioRouteId: "communication", volumePercent: 35 });
    expect(mute).toEqual({ action: "route.mute.set", audioRouteId: "private", muted: true });
    expect(JSON.stringify([volume, mute])).not.toMatch(/stream_|nodeId|sinkId/u);
  });

  it("clears stale playback and route controls when authentication is lost", () => {
    const unavailable = createUnavailableMusicPlaybackState("not_authenticated");

    expect(unavailable).toMatchObject({
      status: "blocked",
      playbackId: null,
      currentTrack: null,
      reason: "not_authenticated",
      player: {
        authority: "none",
        connected: false,
        state: "unavailable"
      }
    });
    expect(unavailable.audioRoutes).toHaveLength(4);
    expect(unavailable.audioRoutes.every((audioRoute) =>
      audioRoute.state === "unavailable"
      && audioRoute.controlState === "unavailable"
      && audioRoute.volumePercent === null
      && audioRoute.muted === null
    )).toBe(true);
    expect(readRouteControlMessage(unavailable.audioRoutes[0]!)).toBe("Unavailable");
  });

  it("treats 401 and role loss as stale-private-state boundaries", () => {
    expect(shouldClearMusicPlaybackState(401, {
      ok: false,
      reason: "not_authenticated"
    })).toBe(true);
    expect(shouldClearMusicPlaybackState(403, {
      ok: false,
      reason: "music_play_control_forbidden"
    })).toBe(true);
    expect(shouldClearMusicPlaybackState(403, {
      ok: false,
      reason: "music_selected_track_not_playable"
    })).toBe(false);
    expect(shouldClearMusicPlaybackState(503, {
      ok: false,
      reason: "music_play_control_unavailable"
    })).toBe(false);
  });

  it("renders one gain and mute control for every logical route", () => {
    const markup = renderToStaticMarkup(<MusicControlPanel />);

    for (const label of ["Communication", "Music", "Private", "Game"]) {
      expect(markup).toContain(`aria-label="${label} volume"`);
      expect(markup).toContain(`aria-label="${label} gain"`);
    }
    expect(markup.match(/type="range"/gu)).toHaveLength(4);
    expect(markup.match(/aria-pressed="false"/gu)).toHaveLength(4);
  });

  it("keeps an older state response from restoring playback after catalog auth loss", async () => {
    const oldStateRequest = deferredResponse();
    const catalogRequest = deferredResponse();
    apiFetchMock
      .mockReturnValueOnce(oldStateRequest.promise)
      .mockReturnValueOnce(catalogRequest.promise);

    const renderer = await renderMountedPanel();

    await act(async () => {
      catalogRequest.resolve(jsonResponse({
        ok: false,
        reason: "not_authenticated"
      }, 401));
      await flushPromises();
    });

    await act(async () => {
      oldStateRequest.resolve(jsonResponse(playbackState("Late Playing Track")));
      await flushPromises();
    });

    const text = collectText(renderer.toJSON());
    expect(text).toContain("Your sign-in needs to be renewed.");
    expect(text).toContain("No track loaded");
    expect(text).not.toContain("Late Playing Track");
  });

  it("keeps an older control response from restoring playback after role loss", async () => {
    const initialStateRequest = deferredResponse();
    const catalogRequest = deferredResponse();
    const oldControlRequest = deferredResponse();
    const roleLossPollRequest = deferredResponse();
    apiFetchMock
      .mockReturnValueOnce(initialStateRequest.promise)
      .mockReturnValueOnce(catalogRequest.promise)
      .mockReturnValueOnce(oldControlRequest.promise)
      .mockReturnValueOnce(roleLossPollRequest.promise);

    const renderer = await renderMountedPanel();

    await act(async () => {
      initialStateRequest.resolve(jsonResponse(playbackState()));
      catalogRequest.resolve(jsonResponse(catalogResponse));
      await flushPromises();
    });

    const pauseButton = findButton(renderer, "Pause");
    await act(async () => {
      (pauseButton.props?.onClick as (() => void) | undefined)?.();
      await flushPromises();
    });

    await act(async () => {
      intervalCallback?.();
      await flushPromises();
    });

    await act(async () => {
      roleLossPollRequest.resolve(jsonResponse({
        ok: false,
        reason: "music_play_control_forbidden"
      }, 403));
      await flushPromises();
    });

    await act(async () => {
      oldControlRequest.resolve(jsonResponse(playbackState("Late Control Track")));
      await flushPromises();
    });

    const text = collectText(renderer.toJSON());
    expect(text).toContain("Your account cannot control music.");
    expect(text).toContain("No track loaded");
    expect(text).not.toContain("Late Control Track");
  });

  it("keeps last playback state through transient 503 polling failures", async () => {
    const initialStateRequest = deferredResponse();
    const catalogRequest = deferredResponse();
    const unavailablePollRequest = deferredResponse();
    apiFetchMock
      .mockReturnValueOnce(initialStateRequest.promise)
      .mockReturnValueOnce(catalogRequest.promise)
      .mockReturnValueOnce(unavailablePollRequest.promise);

    const renderer = await renderMountedPanel();

    await act(async () => {
      initialStateRequest.resolve(jsonResponse(playbackState()));
      catalogRequest.resolve(jsonResponse(catalogResponse));
      await flushPromises();
    });

    await act(async () => {
      intervalCallback?.();
      await flushPromises();
    });

    await act(async () => {
      unavailablePollRequest.resolve(jsonResponse({
        ok: false,
        reason: "music_play_control_unavailable"
      }, 503));
      await flushPromises();
    });

    const stopButton = findButton(renderer, "Stop");
    const text = collectText(renderer.toJSON());
    expect(text).toContain("Music control is temporarily unavailable.");
    expect(text).toContain("Current Playing Track");
    expect(stopButton.props?.disabled).toBe(false);
  });
});
