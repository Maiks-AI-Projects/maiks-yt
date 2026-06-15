import type {
  ActionItem,
  ActionItemDecision,
  ActionItemStatus
} from "@maiks-yt/domain/actions";

export const actionPanelHistoryLimit = 25;

export type PersistentActionItem = ActionItem & {
  updatedAt: string;
};

export type ActionPanelItem = PersistentActionItem & {
  allowedDecisions: ActionItemDecision[];
  canDecide: boolean;
};

export type ActionItemHistoryEntry = {
  id: string;
  actionId: string;
  actionTitle: string;
  decision: ActionItemDecision;
  previousStatus: ActionItemStatus;
  newStatus: ActionItemStatus;
  actor: {
    id: string;
    displayName: string;
  };
  note?: string;
  createdAt: string;
};

export type ActionPanelActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type ActionPanelDecisionRequest = {
  decision: ActionItemDecision;
  expectedStatus: ActionItemStatus;
  note?: string;
};

export type ActionPanelDecisionRecord = {
  actionId: string;
  actorUserId: string;
  decision: ActionItemDecision;
  previousStatus: ActionItemStatus;
  newStatus: ActionItemStatus;
  note?: string;
};

export interface ActionPanelTransaction {
  resolveActor(authUserId: string): Promise<ActionPanelActor | null>;
  findActionForUpdate(id: string): Promise<PersistentActionItem | null>;
  updateActionStatus(input: {
    id: string;
    expectedStatus: ActionItemStatus;
    newStatus: ActionItemStatus;
  }): Promise<boolean>;
  insertHistory(record: ActionPanelDecisionRecord): Promise<void>;
}

export interface ActionPanelRepository {
  resolveActor(authUserId: string): Promise<ActionPanelActor | null>;
  listActiveItems(): Promise<PersistentActionItem[]>;
  listRecentHistory(limit: number): Promise<ActionItemHistoryEntry[]>;
  transaction<Result>(
    operation: (transaction: ActionPanelTransaction) => Promise<Result>
  ): Promise<Result>;
}

export type ActionPanelListResult =
  | {
    ok: true;
    live: boolean;
    active: ActionPanelItem[];
    history: ActionItemHistoryEntry[];
    historyLimit: number;
  }
  | {
    ok: false;
    reason: "action_panel_user_unlinked" | "action_panel_view_forbidden";
  };

export type ActionPanelDecisionResult =
  | {
    ok: true;
    item: ActionPanelItem;
  }
  | {
    ok: false;
    reason:
      | "action_panel_user_unlinked"
      | "action_item_not_found"
      | "action_item_decision_forbidden"
      | "action_item_status_conflict"
      | "action_item_transition_conflict";
  };
