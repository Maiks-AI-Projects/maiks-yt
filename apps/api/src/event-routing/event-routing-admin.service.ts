import {
  buildDefaultEventRoutingRule,
  canManageEventRouting,
  eventRoutingDestinationCapabilities,
  eventKinds,
  getProductionEventRoutingRuleDescription,
  getEventRoutingDestinationCapability,
  getEventRegistryEntry,
  isProductionEventRoutingRuleInput,
  listProductionEventRoutingRuleEventKinds,
  validateEventRoutingRule,
  type EventRoutingRuleInput
} from "@maiks-yt/domain/events";

import type {
  EventRoutingAdminActor,
  EventRoutingAdminApprovalListResult,
  EventRoutingAdminApprovalReviewResult,
  EventRoutingAdminCooldownSummaryResult,
  EventRoutingAdminDeleteResult,
  EventRoutingAdminHistoryResult,
  EventRoutingAdminListResult,
  EventRoutingAdminRepository,
  EventRoutingAdminRuleListItem,
  EventRoutingAdminRuleRecord,
  EventRoutingAdminUpdateResult
} from "./event-routing-admin.types.js";
import {
  projectEventRoutingAdminApproval,
  projectEventRoutingOperationalHistory
} from "./event-routing-admin-projection.service.js";

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

export const normalizeEventRoutingAdminPermissions = (
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

const toRuleListItem = (
  rule: EventRoutingRuleInput & Partial<Pick<EventRoutingAdminRuleRecord, "id" | "createdAt" | "updatedAt">>,
  options: { productionCatalogue: boolean }
): EventRoutingAdminRuleListItem => {
  const entry = getEventRegistryEntry(rule.eventKind);

  return {
    ...rule,
    id: rule.id ?? null,
    label: entry.label,
    description: options.productionCatalogue
      ? getProductionEventRoutingRuleDescription(rule.eventKind)
      : entry.description,
    safety: entry.safety,
    validation: validateEventRoutingRule(rule),
    destinationCapability: getEventRoutingDestinationCapability(rule.destination),
    persisted: Boolean(rule.id),
    createdAt: rule.createdAt ?? null,
    updatedAt: rule.updatedAt ?? null
  };
};

const ruleKey = (rule: Pick<EventRoutingRuleInput, "eventKind" | "sourcePlatform">): string =>
  `${rule.eventKind}:${rule.sourcePlatform}`;

const isProductionApproval = (
  approval: Parameters<typeof projectEventRoutingAdminApproval>[0]
): boolean => !approval.event.isTest
  && !approval.event.isSimulated
  && !approval.event.testResettable
  && approval.event.sourcePlatform !== "test/system"
  && !getEventRegistryEntry(approval.event.eventKind).safety.simulatedOnly;

export class EventRoutingAdminService {
  public constructor(
    private readonly repository: EventRoutingAdminRepository,
    private readonly options: { productionCatalogue: boolean } = { productionCatalogue: false }
  ) {}

  public async listRules(input: { authUserId: string }): Promise<EventRoutingAdminListResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const persistedRules = await this.repository.listRules();
    const visiblePersistedRules = this.options.productionCatalogue
      ? persistedRules.filter(isProductionEventRoutingRuleInput)
      : persistedRules;
    const rulesByKey = new Map<string, EventRoutingAdminRuleRecord>(
      visiblePersistedRules.map((rule) => [ruleKey(rule), rule])
    );
    const catalogueEventKinds = this.options.productionCatalogue
      ? listProductionEventRoutingRuleEventKinds()
      : eventKinds;
    const listItems = catalogueEventKinds.map((eventKind) =>
      toRuleListItem(rulesByKey.get(ruleKey({
        eventKind,
        sourcePlatform: "any"
      })) ?? buildDefaultEventRoutingRule(eventKind), this.options)
    );

    const providerSpecificRules = visiblePersistedRules
      .filter((rule) => rule.sourcePlatform !== "any")
      .map((rule) => toRuleListItem(rule, this.options));

    return {
      ok: true,
      rules: [...listItems, ...providerSpecificRules],
      destinationCapabilities: eventRoutingDestinationCapabilities
    };
  }

  public async updateRule(input: {
    authUserId: string;
    rule: EventRoutingRuleInput;
  }): Promise<EventRoutingAdminUpdateResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (this.options.productionCatalogue && !isProductionEventRoutingRuleInput(input.rule)) {
      return {
        ok: false,
        reason: "event_routing_admin_production_catalogue_forbidden",
        issues: ["event_routing_production_catalogue_forbidden"]
      };
    }

    const validation = validateEventRoutingRule(input.rule);

    if (!validation.ok) {
      return {
        ok: false,
        reason: "event_routing_admin_invalid_input",
        issues: validation.issues
      };
    }

    const record = await this.repository.upsertRule({
      ...input.rule,
      actorUserId: actor.domainUserId
    });

    return {
      ok: true,
      rule: toRuleListItem(record, this.options)
    };
  }

  public async listPendingApprovals(input: {
    authUserId: string;
    limit?: number;
  }): Promise<EventRoutingAdminApprovalListResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const limit = Math.max(1, Math.min(input.limit ?? 25, 100));
    const approvals = await this.repository.listPendingApprovals(limit);

    return {
      ok: true,
      approvals: approvals
        .filter(isProductionApproval)
        .map((approval) => projectEventRoutingAdminApproval(approval, null))
    };
  }

  public async reviewApproval(input: {
    authUserId: string;
    approvalId: string;
    action: "approve" | "reject";
    reviewNote: string | null;
  }): Promise<EventRoutingAdminApprovalReviewResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const approval = await this.repository.getPendingApproval(input.approvalId);

    if (!approval || !isProductionApproval(approval)) {
      return {
        ok: false,
        reason: "event_routing_admin_approval_not_found"
      };
    }

    if (input.action === "reject") {
      const reviewed = await this.repository.reviewApproval({
        id: input.approvalId,
        status: "rejected",
        reviewerUserId: actor.domainUserId,
        reviewNote: input.reviewNote,
        playback: null
      });

      return reviewed
        ? {
          ok: true,
          approval: projectEventRoutingAdminApproval(reviewed, null)
        }
        : {
          ok: false,
          reason: "event_routing_admin_approval_not_found"
        };
    }

    // Production approval review is visible now, but real provider events do not
    // execute routing rules yet. Keep the queue row pending until that consumer exists.
    return {
      ok: false,
      reason: "event_routing_admin_production_execution_unavailable"
    };
  }

  public async deleteRule(input: {
    authUserId: string;
    eventKind: EventRoutingRuleInput["eventKind"];
    sourcePlatform: EventRoutingRuleInput["sourcePlatform"];
  }): Promise<EventRoutingAdminDeleteResult> {
    const actor = await this.requireOwner(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    if (this.options.productionCatalogue && !isProductionEventRoutingRuleInput(input)) {
      return {
        ok: false,
        reason: "event_routing_admin_production_catalogue_forbidden"
      };
    }

    const removed = await this.repository.deleteRule(input.eventKind, input.sourcePlatform);
    const fallback = input.sourcePlatform === "any"
      ? buildDefaultEventRoutingRule(input.eventKind)
      : await this.repository.getRule(input.eventKind, "any")
        ?? buildDefaultEventRoutingRule(input.eventKind);

    return {
      ok: true,
      removed,
      fallback: toRuleListItem(fallback, this.options)
    };
  }

  public async getCooldownSummary(input: {
    authUserId: string;
    eventKind: EventRoutingRuleInput["eventKind"];
    sourcePlatform: EventRoutingRuleInput["sourcePlatform"];
  }): Promise<EventRoutingAdminCooldownSummaryResult> {
    const actor = await this.requireOwner(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const selectedRule = await this.repository.getRule(input.eventKind, input.sourcePlatform)
      ?? (input.sourcePlatform === "any"
        ? null
        : await this.repository.getRule(input.eventKind, "any"));

    if (!selectedRule) {
      return {
        ok: true,
        summary: {
          activeCount: 0,
          nearestExpiry: null,
          rulePersisted: false
        }
      };
    }

    return {
      ok: true,
      summary: {
        ...await this.repository.getActiveCooldownSummary({
          routingRuleId: selectedRule.id,
          eventKind: input.eventKind,
          sourcePlatform: input.sourcePlatform
        }),
        rulePersisted: true
      }
    };
  }

  public async listOperationalHistory(input: {
    authUserId: string;
    limit?: number;
  }): Promise<EventRoutingAdminHistoryResult> {
    const actor = await this.requireOwner(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const limit = Math.max(1, Math.min(input.limit ?? 50, 100));
    const history = await this.repository.listOperationalHistory(limit);

    return {
      ok: true,
      history: history
        .filter((record) => !record.isTest
          && !record.isSimulated
          && !record.testResettable
          && !getEventRegistryEntry(record.eventKind).safety.simulatedOnly)
        .map(projectEventRoutingOperationalHistory)
    };
  }

  private async requireActor(authUserId: string): Promise<{
    ok: true;
    domainUserId: string;
  } | {
    ok: false;
    reason: "event_routing_admin_user_unlinked" | "event_routing_admin_forbidden";
  }> {
    const actor: EventRoutingAdminActor | null = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "event_routing_admin_user_unlinked"
      };
    }

    if (!canManageEventRouting(normalizeEventRoutingAdminPermissions(actor.rolePermissionValues))) {
      return {
        ok: false,
        reason: "event_routing_admin_forbidden"
      };
    }

    return {
      ok: true,
      domainUserId: actor.domainUserId
    };
  }

  private async requireOwner(authUserId: string): Promise<{
    ok: true;
    domainUserId: string;
  } | {
    ok: false;
    reason: "event_routing_admin_user_unlinked" | "event_routing_admin_forbidden";
  }> {
    const actor = await this.repository.resolveActor(authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "event_routing_admin_user_unlinked"
      };
    }

    if (!normalizeEventRoutingAdminPermissions(actor.rolePermissionValues).includes("*")) {
      return {
        ok: false,
        reason: "event_routing_admin_forbidden"
      };
    }

    return {
      ok: true,
      domainUserId: actor.domainUserId
    };
  }
}
