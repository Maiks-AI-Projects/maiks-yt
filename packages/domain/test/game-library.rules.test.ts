import { describe, expect, it } from "vitest";

import {
  buildPublicGameLibraryEntry,
  canManageGameLibrary,
  createGameSlugFromTitle,
  gameLibraryManageCapability,
  isValidGameSuggestionReviewInput,
  isValidGameLibraryAdminInput,
  isValidPublicGameSuggestionInput,
  normalizeGameSuggestionReviewInput,
  normalizeGameSlug,
  normalizePublicGameSuggestionInput,
  type GameLibrarySource
} from "../src/games/index.js";

const createGame = (overrides: Partial<GameLibrarySource> = {}): GameLibrarySource => ({
  id: "game-1",
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
  visibility: "public",
  sortOrder: 0,
  createdByUserId: "owner",
  updatedByUserId: "owner",
  createdAt: "2026-07-09T20:00:00.000Z",
  updatedAt: "2026-07-09T20:30:00.000Z",
  ...overrides
});

describe("game library permissions", () => {
  it("allows owner wildcard and typed game library permission", () => {
    expect(canManageGameLibrary(["*"])).toBe(true);
    expect(canManageGameLibrary([gameLibraryManageCapability])).toBe(true);
    expect(canManageGameLibrary(["page-creator:manage"])).toBe(false);
  });
});

describe("game suggestion validation", () => {
  it("normalizes and accepts public suggestion input", () => {
    expect(normalizePublicGameSuggestionInput({
      title: "  Factorio  ",
      platformLabel: " PC ",
      reason: "  Automation classic  ",
      tags: [" Automation ", "automation", "Factory"],
      suggestedByName: " Viewer "
    })).toEqual({
      title: "Factorio",
      platformLabel: "PC",
      storeUrl: null,
      reason: "Automation classic",
      tags: ["automation", "factory"],
      suggestedByName: "Viewer"
    });
    expect(isValidPublicGameSuggestionInput({
      title: "Factorio",
      platformLabel: "PC",
      storeUrl: "https://example.com/factorio",
      reason: "Automation classic",
      tags: ["automation"],
      suggestedByName: "Viewer"
    })).toBe(true);
  });

  it("bounds public suggestions and owner reviews", () => {
    expect(isValidPublicGameSuggestionInput({
      title: "",
      tags: []
    })).toBe(false);
    expect(isValidPublicGameSuggestionInput({
      title: "Bad",
      storeUrl: "javascript:alert(1)"
    })).toBe(false);
    expect(normalizeGameSuggestionReviewInput({
      status: "accepted",
      reviewerNote: "  Added to the list  ",
      linkedGameId: " game-1 "
    })).toEqual({
      status: "accepted",
      reviewerNote: "Added to the list",
      linkedGameId: "game-1"
    });
    expect(isValidGameSuggestionReviewInput({
      status: "accepted",
      reviewerNote: "Added to the list",
      linkedGameId: "game-1"
    })).toBe(true);
    expect(isValidGameSuggestionReviewInput({
      status: "pending" as never
    })).toBe(false);
  });
});

describe("game library validation", () => {
  it("normalizes slugs and can derive one from title", () => {
    expect(normalizeGameSlug("  Minecraft-Java  ")).toEqual({
      ok: true,
      slug: "minecraft-java"
    });
    expect(createGameSlugFromTitle("Satisfactory: Update 1.0")).toBe("satisfactory-update-1-0");
  });

  it("accepts a manual owner-curated game record", () => {
    expect(isValidGameLibraryAdminInput({
      title: "Satisfactory",
      platformLabel: "Steam",
      storeProvider: "steam",
      storeUrl: "https://store.steampowered.com/app/526870/Satisfactory/",
      ownershipStatus: "owned",
      interestStatus: "currently-playing",
      streamFitNote: "Automation streams work well.",
      contentWarnings: null,
      categoryLabel: "Automation",
      visibility: "public",
      sortOrder: 10
    })).toBe(true);
  });

  it("rejects invalid titles, slugs, URLs, statuses, and sort orders", () => {
    expect(isValidGameLibraryAdminInput({
      title: "",
      ownershipStatus: "owned",
      interestStatus: "interested",
      visibility: "private"
    })).toBe(false);
    expect(isValidGameLibraryAdminInput({
      title: "Bad Slug",
      slug: "bad slug",
      ownershipStatus: "owned",
      interestStatus: "interested",
      visibility: "private"
    })).toBe(false);
    expect(isValidGameLibraryAdminInput({
      title: "Bad URL",
      storeUrl: "javascript:alert(1)",
      ownershipStatus: "owned",
      interestStatus: "interested",
      visibility: "private"
    })).toBe(false);
    expect(isValidGameLibraryAdminInput({
      title: "Bad Status",
      ownershipStatus: "purchased" as never,
      interestStatus: "interested",
      visibility: "private"
    })).toBe(false);
    expect(isValidGameLibraryAdminInput({
      title: "Bad Sort",
      ownershipStatus: "owned",
      interestStatus: "interested",
      visibility: "private",
      sortOrder: 100_000
    })).toBe(false);
  });
});

describe("public game library projection", () => {
  it("projects only public curated fields", () => {
    expect(buildPublicGameLibraryEntry(createGame())).toEqual({
      id: "game-1",
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
      updatedAt: "2026-07-09T20:30:00.000Z"
    });
  });

  it("keeps private records out of public lists", () => {
    expect(buildPublicGameLibraryEntry(createGame({ visibility: "private" }))).toBeNull();
  });
});
