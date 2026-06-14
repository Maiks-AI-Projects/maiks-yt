import { describe, expect, it } from "vitest";

import { sortActionItemsForContext, type ActionItem } from "../src/actions/index.js";

const baseAction = {
  category: "overlay",
  createdAt: "2026-06-14T08:00:00.000Z",
  decisionKind: "review",
  description: "Review action",
  liveSafe: true,
  priority: "normal",
  status: "open",
  streamRelevant: false,
  title: "Review action"
} satisfies Omit<ActionItem, "id">;

describe("sortActionItemsForContext", () => {
  it("hides off-stream admin actions while live", () => {
    const items: ActionItem[] = [
      {
        ...baseAction,
        id: "withdrawal",
        category: "donation",
        liveSafe: false,
        priority: "urgent",
        streamRelevant: false
      },
      {
        ...baseAction,
        id: "overlay-alert",
        category: "overlay",
        priority: "high",
        streamRelevant: true
      }
    ];

    expect(sortActionItemsForContext(items, {
      live: true,
      now: "2026-06-14T10:00:00.000Z"
    }).map((item) => item.id)).toEqual(["overlay-alert"]);
  });

  it("sorts urgent and overdue items before normal review work", () => {
    const items: ActionItem[] = [
      {
        ...baseAction,
        id: "normal-review",
        createdAt: "2026-06-14T08:00:00.000Z"
      },
      {
        ...baseAction,
        id: "overdue-review",
        createdAt: "2026-06-14T09:00:00.000Z",
        dueAt: "2026-06-14T09:30:00.000Z"
      },
      {
        ...baseAction,
        id: "urgent-review",
        priority: "urgent"
      }
    ];

    expect(sortActionItemsForContext(items, {
      live: false,
      now: "2026-06-14T10:00:00.000Z"
    }).map((item) => item.id)).toEqual(["urgent-review", "overdue-review", "normal-review"]);
  });
});
