import type { PublicCreatorLink } from "@maiks-yt/domain";
import { describe, expect, it } from "vitest";

import type { CreatorLinksLoadResult } from "../links/creator-links-data";
import { getMaiksPlaysLinkSlot } from "./maiksplays-link-data";

const createLink = (
  key: string,
  overrides: Partial<PublicCreatorLink> = {}
): PublicCreatorLink => ({
  key,
  title: `Link ${key}`,
  description: `Description for ${key}`,
  purpose: "social",
  icon: "social",
  availability: "available",
  href: `https://example.com/${key}`,
  isPrimary: false,
  sortOrder: 10,
  ...overrides
} as PublicCreatorLink);

const loaded = (links: readonly PublicCreatorLink[]): CreatorLinksLoadResult => ({
  status: "loaded",
  links
});

describe("MaiksPlays creator-link projection", () => {
  it("renders only current available MaiksPlays links returned by the live creator-link result", () => {
    expect(getMaiksPlaysLinkSlot(loaded([
      createLink("maiksmc", {
        title: "MaiksMC on Twitch",
        href: "https://www.twitch.tv/maiksmc",
        icon: "twitch"
      }),
      createLink("maiksplays-twitch", {
        title: "MaiksPlays on Twitch",
        description: "Gaming streams beyond Minecraft.",
        href: "https://www.twitch.tv/maiksplays",
        icon: "twitch"
      }),
      createLink("maiksplays-youtube-unpublished", {
        title: "MaiksPlays on YouTube",
        description: "Uploads and live streams.",
        availability: "unavailable",
        availabilityNote: "Not published"
      })
    ]))).toEqual({
      status: "available",
      links: [
        {
          title: "MaiksPlays on Twitch",
          description: "Gaming streams beyond Minecraft.",
          href: "https://www.twitch.tv/maiksplays"
        }
      ]
    });
  });

  it("accepts the verified runtime destinations without importing fallback availability", () => {
    expect(getMaiksPlaysLinkSlot(loaded([
      createLink("runtime-youtube", {
        title: "MaiksPlays on YouTube",
        description: "Gaming videos and stream uploads.",
        href: "https://www.youtube.com/@MaiksPlays/",
        icon: "youtube"
      })
    ]))).toEqual({
      status: "available",
      links: [
        {
          title: "MaiksPlays on YouTube",
          description: "Gaming videos and stream uploads.",
          href: "https://www.youtube.com/@MaiksPlays/"
        }
      ]
    });
  });

  it("returns finite unavailable state for missing, error, and malformed MaiksPlays data", () => {
    expect(getMaiksPlaysLinkSlot(loaded([]))).toEqual({ status: "unavailable" });
    expect(getMaiksPlaysLinkSlot({ status: "error", links: [] })).toEqual({ status: "unavailable" });
    expect(getMaiksPlaysLinkSlot({
      status: "loaded",
      links: null
    } as unknown as CreatorLinksLoadResult)).toEqual({ status: "unavailable" });
    expect(getMaiksPlaysLinkSlot(loaded([
      {
        ...createLink("malformed-maiksplays", {
          href: "https://www.twitch.tv/maiksplays"
        }),
        title: " "
      } as unknown as PublicCreatorLink
    ]))).toEqual({ status: "unavailable" });
  });

  it("rejects verified destinations with extra URL material", () => {
    expect(getMaiksPlaysLinkSlot(loaded([
      createLink("maiksplays-with-query", {
        href: "https://www.twitch.tv/maiksplays?redirect=https://example.com"
      })
    ]))).toEqual({ status: "unavailable" });
    expect(getMaiksPlaysLinkSlot(loaded([
      createLink("maiksplays-with-hash", {
        href: "https://www.youtube.com/@MaiksPlays#about"
      })
    ]))).toEqual({ status: "unavailable" });
  });

  it("does not expose raw API fields through the projected link shape", () => {
    const slot = getMaiksPlaysLinkSlot(loaded([
      {
        ...createLink("maiksplays-with-extra-fields", {
          title: `  ${"T".repeat(96)}tail  `,
          description: `  ${"D".repeat(220)}tail  `,
          href: "https://www.twitch.tv/maiksplays"
        }),
        internalId: "raw-internal-id",
        auditState: "raw-audit-state"
      } as unknown as PublicCreatorLink
    ]));

    expect(slot.status).toBe("available");
    if (slot.status !== "available") {
      throw new Error("Expected MaiksPlays link slot to be available.");
    }

    const firstLink = slot.links[0];

    if (!firstLink) {
      throw new Error("Expected projected MaiksPlays link.");
    }

    expect(Object.keys(firstLink)).toEqual([
      "title",
      "description",
      "href"
    ]);
    expect(firstLink.title).toHaveLength(96);
    expect(firstLink.description).toHaveLength(220);
  });
});
