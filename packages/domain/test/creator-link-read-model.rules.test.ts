import {
  buildPublicCreatorLinkList,
  validateCreatorLinkAvailability,
  type CreatorLinkSource
} from "../src/index.js";
import { describe, expect, it } from "vitest";

const createLink = (
  key: string,
  overrides: Partial<CreatorLinkSource> = {}
): CreatorLinkSource => ({
  key,
  title: `Link ${key}`,
  description: `Description for ${key}`,
  purpose: "social",
  icon: "social",
  availability: "available",
  href: `/${key}`,
  availabilityNote: null,
  isPrimary: false,
  sortOrder: 10,
  isPublished: true,
  ...overrides
});

describe("creator link public read models", () => {
  it("requires hrefs for available links and availability notes for unavailable links", () => {
    expect(validateCreatorLinkAvailability({
      availability: "available",
      href: ""
    })).toEqual(["available_link_requires_href"]);
    expect(validateCreatorLinkAvailability({
      availability: "unavailable",
      availabilityNote: " "
    })).toEqual(["unavailable_link_requires_availability_note"]);
  });

  it("keeps unpublished and invalid links out of the public list", () => {
    const links = buildPublicCreatorLinkList([
      createLink("draft", { isPublished: false }),
      createLink("broken", { href: "" }),
      createLink("support", {
        purpose: "support",
        icon: "support",
        availability: "unavailable",
        href: null,
        availabilityNote: "Support link not available",
        sortOrder: 1
      }),
      createLink("home", {
        title: "Home",
        sortOrder: 0,
        isPrimary: true
      })
    ]);

    expect(links.map((link) => link.key)).toEqual(["home", "support"]);
    expect(links[1]).toMatchObject({
      availability: "unavailable",
      availabilityNote: "Support link not available"
    });
  });
});
