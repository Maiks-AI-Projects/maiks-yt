import { describe, expect, it } from "vitest";

import { getHostRoutingDecision, normalizeHostHeader } from "./host-routing.rules";

describe("host routing", () => {
  it.each([
    "plays.maiks.yt",
    "Plays.Maiks.Yt",
    "plays.maiks.yt.",
    "plays.maiks.yt:443",
    "plays.maiks.yt:3000"
  ])("rewrites only the MaiksPlays host root for standard Host value %s", (hostHeader) => {
    expect(getHostRoutingDecision({ hostHeader, pathname: "/" })).toEqual({
      action: "rewrite",
      pathname: "/plays"
    });
  });

  it.each([
    ["maiks.yt", "/"],
    ["www.maiks.yt", "/"],
    ["api.maiks.yt", "/"],
    ["plays.maiks.yt", "/plays"],
    ["plays.maiks.yt", "/schedule"],
    ["plays.maiks.yt", "/anything/deeper"]
  ])("leaves existing host/path behavior unchanged for %s%s", (hostHeader, pathname) => {
    expect(getHostRoutingDecision({ hostHeader, pathname })).toEqual({ action: "next" });
  });

  it.each([
    null,
    "",
    " ",
    "plays.maiks.yt, maiks.yt",
    "maiks.yt, plays.maiks.yt",
    "plays.maiks.yt:abc",
    "plays.maiks.yt:0",
    "plays.maiks.yt:65536",
    "plays.maiks.yt:443:443",
    "plays.maiks.yt/@maiks",
    "user@plays.maiks.yt",
    "[::1]",
    "localhost"
  ])("fails closed for non-standard or untrusted Host value %s", (hostHeader) => {
    expect(normalizeHostHeader(hostHeader)).toBeNull();
    expect(getHostRoutingDecision({ hostHeader, pathname: "/" })).toEqual({ action: "next" });
  });
});
