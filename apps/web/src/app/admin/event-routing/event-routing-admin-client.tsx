"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  eventRoutingDestinations,
  eventRoutingNotificationPriorities,
  eventRoutingRuleSourcePlatforms,
  type EventKind,
  type EventRoutingDestination,
  type EventRoutingNotificationPriority,
  type EventRoutingRuleInput,
  type EventRoutingRuleSourcePlatform,
  type EventRoutingRuleValidationResult,
  type EventRoutingSafety,
  type EventSourcePlatform
} from "@maiks-yt/domain/events";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";

type EventRoutingAdminRuleListItem = EventRoutingRuleInput & {
  id: string | null;
  label: string;
  description: string;
  safety: EventRoutingSafety;
  validation: EventRoutingRuleValidationResult;
  persisted: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

type AdminEventRoutingResponse =
  | {
    ok: true;
    rules: readonly EventRoutingAdminRuleListItem[];
  }
  | {
    ok: false;
    reason: string;
  };

type AdminEventRoutingMutationResponse =
  | {
    ok: true;
    rule: EventRoutingAdminRuleListItem;
  }
  | {
    ok: false;
    reason: string;
    issues?: readonly string[];
  };

type EventRoutingAdminApprovalRecord = {
  id: string;
  eventHistoryId: string;
  destination: EventRoutingDestination;
  status: "pending" | "approved" | "rejected" | "expired" | "cancelled";
  reviewerUserId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  event: {
    sourcePlatform: EventSourcePlatform;
    eventKind: EventKind;
    actorDisplayName: string | null;
    redactedPayload: Record<string, unknown>;
    isTest: boolean;
    isSimulated: boolean;
    isRealMoney: boolean;
    testResettable: boolean;
    occurredAt: string;
    createdAt: string;
  };
  rule: {
    notificationPriority: EventRoutingNotificationPriority;
    sourcePlatform: EventRoutingRuleSourcePlatform | null;
  };
  label: string;
  description: string;
  safety: EventRoutingSafety;
  playback: {
    projected: {
      ok: boolean;
      reason?: string;
    };
    published: {
      emitted: boolean;
      reason?: string;
      activeOverlayConnections?: number;
    } | null;
  } | null;
};

type AdminEventRoutingApprovalListResponse =
  | {
    ok: true;
    approvals: readonly EventRoutingAdminApprovalRecord[];
  }
  | {
    ok: false;
    reason: string;
  };

type AdminEventRoutingApprovalReviewResponse =
  | {
    ok: true;
    approval: EventRoutingAdminApprovalRecord;
  }
  | {
    ok: false;
    reason: string;
    playback?: EventRoutingAdminApprovalRecord["playback"];
  };

type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const sourceLabels: Record<EventRoutingRuleSourcePlatform, string> = {
  any: "Any",
  twitch: "Twitch",
  youtube: "YouTube",
  discord: "Discord",
  website: "Website",
  "test/system": "Test/System"
};

const destinationLabels: Record<EventRoutingDestination, string> = {
  ignore: "Ignore",
  internal_audit: "Internal audit",
  control_panel: "Control panel",
  top_notification: "Top notification",
  center_notification: "Center notification",
  streamer_feed: "Streamer feed",
  streamer_chat: "Streamer chat",
  approval_queue: "Approval queue"
};

const priorityLabels: Record<EventRoutingNotificationPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent"
};

const formatDate = (value: string | null): string =>
  value
    ? new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value))
    : "Not saved";

const formatBoolean = (value: boolean): string => value ? "Yes" : "No";

const getRuleKey = (rule: Pick<EventRoutingRuleInput, "eventKind" | "sourcePlatform">): string =>
  `${rule.eventKind}:${rule.sourcePlatform}`;

const getApprovalDisplayText = (approval: EventRoutingAdminApprovalRecord): string => {
  const displayText = approval.event.redactedPayload.displayText;

  return typeof displayText === "string" && displayText.trim().length > 0
    ? displayText
    : approval.label;
};

const getFailureMessage = (response: Response, reason?: string, issues?: readonly string[]): string => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "Sign in before managing event routing rules.";
  }

  if (response.status === 403 || reason === "event_routing_admin_forbidden") {
    return "Your account does not have event routing admin permission.";
  }

  if (reason === "event_routing_admin_invalid_input") {
    return issues && issues.length > 0
      ? `Invalid routing rule: ${issues.join(", ")}.`
      : "The routing rule has invalid or missing fields.";
  }

  return `Event routing admin request failed with ${response.status}.`;
};

const getLoadStateForFailure = (response: Response, reason?: string): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

  if (response.status === 403 || reason === "event_routing_admin_forbidden" || reason === "event_routing_admin_user_unlinked") {
    return "forbidden";
  }

  return "failed";
};

const sortRules = (rules: readonly EventRoutingAdminRuleListItem[]): readonly EventRoutingAdminRuleListItem[] =>
  rules
    .slice()
    .sort((left, right) =>
      left.eventKind.localeCompare(right.eventKind)
      || left.sourcePlatform.localeCompare(right.sourcePlatform)
    );

const replaceRule = (
  rules: readonly EventRoutingAdminRuleListItem[],
  rule: EventRoutingAdminRuleListItem
): readonly EventRoutingAdminRuleListItem[] => {
  const key = getRuleKey(rule);
  const exists = rules.some((candidate) => getRuleKey(candidate) === key);
  const next = exists
    ? rules.map((candidate) => getRuleKey(candidate) === key ? rule : candidate)
    : [rule, ...rules];

  return sortRules(next);
};

const nullableText = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const nullableNumber = (value: string): number | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? Number(trimmed) : null;
};

const EventRoutingAdminClient = (): React.ReactNode => {
  const [rules, setRules] = useState<readonly EventRoutingAdminRuleListItem[]>([]);
  const [selectedRuleKey, setSelectedRuleKey] = useState<string>("");
  const [formRule, setFormRule] = useState<EventRoutingRuleInput | null>(null);
  const [approvals, setApprovals] = useState<readonly EventRoutingAdminApprovalRecord[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string>("Loading event routing rules...");
  const [busy, setBusy] = useState<boolean>(false);
  const [reviewingApprovalId, setReviewingApprovalId] = useState<string | null>(null);

  const selectedRule = useMemo(
    () => rules.find((rule) => getRuleKey(rule) === selectedRuleKey) ?? null,
    [rules, selectedRuleKey]
  );

  const persistedCount = useMemo(
    () => rules.filter((rule) => rule.persisted).length,
    [rules]
  );

  const parseJson = async <ResponseBody,>(response: Response): Promise<ResponseBody | null> => {
    try {
      return await response.json() as ResponseBody;
    } catch {
      return null;
    }
  };

  const loadRules = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    setMessage("Loading event routing rules...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/event-routing/rules`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<AdminEventRoutingResponse>(response);

      if (response.ok && payload?.ok) {
        const approvalsResponse = await fetch(`${apiBaseUrl}/admin/event-routing/approvals/pending`, {
          headers: createApiHeaders(),
          credentials: "include"
        });
        const approvalsPayload = await parseJson<AdminEventRoutingApprovalListResponse>(approvalsResponse);
        const orderedRules = sortRules(payload.rules);
        const firstKey = getRuleKey(orderedRules[0] ?? {
          eventKind: "chat" as EventKind,
          sourcePlatform: "any"
        });
        setRules(orderedRules);
        setApprovals(approvalsResponse.ok && approvalsPayload?.ok ? approvalsPayload.approvals : []);
        setSelectedRuleKey((current) => current || firstKey);
        setFormRule(orderedRules[0] ?? null);
        setLoadState("ready");
        setMessage(approvalsResponse.ok && approvalsPayload?.ok
          ? "Event routing rules loaded."
          : "Event routing rules loaded. Approval queue could not be loaded.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState(getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Event routing admin request failed.");
    }
  }, []);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadRules();
  }, [loadRules]);

  useEffect(() => {
    if (selectedRule) {
      setFormRule({
        eventKind: selectedRule.eventKind,
        sourcePlatform: selectedRule.sourcePlatform,
        destination: selectedRule.destination,
        enabled: selectedRule.enabled,
        liveOnly: selectedRule.liveOnly,
        offlineOnly: selectedRule.offlineOnly,
        approvalRequired: selectedRule.approvalRequired,
        perUserCooldownSeconds: selectedRule.perUserCooldownSeconds,
        globalCooldownSeconds: selectedRule.globalCooldownSeconds,
        oncePerStream: selectedRule.oncePerStream,
        templateKey: selectedRule.templateKey,
        themeKey: selectedRule.themeKey,
        soundKey: selectedRule.soundKey,
        notificationPriority: selectedRule.notificationPriority
      });
    }
  }, [selectedRule]);

  const updateFormRule = <Key extends keyof EventRoutingRuleInput>(
    key: Key,
    value: EventRoutingRuleInput[Key]
  ): void => {
    setFormRule((current) => current ? {
      ...current,
      [key]: value
    } : current);
  };

  const saveRule = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!formRule) {
      return;
    }

    setBusy(true);
    setMessage("Saving event routing rule...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/event-routing/rules`, {
        method: "PUT",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        credentials: "include",
        body: JSON.stringify(formRule)
      });
      const payload = await parseJson<AdminEventRoutingMutationResponse>(response);

      if (response.ok && payload?.ok) {
        setRules((current) => replaceRule(current, payload.rule));
        setSelectedRuleKey(getRuleKey(payload.rule));
        setLoadState("ready");
        setMessage("Event routing rule saved.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      const issues = payload?.ok === false ? payload.issues : undefined;
      setLoadState((current) => current === "ready" ? current : getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason, issues));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Saving event routing rule failed.");
    } finally {
      setBusy(false);
    }
  };

  const reviewApproval = async (
    approvalId: string,
    action: "approve" | "reject"
  ): Promise<void> => {
    setReviewingApprovalId(approvalId);
    setMessage(action === "approve" ? "Approving queued event..." : "Rejecting queued event...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/event-routing/approvals/${encodeURIComponent(approvalId)}/review`, {
        method: "POST",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        credentials: "include",
        body: JSON.stringify({
          action
        })
      });
      const payload = await parseJson<AdminEventRoutingApprovalReviewResponse>(response);

      if (response.ok && payload?.ok) {
        setApprovals((current) => current.filter((approval) => approval.id !== approvalId));
        const playback = payload.approval.playback?.published;
        setMessage(playback?.emitted
          ? `Queued ${destinationLabels[payload.approval.destination]} playback.`
          : `Marked event ${payload.approval.status}.`);
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setMessage(reason === "event_routing_admin_approval_playback_blocked"
        ? "Queued event was rejected by playback safety checks."
        : getFailureMessage(response, reason));
      setApprovals((current) => current.filter((approval) => approval.id !== approvalId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reviewing queued event failed.");
    } finally {
      setReviewingApprovalId(null);
    }
  };

  return (
    <>
      <header className="project-admin-header">
        <p className="eyebrow">Owner admin</p>
        <h1>Event Routing</h1>
        <p>{persistedCount} saved rule{persistedCount === 1 ? "" : "s"}.</p>
      </header>

      <section className={`project-admin-state ${loadState}`}>
        <h2>{loadState === "ready" ? "Ready" : loadState === "loading" ? "Loading" : "Needs attention"}</h2>
        <p>{message}</p>
      </section>

      {loadState === "ready" && selectedRule && formRule ? (
        <div className="project-admin-layout">
          <aside className="project-admin-sidebar" aria-label="Event routing rules">
            <div className="project-admin-sidebar-heading">
              <h2>Rules</h2>
              <button type="button" onClick={() => void loadRules()} disabled={busy}>Refresh</button>
            </div>
            <div className="project-admin-selector">
              {rules.map((rule) => (
                <button
                  key={getRuleKey(rule)}
                  type="button"
                  className={getRuleKey(rule) === selectedRuleKey ? "selected" : ""}
                  onClick={() => setSelectedRuleKey(getRuleKey(rule))}
                >
                  <strong>{rule.label}</strong>
                  <span>{sourceLabels[rule.sourcePlatform]} · {destinationLabels[rule.destination]}</span>
                  <span>{rule.enabled ? "Enabled" : "Disabled"} · {rule.persisted ? "Saved" : "Default"}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="project-admin-workspace" aria-label="Event routing rule editor">
            <section className="project-admin-panel">
              <div className="project-admin-panel-heading">
                <div>
                  <h2>Pending Review</h2>
                  <p>{approvals.length} queued item{approvals.length === 1 ? "" : "s"}.</p>
                </div>
                <button type="button" onClick={() => void loadRules()} disabled={busy || reviewingApprovalId !== null}>Refresh</button>
              </div>
              {approvals.length > 0 ? (
                <ul className="project-admin-record-list">
                  {approvals.map((approval) => (
                    <li key={approval.id}>
                      <div>
                        <strong>{approval.label}</strong>
                        <span>{sourceLabels[approval.event.sourcePlatform]} · {destinationLabels[approval.destination]} · {formatDate(approval.createdAt)}</span>
                        <span>{getApprovalDisplayText(approval)}</span>
                      </div>
                      <div className="project-admin-actions">
                        <button
                          type="button"
                          onClick={() => void reviewApproval(approval.id, "approve")}
                          disabled={reviewingApprovalId !== null}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => void reviewApproval(approval.id, "reject")}
                          disabled={reviewingApprovalId !== null}
                        >
                          Reject
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="project-admin-note">No pending simulated events.</p>
              )}
            </section>

            <form className="project-admin-panel project-admin-form" onSubmit={(event) => void saveRule(event)}>
              <div className="project-admin-panel-heading">
                <div>
                  <h2>{selectedRule.label}</h2>
                  <p>{selectedRule.description}</p>
                </div>
                <button type="submit" disabled={busy}>{busy ? "Saving..." : "Save rule"}</button>
              </div>

              <div className="project-admin-form-grid">
                <label>
                  Source
                  <select
                    value={formRule.sourcePlatform}
                    onChange={(event) => updateFormRule("sourcePlatform", event.target.value as EventRoutingRuleSourcePlatform)}
                  >
                    {eventRoutingRuleSourcePlatforms.map((sourcePlatform) => (
                      <option key={sourcePlatform} value={sourcePlatform}>{sourceLabels[sourcePlatform]}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Destination
                  <select
                    value={formRule.destination}
                    onChange={(event) => updateFormRule("destination", event.target.value as EventRoutingDestination)}
                  >
                    {eventRoutingDestinations.map((destination) => (
                      <option key={destination} value={destination}>{destinationLabels[destination]}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Priority
                  <select
                    value={formRule.notificationPriority}
                    onChange={(event) => updateFormRule("notificationPriority", event.target.value as EventRoutingNotificationPriority)}
                  >
                    {eventRoutingNotificationPriorities.map((priority) => (
                      <option key={priority} value={priority}>{priorityLabels[priority]}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Per-user cooldown
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={formRule.perUserCooldownSeconds ?? ""}
                    onChange={(event) => updateFormRule("perUserCooldownSeconds", nullableNumber(event.target.value))}
                  />
                </label>

                <label>
                  Global cooldown
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={formRule.globalCooldownSeconds ?? ""}
                    onChange={(event) => updateFormRule("globalCooldownSeconds", nullableNumber(event.target.value))}
                  />
                </label>

                <label>
                  Template
                  <input
                    value={formRule.templateKey ?? ""}
                    maxLength={80}
                    onChange={(event) => updateFormRule("templateKey", nullableText(event.target.value))}
                  />
                </label>

                <label>
                  Theme
                  <input
                    value={formRule.themeKey ?? ""}
                    maxLength={80}
                    onChange={(event) => updateFormRule("themeKey", nullableText(event.target.value))}
                  />
                </label>

                <label>
                  Sound
                  <input
                    value={formRule.soundKey ?? ""}
                    maxLength={80}
                    onChange={(event) => updateFormRule("soundKey", nullableText(event.target.value))}
                  />
                </label>
              </div>

              <label className="project-admin-checkbox">
                <input
                  type="checkbox"
                  checked={formRule.enabled}
                  onChange={(event) => updateFormRule("enabled", event.target.checked)}
                />
                Enabled
              </label>
              <label className="project-admin-checkbox">
                <input
                  type="checkbox"
                  checked={formRule.approvalRequired}
                  onChange={(event) => updateFormRule("approvalRequired", event.target.checked)}
                />
                Approval required
              </label>
              <label className="project-admin-checkbox">
                <input
                  type="checkbox"
                  checked={formRule.liveOnly}
                  onChange={(event) => updateFormRule("liveOnly", event.target.checked)}
                />
                Live only
              </label>
              <label className="project-admin-checkbox">
                <input
                  type="checkbox"
                  checked={formRule.offlineOnly}
                  onChange={(event) => updateFormRule("offlineOnly", event.target.checked)}
                />
                Offline only
              </label>
              <label className="project-admin-checkbox">
                <input
                  type="checkbox"
                  checked={formRule.oncePerStream}
                  onChange={(event) => updateFormRule("oncePerStream", event.target.checked)}
                />
                Once per stream
              </label>
            </form>

            <section className="project-admin-panel">
              <div className="project-admin-panel-heading">
                <h2>Safety</h2>
                <p>{selectedRule.validation.ok ? "Valid" : "Blocked"}</p>
              </div>
              <ul className="project-admin-record-list">
                <li>
                  <div>
                    <strong>Opt-out check</strong>
                    <span>{formatBoolean(selectedRule.validation.requiresUserOptOutCheck)}</span>
                  </div>
                </li>
                <li>
                  <div>
                    <strong>Cooldown check</strong>
                    <span>{formatBoolean(selectedRule.validation.requiresCooldownCheck)}</span>
                  </div>
                </li>
                <li>
                  <div>
                    <strong>Approval default</strong>
                    <span>{formatBoolean(selectedRule.validation.requiresApprovalByDefault)}</span>
                  </div>
                </li>
                <li>
                  <div>
                    <strong>Last saved</strong>
                    <span>{formatDate(selectedRule.updatedAt)}</span>
                  </div>
                </li>
              </ul>
              {selectedRule.validation.issues.length > 0 ? (
                <p className="project-admin-note">{selectedRule.validation.issues.join(", ")}</p>
              ) : null}
            </section>

            <section className="project-admin-panel project-admin-note">
              <h2>Gates</h2>
              <p>Real provider intake, real money, moderation enforcement, production dispatch, and user settings UX remain separate review gates.</p>
            </section>
          </section>
        </div>
      ) : null}
    </>
  );
};

export default EventRoutingAdminClient;
