export const gameOwnershipStatuses = ["owned", "not-owned", "borrowed", "subscription-access", "gifted", "unknown"] as const;
export type GameOwnershipStatus = typeof gameOwnershipStatuses[number];

export const gameInterestStatuses = ["interested", "maybe-later", "currently-playing", "completed", "paused", "not-a-fit"] as const;
export type GameInterestStatus = typeof gameInterestStatuses[number];

export const gameVisibilities = ["private", "public"] as const;
export type GameVisibility = typeof gameVisibilities[number];
export const gameSuggestionStatuses = ["pending", "accepted", "maybe-later", "rejected", "duplicate", "already-played"] as const;
export type GameSuggestionStatus = typeof gameSuggestionStatuses[number];

export const gameLibraryManageCapability = "game-library:manage" as const;

export type GameLibraryCapability =
  | "*"
  | typeof gameLibraryManageCapability;

export type GameLibrarySource = {
  id: string;
  catalogGameId: string | null;
  slug: string;
  title: string;
  platformLabel: string | null;
  storeProvider: string | null;
  storeUrl: string | null;
  ownershipStatus: GameOwnershipStatus;
  interestStatus: GameInterestStatus;
  streamFitNote: string | null;
  contentWarnings: string | null;
  categoryLabel: string | null;
  visibility: GameVisibility;
  sortOrder: number;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GameLibraryAdminInput = {
  catalogGameId?: string | null | undefined;
  title: string;
  slug?: string | null | undefined;
  platformLabel?: string | null | undefined;
  storeProvider?: string | null | undefined;
  storeUrl?: string | null | undefined;
  ownershipStatus: GameOwnershipStatus;
  interestStatus: GameInterestStatus;
  streamFitNote?: string | null | undefined;
  contentWarnings?: string | null | undefined;
  categoryLabel?: string | null | undefined;
  visibility: GameVisibility;
  sortOrder?: number | undefined;
};

export type GameLibraryAdminUpdateInput = Partial<GameLibraryAdminInput>;

export type PublicGameLibraryEntry = {
  id: string;
  slug: string;
  title: string;
  platformLabel: string | null;
  ownershipStatus: GameOwnershipStatus;
  interestStatus: GameInterestStatus;
  streamFitNote: string | null;
  contentWarnings: string | null;
  categoryLabel: string | null;
  updatedAt: string;
};

export type GameSuggestionSource = {
  id: string;
  title: string;
  platformLabel: string | null;
  storeUrl: string | null;
  reason: string | null;
  tags: readonly string[];
  suggestedByUserId: string | null;
  suggestedByName: string | null;
  status: GameSuggestionStatus;
  linkedGameId: string | null;
  reviewerUserId: string | null;
  reviewerNote: string | null;
  reviewedAt: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PublicGameSuggestionInput = {
  title: string;
  platformLabel?: string | null | undefined;
  storeUrl?: string | null | undefined;
  reason?: string | null | undefined;
  tags?: readonly string[] | undefined;
  suggestedByName?: string | null | undefined;
};

export type GameSuggestionReviewInput = {
  status: Exclude<GameSuggestionStatus, "pending">;
  reviewerNote?: string | null | undefined;
  linkedGameId?: string | null | undefined;
};

export type GameSlugValidationResult =
  | {
    ok: true;
    slug: string;
  }
  | {
    ok: false;
    reason: "empty_slug" | "slug_too_long" | "malformed_slug";
  };
