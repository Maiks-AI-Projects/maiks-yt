import type {
  EventKind,
  EventRegistryEntry,
  EventRoutingRuleInput,
  EventRoutingRuleValidationIssue,
  EventRoutingRuleValidationResult
} from "@maiks-yt/domain/events";

export type EventRoutingAdminActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type EventRoutingAdminRuleRecord = EventRoutingRuleInput & {
  id: string;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EventRoutingAdminRuleListItem = EventRoutingRuleInput & {
  id: string | null;
  label: string;
  description: string;
  safety: EventRegistryEntry["safety"];
  validation: EventRoutingRuleValidationResult;
  persisted: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type EventRoutingAdminUpsertInput = EventRoutingRuleInput & {
  actorUserId: string;
};

export type EventRoutingAdminListResult =
  | {
    ok: true;
    rules: readonly EventRoutingAdminRuleListItem[];
  }
  | {
    ok: false;
    reason: "event_routing_admin_user_unlinked" | "event_routing_admin_forbidden";
  };

export type EventRoutingAdminUpdateResult =
  | {
    ok: true;
    rule: EventRoutingAdminRuleListItem;
  }
  | {
    ok: false;
    reason:
      | "event_routing_admin_user_unlinked"
      | "event_routing_admin_forbidden"
      | "event_routing_admin_invalid_input";
    issues?: readonly EventRoutingRuleValidationIssue[];
  };

export interface EventRoutingAdminRepository {
  resolveActor(authUserId: string): Promise<EventRoutingAdminActor | null>;
  listRules(): Promise<readonly EventRoutingAdminRuleRecord[]>;
  upsertRule(input: EventRoutingAdminUpsertInput): Promise<EventRoutingAdminRuleRecord>;
  getRule(eventKind: EventKind, sourcePlatform: EventRoutingRuleInput["sourcePlatform"]): Promise<EventRoutingAdminRuleRecord | null>;
}
