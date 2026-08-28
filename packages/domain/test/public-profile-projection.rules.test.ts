import { describe, expect, it } from "vitest";

import {
  buildPublicProfileDetailProjection,
  buildPublicProfileSearchResultProjection,
  createOpaqueProfileImageIdentifierFromTrustedSource,
  privateProfileText,
  type PublicProfileProjectionSource
} from "../src/index.js";

const profileImageIdentifier = createOpaqueProfileImageIdentifierFromTrustedSource(
  "profimg_2N7mK9pQ4sR8tV1x"
);

if (profileImageIdentifier === null) {
  throw new Error("The generated profile image token fixture must be valid");
}

const publicProfile = (overrides: Partial<PublicProfileProjectionSource> = {}): PublicProfileProjectionSource => ({
  handle: "maiks",
  accountName: "Maiks",
  profileVisibility: "public",
  image: profileImageIdentifier,
  ...overrides
});

describe("public profile projection rules", () => {
  it("projects public profile detail without raw account identifiers", () => {
    const projection = buildPublicProfileDetailProjection(publicProfile());

    expect(projection).toEqual({
      kind: "public",
      handle: "maiks",
      profilePath: "/profiles/maiks",
      accountName: "Maiks",
      profileVisibility: "public",
      image: {
        identifier: "profimg_2N7mK9pQ4sR8tV1x"
      }
    });
    expect(Object.keys(projection ?? {})).not.toContain("id");
    expect(Object.keys(projection ?? {})).not.toContain("userId");
    expect(Object.keys(projection ?? {})).not.toContain("accountId");
    expect(Object.keys(projection ?? {})).not.toContain("avatarUrl");
  });

  it("projects private profile detail as account name plus exact private text only", () => {
    expect(buildPublicProfileDetailProjection(publicProfile({
      profileVisibility: "private",
      image: profileImageIdentifier
    }))).toEqual({
      accountName: "Maiks",
      privateText: privateProfileText
    });
    expect(privateProfileText).toBe("This account is set to private");
  });

  it("keeps private accounts searchable without exposing image or profile detail", () => {
    const projection = buildPublicProfileSearchResultProjection(publicProfile({
      profileVisibility: "private"
    }));

    expect(projection).toEqual({
      accountName: "Maiks",
      privateText: "This account is set to private"
    });
    expect(Object.keys(projection ?? {})).toEqual(["accountName", "privateText"]);
  });

  it("omits deleted and malformed profile sources", () => {
    expect(buildPublicProfileDetailProjection(publicProfile({ isDeleted: true }))).toBeNull();
    expect(buildPublicProfileSearchResultProjection(publicProfile({ handle: "maiks/mc" }))).toBeNull();
  });

  it("omits image output when no trusted opaque image token is supplied", () => {
    expect(buildPublicProfileDetailProjection(publicProfile({
      image: null
    }))).toMatchObject({
      kind: "public",
      image: null
    });
  });
});
