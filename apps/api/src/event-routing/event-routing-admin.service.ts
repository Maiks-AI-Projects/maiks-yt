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
  EventRoutingAdminListResult,
  EventRoutingAdminRepository,
  EventRoutingAdminRuleListItem,
  EventRoutingAdminRuleRecord,
  EventRoutingAdminUpdateResult
} from "./event-routing-admin.types.js";

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
  public constructor(private readonly repository: EventRoutingAdminRepository) {}

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
}
