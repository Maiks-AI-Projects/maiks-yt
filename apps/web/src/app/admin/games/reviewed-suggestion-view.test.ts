import { describe, expect, it } from "vitest";

import type { GameSuggestionSource } from "@maiks-yt/domain/games";

import { createReviewedSuggestionView } from "./reviewed-suggestion-view.rules";

const createSuggestion = (
  index: number,
  overrides: Partial<GameSuggestionSource> = {}
): GameSuggestionSource => ({
  id: `suggestion-${index}`,
  title: `Game ${index}`,
  platformLabel: "Steam",
  storeUrl: null,
  reason: null,
  tags: [],
  suggestedByUserId: null,
  suggestedByName: null,
  status: "accepted",
  linkedGameId: null,
  reviewerNote: null,
  reviewerUserId: null,
  reviewedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  isPublic: false,
  createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  updatedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  ...overrides
});

describe("reviewed suggestion view", () => {
  it("collapses the filtered result instead of the unfiltered first eight", () => {
    const suggestions = Array.from({ length: 12 }, (_, index) => createSuggestion(index));
    suggestions[1] = createSuggestion(1, {
      title: "Target game",
      status: "duplicate"
    });

    const view = createReviewedSuggestionView(suggestions, {
      searchQuery: "target",
      statusFilter: "duplicate",
      showAll: false
    });

    expect(view.reviewed).toHaveLength(12);
    expect(view.filtered.map((suggestion) => suggestion.id)).toEqual(["suggestion-1"]);
    expect(view.displayed.map((suggestion) => suggestion.id)).toEqual(["suggestion-1"]);
  });

  it("limits unfiltered collapsed history to the newest eight", () => {
    const view = createReviewedSuggestionView(
      Array.from({ length: 12 }, (_, index) => createSuggestion(index)),
      {
        searchQuery: "",
        statusFilter: "all",
        showAll: false
      }
    );

    expect(view.displayed).toHaveLength(8);
    expect(view.displayed[0]?.id).toBe("suggestion-11");
  });
});
