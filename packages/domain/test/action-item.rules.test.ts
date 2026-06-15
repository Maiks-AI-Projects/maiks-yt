import { describe, expect, it } from "vitest";

import {
  actionItemDecisionNoteMaxLength,
  actionPanelDecideCapability,
  actionPanelViewCapability,
  canDecideActionItem,
  canViewActionPanel,
  getAllowedActionItemDecisions,
  getActionItemDecisionTransition,
  getActionPanelCategoryDecisionCapability,
  isActionItemDecisionAllowed,
  isActionPanelCapability,
  isValidActionItemDecisionInput,
  isValidActionItemDecisionNote,
  sortActionItemsForContext,
  type ActionItem
} from "../src/actions/index.js";

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

describe("Action Panel permissions", () => {
  it("allows the owner wildcard to view and decide every category", () => {
    expect(canViewActionPanel(["*"])).toBe(true);
    expect(canDecideActionItem({
      category: "overlay",
      decisionKind: "approve-or-reject",
      status: "open"
    }, ["*"])).toBe(true);
    expect(canDecideActionItem({
      category: "schedule",
      decisionKind: "review",
      status: "deferred"
    }, ["*"])).toBe(true);
  });

  it("allows broad decision permission across categories", () => {
    const capabilities = [actionPanelViewCapability, actionPanelDecideCapability];

    expect(canViewActionPanel(capabilities)).toBe(true);
    expect(canDecideActionItem({
      category: "overlay",
      decisionKind: "approve",
      status: "open"
    }, capabilities)).toBe(true);
    expect(canDecideActionItem({
      category: "schedule",
      decisionKind: "defer",
      status: "open"
    }, capabilities)).toBe(true);
  });

  it("limits category decision permission to its category", () => {
    const capabilities = [
      actionPanelViewCapability,
      getActionPanelCategoryDecisionCapability("overlay")
    ];

    expect(canDecideActionItem({
      category: "overlay",
      decisionKind: "review",
      status: "open"
    }, capabilities)).toBe(true);
    expect(canDecideActionItem({
      category: "schedule",
      decisionKind: "review",
      status: "open"
    }, capabilities)).toBe(false);
  });

  it("denies viewing and decisions without the required capabilities", () => {
    expect(canViewActionPanel([])).toBe(false);
    expect(canDecideActionItem({
      category: "overlay",
      decisionKind: "review",
      status: "open"
    }, [actionPanelViewCapability])).toBe(false);
    expect(canViewActionPanel([actionPanelDecideCapability])).toBe(false);
  });

  it("rejects malformed capabilities instead of granting access", () => {
    const malformedCapabilities: unknown[] = [
      "action-panel:decide:",
      "action-panel:decide:unknown",
      "action-panel:view:overlay",
      null,
      1
    ];

    expect(malformedCapabilities.every((capability) => !isActionPanelCapability(capability))).toBe(true);
    expect(canViewActionPanel(malformedCapabilities)).toBe(false);
    expect(canDecideActionItem({
      category: "overlay",
      decisionKind: "review",
      status: "open"
    }, malformedCapabilities)).toBe(false);
  });
});

describe("Action Panel decisions", () => {
  it("defines allowed decisions per decision kind", () => {
    expect(getAllowedActionItemDecisions("approve")).toEqual(["approve", "defer"]);
    expect(getAllowedActionItemDecisions("approve-or-reject")).toEqual(["approve", "reject", "defer"]);
    expect(getAllowedActionItemDecisions("review")).toEqual(["approve", "reject", "defer"]);
    expect(getAllowedActionItemDecisions("defer")).toEqual(["defer"]);
    expect(getAllowedActionItemDecisions("acknowledge")).toEqual([]);

    expect(isActionItemDecisionAllowed("approve", "reject")).toBe(false);
    expect(isActionItemDecisionAllowed("defer", "approve")).toBe(false);
    expect(isActionItemDecisionAllowed("acknowledge", "approve")).toBe(false);
  });

  it("defines approve, reject, and defer transitions for matching decision kinds", () => {
    expect(getActionItemDecisionTransition({
      decisionKind: "approve",
      status: "open"
    }, "approve")).toEqual({
      decision: "approve",
      previousStatus: "open",
      newStatus: "approved"
    });
    expect(getActionItemDecisionTransition({
      decisionKind: "review",
      status: "deferred"
    }, "reject")).toEqual({
      decision: "reject",
      previousStatus: "deferred",
      newStatus: "rejected"
    });
    expect(getActionItemDecisionTransition({
      decisionKind: "approve-or-reject",
      status: "open"
    }, "defer")).toEqual({
      decision: "defer",
      previousStatus: "open",
      newStatus: "deferred"
    });
    expect(getActionItemDecisionTransition({
      decisionKind: "defer",
      status: "deferred"
    }, "defer")).toBeUndefined();
  });

  it("rejects transitions that do not match the decision kind", () => {
    const approveOnlyItem: Pick<ActionItem, "decisionKind" | "status"> = {
      decisionKind: "approve",
      status: "open"
    };
    const acknowledgeItem: Pick<ActionItem, "decisionKind" | "status"> = {
      decisionKind: "acknowledge",
      status: "open"
    };

    expect(getActionItemDecisionTransition(approveOnlyItem, "reject")).toBeUndefined();
    expect(getActionItemDecisionTransition(acknowledgeItem, "approve")).toBeUndefined();
    expect(canDecideActionItem({
      category: "system",
      decisionKind: "acknowledge",
      status: "open"
    }, ["*"])).toBe(false);
  });

  it("allows optional notes up to 1,000 characters", () => {
    const maximumNote = "a".repeat(actionItemDecisionNoteMaxLength);

    expect(isValidActionItemDecisionNote(maximumNote)).toBe(true);
    expect(isValidActionItemDecisionNote(`${maximumNote}a`)).toBe(false);
    expect(isValidActionItemDecisionInput({ decision: "approve" })).toBe(true);
    expect(isValidActionItemDecisionInput({ decision: "defer", note: maximumNote })).toBe(true);
    expect(isValidActionItemDecisionInput({ decision: "reject", note: `${maximumNote}a` })).toBe(false);
  });

  it("rejects explicitly undefined and malformed note values", () => {
    expect(isValidActionItemDecisionNote(undefined)).toBe(false);
    expect(isValidActionItemDecisionInput({ decision: "approve", note: undefined })).toBe(false);
    expect(isValidActionItemDecisionInput({ decision: "approve", note: null })).toBe(false);
    expect(isValidActionItemDecisionInput({ decision: "approve", note: 1 })).toBe(false);
    expect(isValidActionItemDecisionInput({ decision: "approve", note: {} })).toBe(false);
  });

  it("prevents terminal items from being decided again", () => {
    for (const status of ["approved", "rejected", "completed"] as const) {
      expect(canDecideActionItem({
        category: "overlay",
        decisionKind: "review",
        status
      }, ["*"])).toBe(false);
      expect(getActionItemDecisionTransition({
        decisionKind: "review",
        status
      }, "approve")).toBeUndefined();
      expect(getActionItemDecisionTransition({
        decisionKind: "review",
        status
      }, "reject")).toBeUndefined();
      expect(getActionItemDecisionTransition({
        decisionKind: "review",
        status
      }, "defer")).toBeUndefined();
    }
  });
});

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
