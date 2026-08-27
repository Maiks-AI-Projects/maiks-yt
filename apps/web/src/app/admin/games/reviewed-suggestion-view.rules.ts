import type {
  GameSuggestionSource,
  GameSuggestionStatus
} from "@maiks-yt/domain/games";

export type ReviewedSuggestionStatus = Exclude<GameSuggestionStatus, "pending">;
export type ReviewedStatusFilter = "all" | ReviewedSuggestionStatus;

type ReviewedSuggestionViewOptions = {
  searchQuery: string;
  statusFilter: ReviewedStatusFilter;
  showAll: boolean;
  collapsedLimit?: number;
};

const getReviewedSortValue = (suggestion: GameSuggestionSource): number => {
  const timestamp = Date.parse(suggestion.reviewedAt ?? suggestion.updatedAt);

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const createReviewedSuggestionView = (
  suggestions: readonly GameSuggestionSource[],
  options: ReviewedSuggestionViewOptions
): {
  reviewed: readonly GameSuggestionSource[];
  filtered: readonly GameSuggestionSource[];
  displayed: readonly GameSuggestionSource[];
} => {
  const reviewed = suggestions
    .filter((suggestion) => suggestion.status !== "pending")
    .slice()
    .sort((left, right) => getReviewedSortValue(right) - getReviewedSortValue(left));
  const normalizedSearch = options.searchQuery.trim().toLocaleLowerCase();
  const filtered = reviewed.filter((suggestion) => {
    const matchesStatus = options.statusFilter === "all"
      || suggestion.status === options.statusFilter;
    const matchesSearch = normalizedSearch.length === 0
      || [suggestion.title, suggestion.platformLabel, suggestion.suggestedByName, suggestion.reviewerNote]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLocaleLowerCase().includes(normalizedSearch));

    return matchesStatus && matchesSearch;
  });

  return {
    reviewed,
    filtered,
    displayed: options.showAll
      ? filtered
      : filtered.slice(0, options.collapsedLimit ?? 8)
  };
};
