import type { ProfileVisibility } from "./user.types.js";
import type { OpaqueProfileImageIdentifier } from "./profile-public-identifier.rules.js";

export type PublicProfileImage = {
  identifier: string;
};

export type PublicProfileProjectionSource = {
  handle: string;
  accountName: string;
  profileVisibility: ProfileVisibility;
  image?: OpaqueProfileImageIdentifier | null;
  isDeleted?: boolean;
};

export type PublicProfileDetailProjection =
  | {
    accountName: string;
    privateText: "This account is set to private";
  }
  | {
    kind: "public";
    handle: string;
    profilePath: string;
    accountName: string;
    profileVisibility: "minimal" | "public";
    image: PublicProfileImage | null;
  };

export type PublicProfileSearchResultProjection =
  | {
    accountName: string;
    privateText: "This account is set to private";
  }
  | {
    kind: "public";
    handle: string;
    profilePath: string;
    accountName: string;
    profileVisibility: "minimal" | "public";
    image: PublicProfileImage | null;
  };
