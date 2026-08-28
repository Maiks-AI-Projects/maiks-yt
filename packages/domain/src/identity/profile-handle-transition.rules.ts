import type {
  ProfileHandleActivePlan,
  ProfileHandleReleasePlan,
  ProfileHandleReservationTransitionKind,
  ProfileHandleReservedPlan,
  ProfileHandleRetiredPlan,
  ProfileHandleSnapshot,
  ProfileHandleTransitionDecision,
  ProfileHandleTransitionRejectionReason
} from "./profile-handle.types.js";
import {
  isAssignableReservedProfileHandle,
  isReservedProfileHandle
} from "./profile-handle-normalization.rules.js";

const strictProfileHandleTimestampPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})(Z|([+-])(\d{2}):(\d{2}))$/u;

type ProfileHandleTimestampComponents = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

const dateMatchesTimestampComponents = (
  date: Date,
  components: ProfileHandleTimestampComponents
): boolean => date.getUTCFullYear() === components.year
  && date.getUTCMonth() === components.month - 1
  && date.getUTCDate() === components.day
  && date.getUTCHours() === components.hour
  && date.getUTCMinutes() === components.minute
  && date.getUTCSeconds() === components.second
  && date.getUTCMilliseconds() === components.millisecond;

const parseStrictProfileHandleTimestamp = (timestamp: string): number | null => {
  const match = strictProfileHandleTimestampPattern.exec(timestamp);

  if (match === null) {
    return null;
  }

  const components: ProfileHandleTimestampComponents = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
    millisecond: Number(match[7])
  };
  const localDate = new Date(0);

  localDate.setUTCFullYear(components.year, components.month - 1, components.day);
  localDate.setUTCHours(
    components.hour,
    components.minute,
    components.second,
    components.millisecond
  );

  if (!dateMatchesTimestampComponents(localDate, components)) {
    return null;
  }

  let offsetMinutes = 0;

  if (match[8] !== "Z") {
    const offsetHour = Number(match[10]);
    const offsetMinute = Number(match[11]);

    if (offsetHour > 23 || offsetMinute > 59) {
      return null;
    }

    const offsetDirection = match[9] === "+" ? 1 : -1;
    offsetMinutes = offsetDirection * ((offsetHour * 60) + offsetMinute);
  }

  const instant = localDate.getTime() - (offsetMinutes * 60_000);
  const representedLocalDate = new Date(instant + (offsetMinutes * 60_000));

  return Number.isFinite(instant) && dateMatchesTimestampComponents(representedLocalDate, components)
    ? instant
    : null;
};

export const isRetiredProfileHandleReusable = (
  retiredHandle: Extract<ProfileHandleSnapshot, { state: "retired" }>,
  transitionAt: string
): boolean => {
  const reusableAfterInstant = parseStrictProfileHandleTimestamp(retiredHandle.reusableAfter);
  const transitionInstant = parseStrictProfileHandleTimestamp(transitionAt);

  return reusableAfterInstant !== null
    && transitionInstant !== null
    && reusableAfterInstant <= transitionInstant;
};

export const addOneYearProfileHandleReuseHold = (retiredAt: string): string => {
  const retiredDate = new Date(retiredAt);
  const originalMonth = retiredDate.getUTCMonth();
  const reusableAfter = new Date(retiredDate.getTime());

  reusableAfter.setUTCFullYear(reusableAfter.getUTCFullYear() + 1);

  if (reusableAfter.getUTCMonth() !== originalMonth) {
    reusableAfter.setUTCDate(0);
  }

  return reusableAfter.toISOString();
};

export const decideReservedProfileHandleActivation = ({
  handle,
  reviewedDataAction,
  targetAccountHasActiveHandle,
  transitionAt
}: {
  handle: ProfileHandleSnapshot;
  reviewedDataAction: boolean;
  targetAccountHasActiveHandle: boolean;
  transitionAt: string;
}): ProfileHandleTransitionDecision<ProfileHandleActivePlan> => {
  if (handle.state !== "reserved") {
    return { ok: false, reason: "handle_not_reserved" };
  }

  if (!isAssignableReservedProfileHandle(handle.handle)) {
    return { ok: false, reason: "reserved_handle_not_assignable" };
  }

  if (!reviewedDataAction) {
    return { ok: false, reason: "reviewed_data_action_required" };
  }

  if (targetAccountHasActiveHandle) {
    return { ok: false, reason: "target_account_already_has_active_handle" };
  }

  return {
    ok: true,
    plan: {
      state: "active",
      handle: handle.handle,
      assignedAt: transitionAt,
      transitionKind: "owner_assigned"
    }
  };
};

export const decideExpiredRetiredProfileHandleActivation = ({
  handle,
  targetAccountHasActiveHandle,
  transitionAt
}: {
  handle: ProfileHandleSnapshot;
  targetAccountHasActiveHandle: boolean;
  transitionAt: string;
}): ProfileHandleTransitionDecision<ProfileHandleActivePlan> => {
  if (handle.state !== "retired") {
    return { ok: false, reason: "handle_not_retired" };
  }

  if (!isRetiredProfileHandleReusable(handle, transitionAt)) {
    return { ok: false, reason: "retired_handle_not_reusable" };
  }

  if (targetAccountHasActiveHandle) {
    return { ok: false, reason: "target_account_already_has_active_handle" };
  }

  return {
    ok: true,
    plan: {
      state: "active",
      handle: handle.handle,
      assignedAt: transitionAt,
      transitionKind: "expired_reuse_assigned"
    }
  };
};

export const decideActiveProfileHandleRetirement = ({
  handle,
  reason,
  transitionAt
}: {
  handle: ProfileHandleSnapshot;
  reason: "renamed" | "deleted_user" | "admin_retired";
  transitionAt: string;
}): ProfileHandleTransitionDecision<ProfileHandleRetiredPlan> => {
  if (handle.state !== "active") {
    return { ok: false, reason: "handle_not_active" };
  }

  return {
    ok: true,
    plan: {
      state: "retired",
      handle: handle.handle,
      retiredAt: transitionAt,
      reusableAfter: addOneYearProfileHandleReuseHold(transitionAt),
      transitionKind: reason
    }
  };
};

const decideTargetHandleActivation = ({
  targetHandle,
  targetHandleSnapshot,
  reviewedDataActionForReservedTarget,
  transitionAt
}: {
  targetHandle: string;
  targetHandleSnapshot: ProfileHandleSnapshot | null;
  reviewedDataActionForReservedTarget: boolean;
  transitionAt: string;
}): ProfileHandleTransitionDecision<ProfileHandleActivePlan> => {
  if (isReservedProfileHandle(targetHandle)) {
    if (!isAssignableReservedProfileHandle(targetHandle)) {
      return { ok: false, reason: "reserved_target_not_assignable" };
    }

    if (!reviewedDataActionForReservedTarget) {
      return { ok: false, reason: "reserved_target_requires_review" };
    }

    if (targetHandleSnapshot === null) {
      return { ok: false, reason: "reserved_target_state_missing" };
    }
  }

  if (targetHandleSnapshot === null) {
    return {
      ok: true,
      plan: {
        state: "active",
        handle: targetHandle,
        assignedAt: transitionAt,
        transitionKind: "owner_assigned"
      }
    };
  }

  if (targetHandleSnapshot.state === "active") {
    return { ok: false, reason: "target_handle_active" };
  }

  if (targetHandleSnapshot.state === "reserved") {
    if (!isAssignableReservedProfileHandle(targetHandleSnapshot.handle)) {
      return { ok: false, reason: "reserved_target_not_assignable" };
    }

    if (!reviewedDataActionForReservedTarget) {
      return { ok: false, reason: "reserved_target_requires_review" };
    }

    return {
      ok: true,
      plan: {
        state: "active",
        handle: targetHandleSnapshot.handle,
        assignedAt: transitionAt,
        transitionKind: "owner_assigned"
      }
    };
  }

  if (!isRetiredProfileHandleReusable(targetHandleSnapshot, transitionAt)) {
    return { ok: false, reason: "target_handle_retired_not_reusable" };
  }

  return {
    ok: true,
    plan: {
      state: "active",
      handle: targetHandleSnapshot.handle,
      assignedAt: transitionAt,
      transitionKind: "expired_reuse_assigned"
    }
  };
};

export const decideActiveProfileHandleRename = ({
  currentHandle,
  targetHandle,
  targetHandleSnapshot,
  reviewedDataActionForReservedTarget,
  transitionAt
}: {
  currentHandle: ProfileHandleSnapshot;
  targetHandle: string;
  targetHandleSnapshot: ProfileHandleSnapshot | null;
  reviewedDataActionForReservedTarget: boolean;
  transitionAt: string;
}): ProfileHandleTransitionDecision<{
  retireCurrent: ProfileHandleRetiredPlan;
  activateTarget: ProfileHandleActivePlan;
}> => {
  if (currentHandle.state !== "active") {
    return { ok: false, reason: "handle_not_active" };
  }

  if (currentHandle.handle === targetHandle) {
    return { ok: false, reason: "same_handle" };
  }

  const targetActivation = decideTargetHandleActivation({
    targetHandle,
    targetHandleSnapshot,
    reviewedDataActionForReservedTarget,
    transitionAt
  });

  if (!targetActivation.ok) {
    return { ok: false, reason: targetActivation.reason };
  }

  const retirement = decideActiveProfileHandleRetirement({
    handle: currentHandle,
    reason: "renamed",
    transitionAt
  });

  if (!retirement.ok) {
    return { ok: false, reason: retirement.reason };
  }

  return {
    ok: true,
    plan: {
      retireCurrent: retirement.plan,
      activateTarget: targetActivation.plan
    }
  };
};

export const decideReservedProfileHandleRelease = ({
  handle,
  reviewedDataAction
}: {
  handle: ProfileHandleSnapshot;
  reviewedDataAction: boolean;
}): ProfileHandleTransitionDecision<ProfileHandleReleasePlan> => {
  if (handle.state !== "reserved") {
    return { ok: false, reason: "handle_not_reserved" };
  }

  if (!reviewedDataAction) {
    return { ok: false, reason: "reviewed_data_action_required" };
  }

  return {
    ok: true,
    plan: {
      kind: "release_reserved",
      handle: handle.handle
    }
  };
};

export const decideReservedProfileHandleChange = ({
  currentHandle,
  reviewedDataAction,
  targetHandle,
  targetHandleSnapshot,
  transitionAt,
  transitionKind
}: {
  currentHandle: ProfileHandleSnapshot;
  reviewedDataAction: boolean;
  targetHandle: string;
  targetHandleSnapshot: ProfileHandleSnapshot | null;
  transitionAt: string;
  transitionKind?: ProfileHandleReservationTransitionKind;
}): ProfileHandleTransitionDecision<{
  releaseCurrent: ProfileHandleReleasePlan;
  reserveTarget: ProfileHandleReservedPlan;
}> => {
  if (currentHandle.state !== "reserved") {
    return { ok: false, reason: "handle_not_reserved" };
  }

  if (!reviewedDataAction) {
    return { ok: false, reason: "reviewed_data_action_required" };
  }

  if (currentHandle.handle === targetHandle) {
    return { ok: false, reason: "same_handle" };
  }

  if (targetHandleSnapshot !== null) {
    const reasonByState: Record<ProfileHandleSnapshot["state"], ProfileHandleTransitionRejectionReason> = {
      active: "target_handle_active",
      reserved: "target_handle_reserved",
      retired: "target_handle_unavailable"
    };

    return { ok: false, reason: reasonByState[targetHandleSnapshot.state] };
  }

  return {
    ok: true,
    plan: {
      releaseCurrent: {
        kind: "release_reserved",
        handle: currentHandle.handle
      },
      reserveTarget: {
        state: "reserved",
        handle: targetHandle,
        reservedAt: transitionAt,
        transitionKind: transitionKind ?? currentHandle.transitionKind
      }
    }
  };
};
