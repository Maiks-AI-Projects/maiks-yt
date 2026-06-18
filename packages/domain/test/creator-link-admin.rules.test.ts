import { describe, expect, it } from "vitest";

import {
  canManageCreatorLinks,
  creatorLinkAdminManageCapability,
  isValidCreatorLinkAdminInput,
  isValidCreatorLinkAdminReorderInput,
  type CreatorLinkAdminInput
} from "../src/links/index.js";

const createInput = (overrides: Partial<CreatorLinkAdminInput> = {}): CreatorLinkAdminInput => ({
  key: "twitch",
  title: "Twitch",
  description: "Main live stream channel.",
  purpose: "social",
  icon: "twitch",
  availability: "available",
  href: "https://www.twitch.tv/maiksmc",
  availabilityNote: null,
  isPrimary: false,
  sortOrder: 10,
  isPublished: true,
  ...overrides
});

describe("creator link admin permissions", () => {
  it("allows owner wildcard and typed creator link manage permission", () => {
    expect(canManageCreatorLinks(["*"])).toBe(true);
    expect(canManageCreatorLinks([creatorLinkAdminManageCapability])).toBe(true);
  });

  it("does not grant access from unrelated permissions", () => {
    expect(canManageCreatorLinks([])).toBe(false);
    expect(canManageCreatorLinks(["project-admin:manage", null])).toBe(false);
  });
});

describe("creator link admin validation", () => {
  it("accepts available and unavailable link records", () => {
    expect(isValidCreatorLinkAdminInput(createInput())).toBe(true);
    expect(isValidCreatorLinkAdminInput(createInput({
      availability: "unavailable",
      href: null,
      availabilityNote: "Destination not available yet.",
      isPublished: true
    }))).toBe(true);
  });

  it("rejects invalid destination, unavailable, support, and order states", () => {
    expect(isValidCreatorLinkAdminInput(createInput({ key: "Bad Key" }))).toBe(false);
    expect(isValidCreatorLinkAdminInput(createInput({ availability: "available", href: "" }))).toBe(false);
    expect(isValidCreatorLinkAdminInput(createInput({
      availability: "unavailable",
      href: null,
      availabilityNote: ""
    }))).toBe(false);
    expect(isValidCreatorLinkAdminInput(createInput({
      key: "support",
      purpose: "support",
      icon: "support",
      availability: "available",
      href: "https://example.com/support"
    }))).toBe(false);
    expect(isValidCreatorLinkAdminInput(createInput({ sortOrder: -1 }))).toBe(false);
  });

  it("validates reorder payloads with unique known-shaped keys", () => {
    expect(isValidCreatorLinkAdminReorderInput({ orderedKeys: ["home", "support"] })).toBe(true);
    expect(isValidCreatorLinkAdminReorderInput({ orderedKeys: [] })).toBe(false);
    expect(isValidCreatorLinkAdminReorderInput({ orderedKeys: ["home", "home"] })).toBe(false);
    expect(isValidCreatorLinkAdminReorderInput({ orderedKeys: ["Bad Key"] })).toBe(false);
  });
});
