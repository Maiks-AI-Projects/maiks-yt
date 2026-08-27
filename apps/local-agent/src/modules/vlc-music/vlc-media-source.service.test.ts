import { access, readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import {
  AuthenticatedVlcMediaSourceResolver,
  localAgentApiOrigin
} from "./vlc-media-source.service.js";

describe("AuthenticatedVlcMediaSourceResolver", () => {
  it("uses the device bearer only for the configured Maiks.yt origin", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(new Uint8Array([1, 2, 3]), {
      headers: { "Content-Type": "audio/mpeg" },
      status: 200
    }));
    const resolver = new AuthenticatedVlcMediaSourceResolver({
      authorizationOrigin: "https://api.maiks.yt",
      bearerCredential: "secret-device-token",
      fetch: fetchMock
    });

    const privateMedia = await resolver.resolve(
      "https://api.maiks.yt/music/playback/audio/playback-1",
      new AbortController().signal
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.any(URL),
      expect.objectContaining({ headers: { Authorization: "Bearer secret-device-token" }, redirect: "error" })
    );
    expect([...await readFile(privateMedia.input)]).toEqual([1, 2, 3]);
    await privateMedia.release();
    await expect(access(privateMedia.input)).rejects.toThrow();

    const publicMedia = await resolver.resolve(
      "https://cdn.example.test/track.mp3",
      new AbortController().signal
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.any(URL),
      expect.not.objectContaining({ headers: expect.anything() })
    );
    expect(fetchMock.mock.calls.at(-1)?.[1]).toMatchObject({ redirect: "follow" });
    await publicMedia.release();
  });

  it("rejects unsupported and oversized responses", async () => {
    const unsupported = new AuthenticatedVlcMediaSourceResolver({
      authorizationOrigin: "https://api.maiks.yt",
      bearerCredential: "secret-device-token",
      fetch: async () => new Response("not audio", {
        headers: { "Content-Type": "text/plain" },
        status: 200
      })
    });
    await expect(unsupported.resolve(
      "https://api.maiks.yt/music/playback/audio/playback-1",
      new AbortController().signal
    )).rejects.toThrow("supported audio");

    const oversized = new AuthenticatedVlcMediaSourceResolver({
      authorizationOrigin: "https://api.maiks.yt",
      bearerCredential: "secret-device-token",
      fetch: async () => new Response(new Uint8Array([1, 2, 3, 4]), {
        headers: { "Content-Type": "audio/mpeg" },
        status: 200
      }),
      maximumBytes: 3
    });
    await expect(oversized.resolve(
      "https://api.maiks.yt/music/playback/audio/playback-1",
      new AbortController().signal
    )).rejects.toThrow("download limit");
  });

  it("derives the HTTPS API origin from the outbound WebSocket URL", () => {
    expect(localAgentApiOrigin(new URL("wss://api.maiks.yt/local-agent/live")))
      .toBe("https://api.maiks.yt");
    expect(localAgentApiOrigin(new URL("ws://127.0.0.1:3001/local-agent/live")))
      .toBe("http://127.0.0.1:3001");
  });
});
