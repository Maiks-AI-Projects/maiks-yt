import { describe, expect, it } from "vitest";
import {
  gameCategoryLabelMaxLength,
  gameContentWarningsMaxLength,
  gameStreamFitNoteMaxLength,
  gameTitleMaxLength,
  publicGameLibraryMaxEntries
} from "@maiks-yt/domain/games";

import { parsePublicGamesApiResponse } from "./game-library-public-parser.rules";

const createPublicGame = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  slug: "satisfactory",
  title: "Satisfactory",
  platformLabel: "Steam",
  storeProvider: "steam",
  storeUrl: "https://store.steampowered.com/app/526870/Satisfactory/",
  artworkUrl: "https://media.steampowered.com/steamcommunity/public/images/apps/526870/icon.jpg",
  popularityScore: 12345,
  ownershipStatus: "owned",
  interestStatus: "currently-playing",
  streamFitNote: "Good automation stream fit.",
  contentWarnings: null,
  categoryLabel: "Automation",
  updatedAt: "2026-07-09T20:30:00.000Z",
  ...overrides
});

describe("public games data parsing", () => {
  it("accepts the finite anonymous games contract without raw identifiers", () => {
    const parsed = parsePublicGamesApiResponse({
      ok: true,
      games: [createPublicGame()]
    });

    expect(parsed).toEqual({
      ok: true,
      games: [createPublicGame()]
    });
    expect(Object.keys(parsed?.ok ? parsed.games[0] ?? {} : {})).toEqual([
      "slug",
      "title",
      "platformLabel",
      "storeProvider",
      "storeUrl",
      "artworkUrl",
      "popularityScore",
      "ownershipStatus",
      "interestStatus",
      "streamFitNote",
      "contentWarnings",
      "categoryLabel",
      "updatedAt"
    ]);
    expect(JSON.stringify(parsed)).not.toContain("\"id\"");
  });

  it.each([
    ["game id", { id: "raw-game-id" }],
    ["internal visibility", { visibility: "public" }],
    ["internal order", { sortOrder: 0 }],
    ["creator id", { createdByUserId: "owner" }],
    ["updater id", { updatedByUserId: "owner" }],
    ["created timestamp", { createdAt: "2026-07-09T20:00:00.000Z" }]
  ])("rejects extra/internal fields in the public games contract: %s", (_label, overrides) => {
    expect(parsePublicGamesApiResponse({
      ok: true,
      games: [createPublicGame(overrides)]
    })).toBeNull();
  });

  it("rejects extra fields on the response envelope", () => {
    expect(parsePublicGamesApiResponse({
      ok: true,
      games: [createPublicGame()],
      debug: "internal"
    })).toBeNull();
  });

  it("rejects oversized successful games lists", () => {
    expect(parsePublicGamesApiResponse({
      ok: true,
      games: Array.from({ length: publicGameLibraryMaxEntries + 1 }, () => createPublicGame())
    })).toBeNull();
  });

  it("rejects duplicate public game identities", () => {
    expect(parsePublicGamesApiResponse({
      ok: true,
      games: [
        createPublicGame(),
        createPublicGame({ title: "Duplicate title" })
      ]
    })).toBeNull();
  });

  it("accepts the finite public games failure reason", () => {
    expect(parsePublicGamesApiResponse({
      ok: false,
      reason: "game_library_unavailable"
    })).toEqual({
      ok: false,
      reason: "game_library_unavailable"
    });
  });

  it.each([
    "not_authenticated",
    "game_library_admin_forbidden",
    "database_error"
  ])("rejects non-public games failure reasons: %s", (reason) => {
    expect(parsePublicGamesApiResponse({
      ok: false,
      reason
    })).toBeNull();
  });

  it("rejects extra fields in the failure contract", () => {
    expect(parsePublicGamesApiResponse({
      ok: false,
      reason: "game_library_unavailable",
      debug: "internal"
    })).toBeNull();
  });

  it.each([
    ["malformed slug", { slug: "Bad Slug" }],
    ["empty title", { title: "" }],
    ["overlong title", { title: "x".repeat(gameTitleMaxLength + 1) }],
    ["overlong stream fit note", { streamFitNote: "x".repeat(gameStreamFitNoteMaxLength + 1) }],
    ["overlong content warnings", { contentWarnings: "x".repeat(gameContentWarningsMaxLength + 1) }],
    ["overlong category", { categoryLabel: "x".repeat(gameCategoryLabelMaxLength + 1) }],
    ["javascript store url", { storeUrl: "javascript:alert(1)" }],
    ["javascript artwork url", { artworkUrl: "javascript:alert(1)" }],
    ["invalid popularity", { popularityScore: -1 }],
    ["non-finite popularity", { popularityScore: Number.POSITIVE_INFINITY }],
    ["invalid ownership status", { ownershipStatus: "purchased" }],
    ["invalid interest status", { interestStatus: "playing-now" }],
    ["non-canonical updated timestamp", { updatedAt: "2026-07-09T20:30:00Z" }],
    ["invalid updated timestamp", { updatedAt: "not-a-date" }]
  ])("rejects malformed bounded public games data: %s", (_label, overrides) => {
    expect(parsePublicGamesApiResponse({
      ok: true,
      games: [createPublicGame(overrides)]
    })).toBeNull();
  });

  it("requires nullable public fields to be present and null when absent", () => {
    expect(parsePublicGamesApiResponse({
      ok: true,
      games: [createPublicGame({
        platformLabel: undefined
      })]
    })).toBeNull();
    expect(parsePublicGamesApiResponse({
      ok: true,
      games: [createPublicGame({
        platformLabel: null,
        storeProvider: null,
        storeUrl: null,
        artworkUrl: null,
        popularityScore: null,
        streamFitNote: null,
        contentWarnings: null,
        categoryLabel: null
      })]
    })).toMatchObject({ ok: true });
  });
});
