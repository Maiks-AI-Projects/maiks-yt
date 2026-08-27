import { open, mkdtemp, rm, type FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const defaultMaximumBytes = 75 * 1024 * 1024;

export type ResolvedVlcMediaSource = {
  input: string;
  release: () => Promise<void>;
};

export interface VlcMediaSourceResolver {
  resolve(sourceUrl: string, signal: AbortSignal): Promise<ResolvedVlcMediaSource>;
}

type FetchLike = typeof fetch;

export class AuthenticatedVlcMediaSourceResolver implements VlcMediaSourceResolver {
  readonly #authorizationOrigin: string;
  readonly #bearerCredential: string;
  readonly #fetch: FetchLike;
  readonly #maximumBytes: number;

  constructor(input: {
    authorizationOrigin: string;
    bearerCredential: string;
    fetch?: FetchLike;
    maximumBytes?: number;
  }) {
    this.#authorizationOrigin = new URL(input.authorizationOrigin).origin;
    this.#bearerCredential = input.bearerCredential;
    this.#fetch = input.fetch ?? fetch;
    this.#maximumBytes = input.maximumBytes ?? defaultMaximumBytes;
  }

  async resolve(sourceUrl: string, signal: AbortSignal): Promise<ResolvedVlcMediaSource> {
    const url = new URL(sourceUrl);
    const headers = url.origin === this.#authorizationOrigin
      ? { Authorization: `Bearer ${this.#bearerCredential}` }
      : undefined;
    const response = await this.#fetch(url, {
      ...(headers ? { headers } : {}),
      redirect: headers ? "error" : "follow",
      signal
    });
    if (!response.ok || !response.body) {
      throw new Error(`Music media request failed with status ${response.status}`);
    }

    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
    if (!contentType.startsWith("audio/") && contentType !== "application/octet-stream") {
      throw new Error("Music media response did not contain supported audio");
    }
    const contentLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
    if (Number.isFinite(contentLength) && contentLength > this.#maximumBytes) {
      throw new Error("Music media response exceeded the download limit");
    }

    const directory = await mkdtemp(path.join(tmpdir(), "maiks-yt-vlc-"));
    const filePath = path.join(directory, "media");
    let file: FileHandle | null = null;
    try {
      file = await open(filePath, "wx", 0o600);
      const reader = response.body.getReader();
      let size = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) {
          break;
        }
        size += chunk.value.byteLength;
        if (size > this.#maximumBytes) {
          await reader.cancel();
          throw new Error("Music media response exceeded the download limit");
        }
        await file.write(chunk.value);
      }
      if (size === 0) {
        throw new Error("Music media response was empty");
      }
      await file.close();
      file = null;
      return {
        input: filePath,
        release: async () => rm(directory, { force: true, recursive: true })
      };
    } catch (error) {
      await file?.close().catch(() => undefined);
      await rm(directory, { force: true, recursive: true }).catch(() => undefined);
      throw error;
    }
  }
}

export function localAgentApiOrigin(outboundUrl: URL): string {
  const origin = new URL(outboundUrl.origin);
  origin.protocol = outboundUrl.protocol === "wss:" ? "https:" : "http:";
  return origin.origin;
}
