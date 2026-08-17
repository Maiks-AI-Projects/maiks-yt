import { describe, expect, it } from "vitest";

import { getManagedAvatarUrl } from "../../src/account/domain-identity.service.js";

describe("managed domain profile images", () => {
  it("accepts the Maiks.yt profile image endpoint for the matching user", () => {
    const userId = "84f4e397-0484-4f8d-a866-4db8d15a8c4b";
    const url = `http://localhost:3001/profiles/images/${userId}?v=123`;

    expect(getManagedAvatarUrl(userId, url)).toBe(url);
  });

  it("does not expose legacy provider images as the Maiks.yt profile image", () => {
    expect(getManagedAvatarUrl(
      "84f4e397-0484-4f8d-a866-4db8d15a8c4b",
      "https://lh3.googleusercontent.com/example"
    )).toBeNull();
  });
});
