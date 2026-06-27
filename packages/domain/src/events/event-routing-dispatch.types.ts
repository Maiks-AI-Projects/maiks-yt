import type { EventKind, EventSourcePlatform } from "./event-registry.types.js";
import type {
  EventRoutingDestination,
  EventRoutingRuleInput,
  EventRoutingRuleValidationIssue,
  EventRoutingRuleValidationResult
} from "./event-routing-rules.types.js";

export type EventRoutingDispatchRoutingOutcome =
  | "ignored"
  | "stored_internal"
  | "routed"
  | "queued_for_approval"
  | "blocked_opt_out"
  | "blocked_cooldown"
  | "blocked_safety";

export type SafeSimulatedEventRoutingDispatchInput = {
  sourcePlatform: EventSourcePlatform;
  eventKind: EventKind;
  explicitSimulation: boolean;
  isRealMoney: boolean;
};

export type SafeSimulatedEventRoutingDispatchIssue =
  | "event_routing_dispatch_invalid_source"
  | "event_routing_dispatch_invalid_event_kind"
  | "event_routing_dispatch_source_cannot_emit_event"
  | "event_routing_dispatch_real_provider_rejected"
  | "event_routing_dispatch_real_website_rejected"
  | "event_routing_dispatch_real_money_rejected";

export type SafeSimulatedEventRoutingDispatchValidationResult = {
  ok: boolean;
  issues: readonly SafeSimulatedEventRoutingDispatchIssue[];
};

export type SafeSimulatedEventRoutingDecision =
  | {
    ok: true;
    routingOutcome: EventRoutingDispatchRoutingOutcome;
    destination: EventRoutingDestination | null;
    rule: EventRoutingRuleInput;
    ruleValidation: EventRoutingRuleValidationResult;
    requiresApprovalQueue: boolean;
    requiresUserOptOutCheck: boolean;
    requiresCooldownCheck: boolean;
  }
  | {
    ok: false;
    dispatchIssues: readonly SafeSimulatedEventRoutingDispatchIssue[];
    ruleIssues: readonly EventRoutingRuleValidationIssue[];
  };
