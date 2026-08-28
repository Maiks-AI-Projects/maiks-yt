import { describe, expect, it } from "vitest";

import { buildCatalogueRows } from "./connections-workspace-client";
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

  it("uses the production event catalogue without simulation-only website triggers", () => {
    const rows = buildCatalogueRows("production");
    const eventNames = rows.map((row) => row.eventName);

    expect(eventNames).toContain("website.signup");
    expect(eventNames).toContain("website.schedule-changed");
    expect(eventNames).toContain("channel.follow");
    expect(eventNames).toContain("textMessageEvent");
    expect(eventNames).toContain("MESSAGE_CREATE");
    expect(eventNames).not.toContain("website.free-tts-request");
    expect(eventNames).not.toContain("simulated.support-money");
    expect(rows.map((row) => row.source)).not.toContain("test/system");
    expect(rows.flatMap((row) => row.safety)).not.toContain("simulated");
  });

  it("keeps the existing non-production simulation catalogue available", () => {
    const rows = buildCatalogueRows("non-production");
    const eventNames = rows.map((row) => row.eventName);

    expect(eventNames).toContain("website.free-tts-request");
    expect(eventNames).toContain("simulated.support-money");
    expect(rows.flatMap((row) => row.safety)).toContain("simulated");
  });
});
