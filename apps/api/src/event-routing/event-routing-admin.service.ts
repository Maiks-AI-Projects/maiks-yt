import {
  buildDefaultEventRoutingRule,
  canManageEventRouting,
  eventKinds,
  getEventRegistryEntry,
  validateEventRoutingRule,
  type EventRoutingRuleInput
} from "@maiks-yt/domain/events";

import type {
  EventRoutingAdminActor,
  EventRoutingAdminApprovalListResult,
  EventRoutingAdminApprovalRecord,
  EventRoutingAdminApprovalReviewResult,
  EventRoutingAdminPlaybackPublisher,
  EventRoutingAdminListResult,
  EventRoutingAdminRepository,
  EventRoutingAdminRuleListItem,
  EventRoutingAdminRuleRecord,
  EventRoutingAdminUpdateResult
} from "./event-routing-admin.types.js";
import { buildSafeEventRoutingPlaybackProjection } from "./event-routing-playback.service.js";

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
  rule: EventRoutingRuleInput & Partial<Pick<EventRoutingAdminRuleRecord, "id" | "createdAt" | "updatedAt">>
): EventRoutingAdminRuleListItem => {
  const entry = getEventRegistryEntry(rule.eventKind);

  return {
    ...rule,
    id: rule.id ?? null,
    label: entry.label,
    description: entry.description,
    safety: entry.safety,
    validation: validateEventRoutingRule(rule),
    persisted: Boolean(rule.id),
    createdAt: rule.createdAt ?? null,
    updatedAt: rule.updatedAt ?? null
  };
};

const ruleKey = (rule: Pick<EventRoutingRuleInput, "eventKind" | "sourcePlatform">): string =>
  `${rule.eventKind}:${rule.sourcePlatform}`;

export class EventRoutingAdminService {
  public constructor(
    private readonly repository: EventRoutingAdminRepository,
    private readonly publishPlayback?: EventRoutingAdminPlaybackPublisher
  ) {}

  public async listRules(input: { authUserId: string }): Promise<EventRoutingAdminListResult> {
    const actor = await this.requireActor(input.authUserId);

    if (!actor.ok) {
      return actor;
    }

    const persistedRules = await this.repository.listRules();
    const rulesByKey = new Map<string, EventRoutingAdminRuleRecord>(
      persistedRules.map((rule) => [ruleKey(rule), rule])
    );
    const listItems = eventKinds.map((eventKind) =>
      toRuleListItem(rulesByKey.get(ruleKey({
        eventKind,
        sourcePlatform: "any"
      })) ?? buildDefaultEventRoutingRule(eventKind))
    );

    const providerSpecificRules = persistedRules
      .filter((rule) => rule.sourcePlatform !== "any")
      .map(toRuleListItem);

    return {
      ok: true,
      rules: [...listItems, ...providerSpecificRules]
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
      rule: toRuleListItem(record)
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
      approvals: approvals.map((approval) => this.toApprovalRecord(approval, null))
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

    if (!approval) {
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
          approval: this.toApprovalRecord(reviewed, null)
        }
        : {
          ok: false,
          reason: "event_routing_admin_approval_not_found"
        };
    }

    const projected = buildSafeEventRoutingPlaybackProjection({
      history: approval.event,
      destination: approval.destination,
      notificationPriority: approval.rule.notificationPriority
    });
    const shouldBlockApproval = !projected.ok
      && projected.reason !== "event_routing_playback_inert_destination";

    if (shouldBlockApproval) {
      const playback = {
        projected,
        published: null
      };
      await this.repository.reviewApproval({
        id: input.approvalId,
        status: "rejected",
        reviewerUserId: actor.domainUserId,
        reviewNote: input.reviewNote ?? `Blocked playback: ${projected.reason}`,
        playback
      });

      return {
        ok: false,
        reason: "event_routing_admin_approval_playback_blocked",
        playback
      };
    }

    const published = projected.ok
      ? await this.publishPlayback?.(projected.projection) ?? {
        emitted: false
      }
      : null;
    const playback = {
      projected,
      published
    };
    const reviewed = await this.repository.reviewApproval({
      id: input.approvalId,
      status: "approved",
      reviewerUserId: actor.domainUserId,
      reviewNote: input.reviewNote,
      playback
    });

    return reviewed
      ? {
        ok: true,
        approval: this.toApprovalRecord(reviewed, playback)
      }
      : {
        ok: false,
        reason: "event_routing_admin_approval_not_found"
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

  private toApprovalRecord(
    approval: EventRoutingAdminApprovalRecord,
    playback: EventRoutingAdminApprovalRecord["playback"]
  ): EventRoutingAdminApprovalRecord {
    const entry = getEventRegistryEntry(approval.event.eventKind);

    return {
      ...approval,
      label: entry.label,
      description: entry.description,
      safety: entry.safety,
      playback
    };
  }
}
