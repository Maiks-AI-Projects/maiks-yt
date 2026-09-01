import { afterEach, describe, expect, it, vi } from "vitest";

import {
  dryRunIncompetechImport,
  createMusicRequest,
  fetchPublicMusicCatalog
} from "./music-api.service";

const stubWindow = (storedDevToken: string | null = null): void => {
  vi.stubGlobal("window", {
    localStorage: {
      getItem: () => storedDevToken,
      removeItem: () => undefined,
      setItem: () => undefined
    }
  });
};

const successfulCatalogPayload = {
  ok: true,
  tracks: [{
    selectionReference: `musicref_v1_${"a".repeat(64)}`,
    title: "Night Build",
    artist: "Aster Vale",
    durationSeconds: 180,
    providerName: "Safe Provider",
    sourceLabel: "Creator catalog",
    liveSafe: true,
    vodSafe: true,
    previewUrl: null,
    previewMimeType: null,
    attributionText: null
  }]
};

describe("public music API service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fails closed when a successful catalog response is malformed", async () => {
    stubWindow();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      json: async () => ({
        ok: true,
        tracks: [{
          trackId: "internal-track",
          sourceId: "internal-source"
        }]
      }),
      status: 200
    })));

    await expect(fetchPublicMusicCatalog()).resolves.toEqual({
      payload: {
        ok: false,
        reason: "music_unavailable"
      },
      status: 200
    });
  });

  it("fails closed when a public request response is not JSON", async () => {
    stubWindow();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      json: async () => {
        throw new Error("not JSON");
      },
      status: 200
    })));

    await expect(createMusicRequest({
      selectionReference: `musicref_v1_${"a".repeat(64)}`
    })).resolves.toEqual({
      payload: {
        ok: false,
        reason: "music_request_unavailable"
      },
      status: 200
    });
  });

  it("rejects a catalog success body returned with a non-2xx status", async () => {
    stubWindow();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      json: async () => successfulCatalogPayload,
      status: 503
    })));

    await expect(fetchPublicMusicCatalog()).resolves.toEqual({
      payload: {
        ok: false,
        reason: "music_unavailable"
      },
      status: 503
    });
  });

  it("rejects a request success body returned with a non-2xx status", async () => {
    stubWindow();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      json: async () => ({ ok: true, accepted: true }),
      status: 429
    })));

    await expect(createMusicRequest({
      selectionReference: `musicref_v1_${"a".repeat(64)}`
    })).resolves.toEqual({
      payload: {
        ok: false,
        reason: "music_request_unavailable"
      },
      status: 429
    });
  });

  it("preserves a finite request failure body on its legitimate non-2xx status", async () => {
    stubWindow();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      json: async () => ({ ok: false, reason: "music_request_daily_limit" }),
      status: 429
    })));

    await expect(createMusicRequest({
      selectionReference: `musicref_v1_${"a".repeat(64)}`
    })).resolves.toEqual({
      payload: {
        ok: false,
        reason: "music_request_daily_limit"
      },
      status: 429
    });
  });

  it("posts Incompetech imports with the signed-in browser session and no bearer token", async () => {
    stubWindow("dev-token-that-must-not-be-used");
    const fetchMock = vi.fn(async () => ({
      json: async () => ({
        ok: false,
        reason: "not_authenticated"
      }),
      status: 401
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(dryRunIncompetechImport({
      manifestVersion: "incompetech-ccby4.v1",
      source: "incompetech",
      generatedAt: "2026-09-01T00:00:00.000Z",
      providerEvidence: [],
      tracks: []
    })).resolves.toEqual({
      payload: {
        ok: false,
        reason: "not_authenticated"
      },
      status: 401
    });

    const firstCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit] | undefined;
    expect(firstCall).toBeDefined();
    const [url, init] = firstCall ?? ["", {}];
    expect(url).toContain("/admin/music/imports/incompetech/dry-run");
    expect(init).toMatchObject({
      credentials: "include",
      method: "POST"
    });
    expect(Object.fromEntries(new Headers((init as RequestInit).headers))).not.toHaveProperty("authorization");
  });
});
