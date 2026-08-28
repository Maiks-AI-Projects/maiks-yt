export type ProfileHandleState = "active" | "reserved" | "retired";

export type ProfileHandleReservationTransitionKind = "owner_reserved" | "policy_reserved";

export type ProfileHandleActiveTransitionKind = "owner_assigned" | "expired_reuse_assigned";

export type ProfileHandleRetiredTransitionKind = "renamed" | "deleted_user" | "admin_retired";

export type ProfileHandleTransitionKind =
  | ProfileHandleReservationTransitionKind
  | ProfileHandleActiveTransitionKind
  | ProfileHandleRetiredTransitionKind;

export type ProfileHandleNormalizationRejectionReason =
  | "invalid_character"
  | "handle_too_short"
  | "handle_too_long"
  | "leading_hyphen"
  | "trailing_hyphen"
  | "consecutive_hyphen"
  | "reserved_handle";

export type ProfileHandleNormalizationResult =
  | {
    ok: true;
    handle: string;
  }
  | {
    ok: false;
    reason: ProfileHandleNormalizationRejectionReason;
  };

export type ProfileHandleSnapshot =
  | {
    handle: string;
    state: "active";
    transitionKind: ProfileHandleActiveTransitionKind;
  }
  | {
    handle: string;
    state: "reserved";
    transitionKind: ProfileHandleReservationTransitionKind;
  }
  | {
    handle: string;
    state: "retired";
    reusableAfter: string;
    transitionKind: ProfileHandleRetiredTransitionKind;
  };

export type ProfileHandleTransitionRejectionReason =
  | "reviewed_data_action_required"
  | "target_account_already_has_active_handle"
  | "handle_not_reserved"
  | "handle_not_retired"
  | "handle_not_active"
  | "retired_handle_not_reusable"
  | "same_handle"
  | "target_handle_active"
  | "target_handle_reserved"
  | "target_handle_retired_not_reusable"
  | "target_handle_unavailable"
  | "reserved_handle_not_assignable"
  | "reserved_target_not_assignable"
  | "reserved_target_state_missing"
  | "reserved_target_requires_review";

export type ProfileHandleActivePlan = {
  state: "active";
  handle: string;
  assignedAt: string;
  transitionKind: ProfileHandleActiveTransitionKind;
};

export type ProfileHandleRetiredPlan = {
  state: "retired";
  handle: string;
  retiredAt: string;
  reusableAfter: string;
  transitionKind: ProfileHandleRetiredTransitionKind;
};

export type ProfileHandleReservedPlan = {
  state: "reserved";
  handle: string;
  reservedAt: string;
  transitionKind: ProfileHandleReservationTransitionKind;
};

export type ProfileHandleReleasePlan = {
  kind: "release_reserved";
  handle: string;
};

export type ProfileHandleTransitionDecision<TPlan> =
  | {
    ok: true;
    plan: TPlan;
  }
  | {
    ok: false;
    reason: ProfileHandleTransitionRejectionReason;
  };
