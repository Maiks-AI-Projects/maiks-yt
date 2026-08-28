import { describe, expect, it } from "vitest";
import type { StreamScheduleEntry, StreamScheduleGameLink } from "@maiks-yt/domain/schedule";

import {
  buildGameFocusLinksForSubmit,
  toGameLinkForm
} from "./stream-schedule-admin.rules";

const createGameLink = (
  gameId: string,
  overrides: Partial<StreamScheduleGameLink> = {}
): StreamScheduleGameLink => ({
  id: `link-${gameId}`,
  gameId,
  slug: gameId,
  title: `Game ${gameId}`,
  platformLabel: null,
  ownershipStatus: "owned",
  interestStatus: "interested",
  relationship: "planned",
  publicNote: null,
  sortOrder: 0,
  ...overrides
});

const createStream = (
  gameLinks: readonly StreamScheduleGameLink[]
): StreamScheduleEntry => ({
  id: "stream-1",
  title: "Friday stream",
  description: null,
  startsAt: "2026-08-28T18:00:00.000Z",
  endsAt: "2026-08-28T21:00:00.000Z",
  channelKey: "coding",
  topicKey: "maiks-yt",
  themeKey: "default",
  projectId: null,
  focusLabel: null,
  focusNote: null,
  focusProject: null,
  gameLinks,
  visibility: "public",
  status: "planned",
  cancellationReasonCode: null,
  cancellationReason: null,
  createdAt: "2026-08-28T12:00:00.000Z",
  updatedAt: "2026-08-28T12:00:00.000Z"
});

describe("stream schedule admin game focus rules", () => {
  it("preserves additional existing game links when the visible primary note changes", () => {
    const secondaryLink = createGameLink("game-secondary", {
      relationship: "current",
      publicNote: "Keep this context",
      sortOrder: 4
    });
    const stream = createStream([
      createGameLink("game-primary", {
        relationship: "played",
        publicNote: "Old note",
        sortOrder: 2
      }),
      secondaryLink
    ]);

    expect(buildGameFocusLinksForSubmit(stream, {
      gameId: "game-primary",
      publicNote: "Updated note"
    })).toEqual([
      {
        gameId: "game-primary",
        relationship: "played",
        publicNote: "Updated note",
        sortOrder: 0
      },
      {
        gameId: secondaryLink.gameId,
        relationship: secondaryLink.relationship,
        publicNote: secondaryLink.publicNote,
        sortOrder: 1
      }
    ]);
  });

  it("clears only the visible primary game link and keeps later links intact", () => {
    const secondaryLink = createGameLink("game-secondary", {
      relationship: "current",
      publicNote: "Still linked",
      sortOrder: 5
    });
    const stream = createStream([
      createGameLink("game-primary"),
      secondaryLink
    ]);

    expect(buildGameFocusLinksForSubmit(stream, {
      gameId: "",
      publicNote: ""
    })).toEqual([{
      gameId: secondaryLink.gameId,
      relationship: secondaryLink.relationship,
      publicNote: secondaryLink.publicNote,
      sortOrder: 0
    }]);
  });

  it("promotes an existing additional link without duplicating it or resetting its relationship", () => {
    const stream = createStream([
      createGameLink("game-primary", { sortOrder: 0 }),
      createGameLink("game-secondary", {
        relationship: "current",
        publicNote: "Old secondary note",
        sortOrder: 1
      }),
      createGameLink("game-third", { sortOrder: 2 })
    ]);

    const links = buildGameFocusLinksForSubmit(stream, {
      gameId: "game-secondary",
      publicNote: "Now primary"
    });

    expect(links).toEqual([
      {
        gameId: "game-secondary",
        relationship: "current",
        publicNote: "Now primary",
        sortOrder: 0
      },
      {
        gameId: "game-third",
        relationship: "planned",
        publicNote: null,
        sortOrder: 1
      }
    ]);
    expect(new Set(links.map((link) => link.gameId)).size).toBe(links.length);
  });

  it("puts a newly selected primary before links with negative original sort orders", () => {
    const stream = createStream([
      createGameLink("game-old-primary", { sortOrder: -5 }),
      createGameLink("game-negative", { sortOrder: -4 }),
      createGameLink("game-later", { sortOrder: 8 })
    ]);

    expect(buildGameFocusLinksForSubmit(stream, {
      gameId: "game-new-primary",
      publicNote: "Selected"
    })).toEqual([
      {
        gameId: "game-new-primary",
        relationship: "planned",
        publicNote: "Selected",
        sortOrder: 0
      },
      {
        gameId: "game-negative",
        relationship: "planned",
        publicNote: null,
        sortOrder: 1
      },
      {
        gameId: "game-later",
        relationship: "planned",
        publicNote: null,
        sortOrder: 2
      }
    ]);
  });

  it("uses sequential sort orders so title sorting cannot displace the selected primary", () => {
    const stream = createStream([
      createGameLink("game-old-primary", { sortOrder: 0 }),
      createGameLink("game-alpha", { title: "Alpha", sortOrder: 0 }),
      createGameLink("game-beta", { title: "Beta", sortOrder: 0 })
    ]);

    const links = buildGameFocusLinksForSubmit(stream, {
      gameId: "game-zulu",
      publicNote: "Selected"
    });
    const titles = new Map([
      ["game-zulu", "Zulu"],
      ["game-alpha", "Alpha"],
      ["game-beta", "Beta"]
    ]);
    const apiRoundTripOrder = links
      .map((link, index) => ({ ...link, sortOrder: link.sortOrder ?? index }))
      .sort((left, right) =>
        left.sortOrder - right.sortOrder
        || (titles.get(left.gameId) ?? "").localeCompare(titles.get(right.gameId) ?? "")
      );

    expect(links.map((link) => link.sortOrder)).toEqual([0, 1, 2]);
    expect(apiRoundTripOrder.map((link) => link.gameId)).toEqual([
      "game-zulu",
      "game-alpha",
      "game-beta"
    ]);
  });

  it("keeps create payloads limited to the visible game focus", () => {
    expect(buildGameFocusLinksForSubmit(null, {
      gameId: " new-game ",
      publicNote: " First stream "
    })).toEqual([{
      gameId: "new-game",
      relationship: "planned",
      publicNote: "First stream",
      sortOrder: 0
    }]);
  });

  it("loads only the primary game into the visible form", () => {
    const stream = createStream([
      createGameLink("game-primary", { publicNote: "Visible" }),
      createGameLink("game-secondary", { publicNote: "Hidden" })
    ]);

    expect(toGameLinkForm(stream)).toEqual({
      gameId: "game-primary",
      publicNote: "Visible"
    });
  });
});
