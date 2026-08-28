import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMusicRequest,
  fetchPublicMusicCatalog
} from "./music-api.service";

const stubWindow = (): void => {
  vi.stubGlobal("window", {
    localStorage: {
      getItem: () => null,
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
});
