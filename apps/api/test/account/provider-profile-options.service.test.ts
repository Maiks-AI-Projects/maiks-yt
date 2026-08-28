import { describe, expect, it } from "vitest";

import {
  downloadProviderProfileImage,
  fetchProviderProfileOption
} from "../../src/account/provider-profile-options.service.js";

const account = {
  id: "auth-account-1",
  accountId: "github-subject-1",
  providerId: "github",
  accessToken: "private-token"
};

describe("provider profile options", () => {
  it("projects a GitHub login and avatar without exposing its token", async () => {
    const option = await fetchProviderProfileOption(account, {
      fetchImplementation: (async (_input, init) => {
        expect(new Headers(init?.headers).get("authorization")).toBe("Bearer private-token");
        return new Response(JSON.stringify({
          login: "maiks-account",
          email: "maiks@example.test",
          avatar_url: "https://avatars.githubusercontent.com/u/123"
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }) as typeof fetch
    });

    expect(option).toEqual({
      providerId: "github",
      displayName: "maiks-account",
      email: "maiks@example.test",
      imageUrl: "https://avatars.githubusercontent.com/u/123"
    });
    expect(JSON.stringify(option)).not.toContain("private-token");
  });

  it("fails closed when a provider request fails", async () => {
    const option = await fetchProviderProfileOption(account, {
      fetchImplementation: (async () => new Response("no", { status: 401 })) as typeof fetch
    });

    expect(option).toBeNull();
  });

  it("downloads images only from the known provider image hosts", async () => {
    let called = false;
    const fetchImplementation = (async () => {
      called = true;
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/png" }
      });
    }) as typeof fetch;

    await expect(downloadProviderProfileImage(
      "https://example.test/untrusted.png",
      1024,
      fetchImplementation
    )).resolves.toBeNull();
    expect(called).toBe(false);

    await expect(downloadProviderProfileImage(
      "https://cdn.discordapp.com/avatars/1/image.png",
      1024,
      fetchImplementation
    )).resolves.toEqual(Buffer.from([1, 2, 3]));
  });
});
