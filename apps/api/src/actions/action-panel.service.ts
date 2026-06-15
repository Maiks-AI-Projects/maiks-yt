import {
  canDecideActionItem,
  canViewActionPanel,
  getAllowedActionItemDecisions,
  getActionItemDecisionTransition,
  sortActionItemsForContext,
  type ActionItem,
  type ActionItemCategory,
  type ActionItemDecision
} from "@maiks-yt/domain/actions";

import {
  actionPanelHistoryLimit,
  type ActionPanelDecisionRequest,
  type ActionPanelDecisionResult,
  type ActionPanelItem,
  type ActionPanelListResult,
  type ActionPanelRepository,
  type PersistentActionItem
} from "./action-panel.types.js";

const parsePermissionArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const normalizeActionPanelPermissions = (
  rolePermissionValues: readonly unknown[]
): string[] => {
  const permissions = new Set<string>();

  for (const rolePermissionValue of rolePermissionValues) {
    for (const permission of parsePermissionArray(rolePermissionValue)) {
      if (typeof permission === "string") {
        permissions.add(permission);
      }
    }
  }

  return [...permissions];
};

const hasCategoryDecisionPermission = (
  category: ActionItemCategory,
  permissions: readonly unknown[]
): boolean => canDecideActionItem({
  category,
  decisionKind: "review",
  status: "open"
}, permissions);

const getTransition = (
  item: Pick<ActionItem, "decisionKind" | "status">,
  decision: ActionItemDecision
) => getActionItemDecisionTransition(item, decision);

const decorateActionItem = (
  item: PersistentActionItem,
  permissions: readonly unknown[]
): ActionPanelItem => {
  const canDecide = canDecideActionItem(item, permissions);
  const allowedDecisions = canDecide
    ? (getAllowedActionItemDecisions(item.decisionKind) as readonly ActionItemDecision[])
      .filter((decision) => getTransition(item, decision) !== undefined)
    : [];

  return {
    ...item,
    canDecide,
    allowedDecisions
  };
};

export class ActionPanelService {
  public constructor(
    private readonly repository: ActionPanelRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async listActions(input: {
    authUserId: string;
    live: boolean;
  }): Promise<ActionPanelListResult> {
    const actor = await this.repository.resolveActor(input.authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "action_panel_user_unlinked"
      };
    }

    const permissions = normalizeActionPanelPermissions(actor.rolePermissionValues);

    if (!canViewActionPanel(permissions)) {
      return {
        ok: false,
        reason: "action_panel_view_forbidden"
      };
    }

    const [items, history] = await Promise.all([
      this.repository.listActiveItems(),
      this.repository.listRecentHistory(actionPanelHistoryLimit)
    ]);
    const active = (sortActionItemsForContext(items, {
      live: input.live,
      now: this.now().toISOString()
    }) as PersistentActionItem[]).map((item) => decorateActionItem(item, permissions));

    return {
      ok: true,
      live: input.live,
      active,
      history,
      historyLimit: actionPanelHistoryLimit
    };
  }

  public async decideAction(input: {
    authUserId: string;
    actionId: string;
    request: ActionPanelDecisionRequest;
  }): Promise<ActionPanelDecisionResult> {
    return await this.repository.transaction(async (transaction) => {
      const actor = await transaction.resolveActor(input.authUserId);

      if (!actor) {
        return {
          ok: false,
          reason: "action_panel_user_unlinked"
        };
      }

      const permissions = normalizeActionPanelPermissions(actor.rolePermissionValues);

      if (!canViewActionPanel(permissions)) {
        return {
          ok: false,
          reason: "action_item_decision_forbidden"
        };
      }

      const item = await transaction.findActionForUpdate(input.actionId);

      if (!item) {
        return {
          ok: false,
          reason: "action_item_not_found"
        };
      }

      if (!hasCategoryDecisionPermission(item.category, permissions)) {
        return {
          ok: false,
          reason: "action_item_decision_forbidden"
        };
      }

      if (item.status !== input.request.expectedStatus) {
        return {
          ok: false,
          reason: "action_item_status_conflict"
        };
      }

      const transition = getTransition(item, input.request.decision);

      if (!transition) {
        return {
          ok: false,
          reason: "action_item_transition_conflict"
        };
      }

      const updated = await transaction.updateActionStatus({
        id: item.id,
        expectedStatus: input.request.expectedStatus,
        newStatus: transition.newStatus
      });

      if (!updated) {
        return {
          ok: false,
          reason: "action_item_status_conflict"
        };
      }

      await transaction.insertHistory({
        actionId: item.id,
        actorUserId: actor.domainUserId,
        decision: transition.decision,
        previousStatus: transition.previousStatus,
        newStatus: transition.newStatus,
        ...(input.request.note === undefined ? {} : { note: input.request.note })
      });

      const updatedItem = await transaction.findActionForUpdate(item.id);

      if (!updatedItem) {
        throw new Error("Updated action item could not be re-read.");
      }

      return {
        ok: true,
        item: decorateActionItem(updatedItem, permissions)
      };
    });
  }
}
