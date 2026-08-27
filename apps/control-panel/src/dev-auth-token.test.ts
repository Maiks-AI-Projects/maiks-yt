import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "./dev-auth-token.js";

const stubStoredDevAuthToken = (token: string | null): void => {
  vi.stubGlobal("window", {
    localStorage: {
      getItem: vi.fn(() => token)
    } as unknown as Storage
  });
};

type ApiFetchImplementation = (input: string | URL, init?: RequestInit) => Promise<Response>;

const createFetchMock = (): ReturnType<typeof vi.fn<ApiFetchImplementation>> =>
  vi.fn(async (_input: string | URL, _init?: RequestInit) => new Response("{}"));

describe("apiFetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("includes cookies and preserves request init behavior", async () => {
    stubStoredDevAuthToken(null);
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("https://api.maiks.yt/overlay/status", {
      body: "{}",
      cache: "no-store",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    const [, init] = fetchMock.mock.calls[0]!;

    expect(init).toMatchObject({
      body: "{}",
      cache: "no-store",
      credentials: "include",
      method: "POST"
    });
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
  });

  it("adds the stored dev auth bearer to API headers", async () => {
    stubStoredDevAuthToken("dev-token");
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch(new URL("https://api-dev.maiks.yt/actions"), {
      headers: {
        Accept: "application/json"
      }
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const headers = new Headers(init?.headers);

    expect(init?.credentials).toBe("include");
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer dev-token");
  });
});
