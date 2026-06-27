import {
  canSourceEmitEventKind,
  getEventRegistryEntry,
  isEventKind,
  isEventSourcePlatform
} from "./event-registry.rules.js";
import type { EventSourcePlatform } from "./event-registry.types.js";
import {
  isStreamVisibleEventRoutingDestination,
  validateEventRoutingRule
} from "./event-routing-rules.rules.js";
import type { EventRoutingRuleInput } from "./event-routing-rules.types.js";
import type {
  SafeSimulatedEventRoutingDecision,
  SafeSimulatedEventRoutingDispatchInput,
  SafeSimulatedEventRoutingDispatchIssue,
  SafeSimulatedEventRoutingDispatchValidationResult
} from "./event-routing-dispatch.types.js";

const providerSources = new Set<EventSourcePlatform>(["twitch", "youtube", "discord"]);

export const validateSafeSimulatedEventRoutingDispatch = (
  input: SafeSimulatedEventRoutingDispatchInput
): SafeSimulatedEventRoutingDispatchValidationResult => {
  const issues: SafeSimulatedEventRoutingDispatchIssue[] = [];
  const sourcePlatform = input.sourcePlatform;
  const eventKind = input.eventKind;

  if (!isEventSourcePlatform(sourcePlatform)) {
    issues.push("event_routing_dispatch_invalid_source");
  }

  if (!isEventKind(eventKind)) {
    issues.push("event_routing_dispatch_invalid_event_kind");
  }

  if (isEventSourcePlatform(sourcePlatform)
    && isEventKind(eventKind)
    && !canSourceEmitEventKind(sourcePlatform, eventKind)) {
    issues.push("event_routing_dispatch_source_cannot_emit_event");
  }

  if (isEventSourcePlatform(sourcePlatform)
    && providerSources.has(sourcePlatform)
    && !input.explicitSimulation) {
    issues.push("event_routing_dispatch_real_provider_rejected");
  }

  if (sourcePlatform === "website" && !input.explicitSimulation) {
    issues.push("event_routing_dispatch_real_website_rejected");
  }

  if (input.isRealMoney) {
    issues.push("event_routing_dispatch_real_money_rejected");
  }

  return {
    ok: issues.length === 0,
    issues
  };
};

export const resolveSafeSimulatedEventRoutingDecision = (input: {
  dispatch: SafeSimulatedEventRoutingDispatchInput;
  rule: EventRoutingRuleInput;
}): SafeSimulatedEventRoutingDecision => {
  const dispatchValidation = validateSafeSimulatedEventRoutingDispatch(input.dispatch);
  const ruleValidation = validateEventRoutingRule(input.rule);

  if (!dispatchValidation.ok || !ruleValidation.ok) {
    return {
      ok: false,
      dispatchIssues: dispatchValidation.issues,
      ruleIssues: ruleValidation.issues
    };
  }

  if (!input.rule.enabled || input.rule.destination === "ignore") {
    return {
      ok: true,
      routingOutcome: "ignored",
      destination: null,
      rule: input.rule,
      ruleValidation,
      requiresApprovalQueue: false,
      requiresUserOptOutCheck: false,
      requiresCooldownCheck: false
    };
  }

  const requiresApprovalQueue = input.rule.approvalRequired || input.rule.destination === "approval_queue";
  const routingOutcome = requiresApprovalQueue
    ? "queued_for_approval"
    : input.rule.destination === "internal_audit"
      ? "stored_internal"
      : "routed";
  const entry = getEventRegistryEntry(input.dispatch.eventKind);

  return {
    ok: true,
    routingOutcome,
    destination: input.rule.destination,
    rule: input.rule,
    ruleValidation,
    requiresApprovalQueue,
    requiresUserOptOutCheck: ruleValidation.requiresUserOptOutCheck,
    requiresCooldownCheck: Boolean(
      ruleValidation.requiresCooldownCheck
        || (entry.safety.cooldownRecommended
          && isStreamVisibleEventRoutingDestination(input.rule.destination))
    )
  };
};
