export const gameOwnershipStatuses = ["owned", "not-owned", "borrowed", "subscription-access", "gifted", "unknown"] as const;
export type GameOwnershipStatus = typeof gameOwnershipStatuses[number];

export const gameInterestStatuses = ["interested", "maybe-later", "currently-playing", "completed", "paused", "not-a-fit"] as const;
export type GameInterestStatus = typeof gameInterestStatuses[number];

export const gameVisibilities = ["private", "public"] as const;
export type GameVisibility = typeof gameVisibilities[number];

export const gameLibraryManageCapability = "game-library:manage" as const;

export type GameLibraryCapability =
  | "*"
  | typeof gameLibraryManageCapability;

export type GameLibrarySource = {
  id: string;
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

export type GameSlugValidationResult =
  | {
    ok: true;
    slug: string;
  }
  | {
    ok: false;
    reason: "empty_slug" | "slug_too_long" | "malformed_slug";
  };
