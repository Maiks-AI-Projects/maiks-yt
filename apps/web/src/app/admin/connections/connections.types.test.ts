import { describe, expect, it } from "vitest";

import { connectionsSources } from "./connections.types";

describe("production Connections sources", () => {
  it("contains real intake sources without the retired simulation source", () => {
    expect(connectionsSources).toEqual([
      "any",
      "twitch",
      "youtube",
      "discord",
      "website"
    ]);
    expect(connectionsSources).not.toContain("test/system");
  });
});
