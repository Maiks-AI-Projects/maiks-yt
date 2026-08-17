import type { ProfileVisibility } from "@maiks-yt/domain/identity";

export type AccountProfileSnapshot = {
  ok: true;
  domainUser: {
    id: string;
    displayName: string;
    profileVisibility: ProfileVisibility;
    avatarUrl: string | null;
  };
};

export type AccountProfileError = {
  ok: false;
  reason:
    | "not_authenticated"
    | "profile_invalid_input"
    | "profile_image_invalid_input"
    | "profile_image_not_found"
    | "profile_unavailable";
};

export type AccountProfileResult = AccountProfileSnapshot | AccountProfileError;
