import type {
  GameSuggestionAdminEntry,
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

const getReviewedSortValue = (suggestion: GameSuggestionAdminEntry): number => {
  const timestamp = suggestion.reviewedAt ? Date.parse(suggestion.reviewedAt) : 0;

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const createReviewedSuggestionView = (
  suggestions: readonly GameSuggestionAdminEntry[],
  options: ReviewedSuggestionViewOptions
): {
  reviewed: readonly GameSuggestionAdminEntry[];
  filtered: readonly GameSuggestionAdminEntry[];
  displayed: readonly GameSuggestionAdminEntry[];
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
