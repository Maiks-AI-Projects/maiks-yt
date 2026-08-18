import { describe, expect, it } from "vitest";

import { getSteamAppUrl } from "./steam-store-url-data";

describe("getSteamAppUrl", () => {
  it("derives a Steam app deep link from a canonical HTTPS store URL", () => {
    expect(getSteamAppUrl("https://store.steampowered.com/app/526870/Satisfactory/?utm_source=maiks"))
      .toBe("steam://store/526870");
  });

  it.each([
    null,
    "",
    "not a URL",
    "http://store.steampowered.com/app/526870/Satisfactory/",
    "https://steamcommunity.com/app/526870/",
    "https://store.steampowered.com.evil.example/app/526870/",
    "https://store.steampowered.com/app/not-a-number/",
    "https://store.steampowered.com/app/0/",
    "https://user@store.steampowered.com/app/526870/",
    "https://store.steampowered.com:444/app/526870/"
  ])("rejects a non-canonical Steam app URL: %s", (storeUrl) => {
    expect(getSteamAppUrl(storeUrl)).toBeNull();
  });
});
