import type { ProfileVisibility } from "@maiks-yt/domain/identity";

export type AccountProfileSnapshot = {
  ok: true;
  domainUser: {
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
    | "provider_profile_invalid_input"
    | "provider_profile_not_found"
    | "provider_profile_name_invalid"
    | "provider_profile_image_unavailable"
    | "provider_profile_unavailable"
    | "profile_unavailable";
};

export type AccountProfileResult = AccountProfileSnapshot | AccountProfileError;
