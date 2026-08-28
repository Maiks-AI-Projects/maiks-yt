import { buildProfileRoutePath } from "./profile-public-identifier.rules.js";
import type { OpaqueProfileImageIdentifier } from "./profile-public-identifier.rules.js";
import type {
  PublicProfileDetailProjection,
  PublicProfileImage,
  PublicProfileProjectionSource,
  PublicProfileSearchResultProjection
} from "./public-profile-projection.types.js";

export const privateProfileText = "This account is set to private" as const;

const buildPublicProfileImage = (
  image: OpaqueProfileImageIdentifier | null | undefined
): PublicProfileImage | null => {
  if (!image) {
    return null;
  }

  return {
    identifier: image.value
  };
};

export const buildPublicProfileDetailProjection = (
  source: PublicProfileProjectionSource
): PublicProfileDetailProjection | null => {
  if (source.isDeleted) {
    return null;
  }

  const profilePath = buildProfileRoutePath(source.handle);

  if (profilePath === null) {
    return null;
  }

  if (source.profileVisibility === "private") {
    return {
      accountName: source.accountName,
      privateText: privateProfileText
    };
  }

  return {
    kind: "public",
    handle: source.handle,
    profilePath,
    accountName: source.accountName,
    profileVisibility: source.profileVisibility,
    image: buildPublicProfileImage(source.image)
  };
};

export const buildPublicProfileSearchResultProjection = (
  source: PublicProfileProjectionSource
): PublicProfileSearchResultProjection | null => {
  if (source.isDeleted) {
    return null;
  }

  const profilePath = buildProfileRoutePath(source.handle);

  if (profilePath === null) {
    return null;
  }

  if (source.profileVisibility === "private") {
    return {
      accountName: source.accountName,
      privateText: privateProfileText
    };
  }

  return {
    kind: "public",
    handle: source.handle,
    profilePath,
    accountName: source.accountName,
    profileVisibility: source.profileVisibility,
    image: buildPublicProfileImage(source.image)
  };
};
