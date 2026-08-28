import {
  buildDefaultEventRoutingRule,
  canManageEventRouting,
  eventRoutingDestinationCapabilities,
  eventKinds,
  getEventRoutingOncePerStreamAvailability,
  getProductionEventRoutingRuleDescription,
  getEventRoutingDestinationCapability,
  getEventRegistryEntry,
  isProductionEventRoutingRuleInput,
  listProductionEventRoutingRuleEventKinds,
  validatePersistedEventRoutingRule,
  validateEventRoutingRuleAdminInput,
  type EventRoutingRuleInput
} from "@maiks-yt/domain/events";

import type {
  EventRoutingAdminActor,
  EventRoutingAdminApprovalBrowserRecord,
  EventRoutingAdminApprovalPlaybackOutcome,
  EventRoutingAdminApprovalRepositoryRecord,
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
import type { EventRoutingPlaybackPublisher } from "./event-routing-dispatch.types.js";
import { buildProductionEventRoutingPlaybackProjection } from "./event-routing-playback.service.js";

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
    validation: rule.id
      ? validatePersistedEventRoutingRule(rule)
      : validateEventRoutingRuleAdminInput(rule),
    destinationCapability: getEventRoutingDestinationCapability(rule.destination),
    oncePerStreamAvailability: getEventRoutingOncePerStreamAvailability(rule),
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
  && !approval.event.isRealMoney
  && !approval.event.testResettable
  && approval.event.sourcePlatform !== "test/system"
  && !getEventRegistryEntry(approval.event.eventKind).safety.simulatedOnly;

const projectBrowserApproval = (
  approval: EventRoutingAdminApprovalRepositoryRecord,
  playback: EventRoutingAdminApprovalPlaybackOutcome | null
): EventRoutingAdminApprovalBrowserRecord => {
  const projected = projectEventRoutingAdminApproval(approval, playback);

  return {
    approvalRef: approval.approvalRef,
    productionEvent: projected.productionEvent,
    destination: projected.destination,
    status: projected.status,
    reviewedAt: projected.reviewedAt,
    reviewNote: projected.reviewNote,
    createdAt: projected.createdAt,
    updatedAt: projected.updatedAt,
    event: {
      sourcePlatform: projected.event.sourcePlatform,
      eventKind: projected.event.eventKind,
      occurredAt: projected.event.occurredAt,
      context: {
        displayText: projected.event.context.displayText,
        displayName: projected.event.context.displayName,
        title: projected.event.context.title,
        projectLabel: projected.event.context.projectLabel,
        amount: projected.event.context.amount,
        currency: projected.event.context.currency
      }
    },
    rule: {
      notificationPriority: approval.rule.notificationPriority,
      sourcePlatform: approval.rule.sourcePlatform
    },
    label: projected.label,
    description: projected.description,
    safety: projected.safety,
    playback
  };
};

const isPlaybackDestination = (
  destination: EventRoutingRuleInput["destination"]
): destination is "top_notification" | "center_notification" =>
  destination === "top_notification" || destination === "center_notification";

const requiresCurrentWebsiteOptOutCheck = (
  approval: EventRoutingAdminApprovalRepositoryRecord
): boolean => approval.event.sourcePlatform === "website"
  && isPlaybackDestination(approval.destination)
  && getEventRegistryEntry(approval.event.eventKind).safety.optOutSupported;

const isMatchingTerminalAction = (
  approval: EventRoutingAdminApprovalRepositoryRecord,
  action: "approve" | "reject"
): boolean => (action === "approve" && approval.status === "approved")
  || (action === "reject" && approval.status === "rejected");

export class EventRoutingAdminService {
  public constructor(
    private readonly repository: EventRoutingAdminRepository,
    private readonly options: {
      productionCatalogue: boolean;
      publishPlayback?: EventRoutingPlaybackPublisher;
    } = { productionCatalogue: false }
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

    const existingRule = await this.repository.getRule(input.rule.eventKind, input.rule.sourcePlatform);
    const validation = validateEventRoutingRuleAdminInput(input.rule, existingRule);

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
        .map((approval) => projectBrowserApproval(approval, null))
    };
  }

  public async reviewApproval(input: {
    authUserId: string;
    approvalRef: string;
    action: "approve" | "reject";
    reviewNote: string | null;
  }): Promise<EventRoutingAdminApprovalReviewResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const approval = await this.repository.getPendingApprovalByRef(input.approvalRef);

    if (!approval) {
      return await this.reviewTerminalApproval(input);
    }

    if (!isProductionApproval(approval)) {
      return {
        ok: false,
        reason: "event_routing_admin_approval_not_found"
      };
    }

    const reviewed = await this.repository.reviewApproval({
      id: approval.id,
      status: input.action === "approve" ? "approved" : "rejected",
      reviewerUserId: actor.domainUserId,
      reviewNote: input.reviewNote,
      playback: null
    });

    if (reviewed.kind === "not_found") {
      return {
        ok: false,
        reason: "event_routing_admin_approval_not_found"
      };
    }

    if (reviewed.kind === "terminal") {
      return this.toTerminalReviewResult(reviewed.approval, input.action);
    }

    if (input.action === "reject") {
      return {
        ok: true,
        approval: projectBrowserApproval(reviewed.approval, null)
      };
    }

    const playback = await this.publishApprovedEvent(reviewed.approval);

    return {
      ok: true,
      approval: projectBrowserApproval(reviewed.approval, playback)
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

  private async reviewTerminalApproval(input: {
    approvalRef: string;
    action: "approve" | "reject";
  }): Promise<EventRoutingAdminApprovalReviewResult> {
    const terminal = await this.repository.getApprovalByRef(input.approvalRef);

    if (!terminal || !isProductionApproval(terminal)) {
      return {
        ok: false,
        reason: "event_routing_admin_approval_not_found"
      };
    }

    return this.toTerminalReviewResult(terminal, input.action);
  }

  private toTerminalReviewResult(
    approval: EventRoutingAdminApprovalRepositoryRecord,
    action: "approve" | "reject"
  ): EventRoutingAdminApprovalReviewResult {
    if (!isMatchingTerminalAction(approval, action)) {
      return {
        ok: false,
        reason: "event_routing_admin_approval_conflict"
      };
    }

    return {
      ok: true,
      approval: projectBrowserApproval(approval, null)
    };
  }

  private async publishApprovedEvent(
    approval: EventRoutingAdminApprovalRepositoryRecord
  ): Promise<EventRoutingAdminApprovalPlaybackOutcome | null> {
    if (approval.destination === "approval_queue") {
      return null;
    }

    if (requiresCurrentWebsiteOptOutCheck(approval)) {
      if (!approval.event.userId
        || await this.repository.isUserOptedOut({
          userId: approval.event.userId,
          eventKind: approval.event.eventKind
        })) {
        return {
          projected: {
            ok: false,
            reason: "event_routing_playback_current_opt_out"
          },
          published: null
        };
      }
    }

    const projection = buildProductionEventRoutingPlaybackProjection({
      history: approval.event,
      destination: approval.destination,
      notificationPriority: approval.rule.notificationPriority,
      soundKey: approval.rule.soundKey
    });

    if (!projection.ok) {
      return {
        projected: {
          ok: false,
          reason: projection.reason
        },
        published: null
      };
    }

    if (!this.options.publishPlayback) {
      return {
        projected: { ok: true },
        published: null
      };
    }

    try {
      const published = await this.options.publishPlayback(projection.projection);

      return {
        projected: { ok: true },
        published: {
          emitted: published.emitted,
          ...(published.reason ? { reason: published.reason } : {})
        }
      };
    } catch {
      return {
        projected: { ok: true },
        published: null
      };
    }
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
