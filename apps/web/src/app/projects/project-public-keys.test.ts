import type {
  PublicProjectItem,
  PublicProjectItemLink,
  PublicProjectMilestone,
  PublicProjectUpdate
} from "@maiks-yt/domain/projects";
import { describe, expect, it } from "vitest";

import {
  getPublicProjectItemKey,
  getPublicProjectItemLinkKey,
  getPublicProjectMilestoneKey,
  getPublicProjectSummaryKey,
  getPublicProjectUpdateKey
} from "./project-public-keys.rules";

describe("project public render keys", () => {
  it("uses slug as the public project summary key", () => {
    expect(getPublicProjectSummaryKey({ slug: "maiks-yt-v2" })).toBe("project | maiks-yt-v2");
  });

  it("uses public fields plus ordered position for duplicate milestone and update keys", () => {
    const milestone = {
      title: "Same public title",
      status: "active"
    } satisfies PublicProjectMilestone;
    const update = {
      title: "Same public title",
      body: "Same public body.",
      isPinned: false,
      publishedAt: "2026-08-28T12:00:00.000Z"
    } satisfies PublicProjectUpdate;

    expect(getPublicProjectMilestoneKey("maiks-yt-v2", milestone, 0)).toBe(
      getPublicProjectMilestoneKey("maiks-yt-v2", milestone, 0)
    );
    expect(getPublicProjectMilestoneKey("maiks-yt-v2", milestone, 0)).not.toBe(
      getPublicProjectMilestoneKey("maiks-yt-v2", milestone, 1)
    );
    expect(getPublicProjectUpdateKey("maiks-yt-v2", update, 0)).not.toBe(
      getPublicProjectUpdateKey("maiks-yt-v2", update, 1)
    );
  });

  it("uses public item/link fields plus the rendered tree path", () => {
    const item = {
      title: "Same public item",
      kind: "task",
      status: "active",
      quantity: 1,
      links: [],
      children: []
    } satisfies PublicProjectItem;
    const link = {
      provider: "manual",
      url: "https://example.com/reference",
      label: "Reference",
      relationship: "reference"
    } satisfies PublicProjectItemLink;
    const firstItemKey = getPublicProjectItemKey(item, [0]);
    const secondItemKey = getPublicProjectItemKey(item, [1]);

    expect(firstItemKey).toBe(getPublicProjectItemKey(item, [0]));
    expect(firstItemKey).not.toBe(secondItemKey);
    expect(getPublicProjectItemLinkKey(link, firstItemKey, 0)).not.toContain("id");
    expect(getPublicProjectItemLinkKey(link, firstItemKey, 0)).not.toBe(
      getPublicProjectItemLinkKey(link, firstItemKey, 1)
    );
  });
});
