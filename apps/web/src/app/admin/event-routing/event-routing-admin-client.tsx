"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  eventRoutingDestinations,
  eventRoutingNotificationPriorities,
  eventRoutingRuleSourcePlatforms,
  getEventRoutingDestinationCapability,
  getEventRegistryEntry,
  validateEventRoutingRule,
  type EventKind,
  type EventRoutingDestination,
  type EventRoutingNotificationPriority,
  type EventRoutingRuleInput,
  type EventRoutingRuleSourcePlatform,
  type EventRoutingRuleValidationResult,
  type EventRoutingSafety,
  type EventSourcePlatform
} from "@maiks-yt/domain/events";
import {
  FiAlertTriangle, FiCheck, FiChevronDown, FiChevronLeft, FiChevronRight,
  FiClock, FiGlobe, FiLock, FiMessageCircle, FiPlus, FiRefreshCw, FiSearch, FiShield, FiTrash2
} from "react-icons/fi";
import { SiDiscord, SiTwitch, SiYoutube } from "react-icons/si";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";
import styles from "./event-routing-admin.module.css";

type Rule = EventRoutingRuleInput & {
  id: string | null;
  label: string;
  description: string;
  safety: EventRoutingSafety;
  validation: EventRoutingRuleValidationResult;
  persisted: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

type RulesResponse = { ok: true; rules: readonly Rule[] } | { ok: false; reason: string };
type MutationResponse = { ok: true; rule: Rule } | { ok: false; reason: string; issues?: readonly string[] };

type ProductionSourcePlatform = Exclude<EventRoutingRuleSourcePlatform, "test/system">;
type ApprovalContext = {
  displayText: string | null;
  displayName: string | null;
  title: string | null;
  projectLabel: string | null;
  amount: number | string | null;
  currency: string | null;
};

type Approval = {
  id: string;
  productionEvent: boolean;
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
    occurredAt: string;
    context: ApprovalContext;
  };
  rule: { notificationPriority: EventRoutingNotificationPriority; sourcePlatform: EventRoutingRuleSourcePlatform | null };
  label: string;
  description: string;
  safety: EventRoutingSafety;
  playback: {
    projected: { ok: boolean; reason?: string };
    published: { emitted: boolean; reason?: string; activeOverlayConnections?: number } | null;
  } | null;
};

type ApprovalsResponse = { ok: true; approvals: readonly Approval[] } | { ok: false; reason: string };
type ReviewResponse = { ok: true; approval: Approval } | { ok: false; reason: string; playback?: Approval["playback"] };
type RuleResetResponse = { ok: true; removed: boolean; fallback: Rule } | { ok: false; reason: string };
type CooldownSummary = { activeCount: number; nearestExpiry: string | null; rulePersisted: boolean };
type CooldownResponse = { ok: true; summary: CooldownSummary } | { ok: false; reason: string };
type RoutingHistoryItem = {
  eventKind: EventKind;
  sourcePlatform: EventSourcePlatform;
  label: string;
  destination: EventRoutingDestination | null;
  routingOutcome: string;
  occurredAt: string;
  context: ApprovalContext;
};
type HistoryResponse = { ok: true; history: readonly RoutingHistoryItem[] } | { ok: false; reason: string };
type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";
type StateFilter = "all" | "enabled" | "disabled" | "saved" | "default";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";
const pageSize = 7;
const preferredEventOrder: readonly EventKind[] = [
  "chat",
  "website.signup",
  "twitch.sub",
  "website.account-security-change",
  "website.free-tts-request",
  "website.provider-token-change",
  "youtube.super-chat"
];
const preferredEventRank = new Map(preferredEventOrder.map((eventKind, index) => [eventKind, index]));

const sourceLabels: Record<EventRoutingRuleSourcePlatform, string> = {
  any: "Any", twitch: "Twitch", youtube: "YouTube", discord: "Discord", website: "Website", "test/system": "Test/System"
};
const productionSourcePlatforms = eventRoutingRuleSourcePlatforms.filter(
  (source): source is ProductionSourcePlatform => source !== "test/system"
);
const destinationLabels: Record<EventRoutingDestination, string> = {
  ignore: "Ignore", internal_audit: "Internal audit", control_panel: "Control panel",
  top_notification: "Top notification", center_notification: "Center notification",
  streamer_feed: "Streamer feed", streamer_chat: "Streamer chat", approval_queue: "Approval queue"
};
const priorityLabels: Record<EventRoutingNotificationPriority, string> = {
  low: "Low", normal: "Normal", high: "High", urgent: "Urgent"
};
const issueLabels: Record<EventRoutingRuleValidationResult["issues"][number], string> = {
  event_routing_invalid_source: "Choose a valid source.",
  event_routing_invalid_destination: "Choose a valid destination.",
  event_routing_invalid_priority: "Choose a valid priority.",
  event_routing_source_cannot_emit_event: "This source cannot emit this event kind.",
  event_routing_live_offline_conflict: "A rule cannot be both live-only and offline-only.",
  event_routing_negative_per_user_cooldown: "Per-user cooldown cannot be negative.",
  event_routing_negative_global_cooldown: "Global cooldown cannot be negative.",
  event_routing_enabled_destination_unavailable: "This destination has no runtime consumer and cannot be enabled.",
  event_routing_unsupported_priority: "This destination does not consume notification priority.",
  event_routing_unsupported_template: "This destination does not consume a template.",
  event_routing_unsupported_theme: "This destination does not consume a theme.",
  event_routing_unsupported_sound: "This destination does not consume sound.",
  event_routing_internal_only_public_destination: "Internal-only events cannot use a public destination.",
  event_routing_overlay_ineligible_public_destination: "This event cannot use a public destination.",
  event_routing_internal_only_enabled_public_destination: "An internal-only event cannot enable a public destination."
};

const formatDate = (value: string | null): string => value
  ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : "Not saved";
const getRuleKey = (rule: Pick<EventRoutingRuleInput, "eventKind" | "sourcePlatform">): string => `${rule.eventKind}:${rule.sourcePlatform}`;
const toFormRule = (rule: EventRoutingRuleInput): EventRoutingRuleInput => ({
  eventKind: rule.eventKind, sourcePlatform: rule.sourcePlatform, destination: rule.destination,
  enabled: rule.enabled, liveOnly: rule.liveOnly, offlineOnly: rule.offlineOnly,
  approvalRequired: rule.approvalRequired, perUserCooldownSeconds: rule.perUserCooldownSeconds,
  globalCooldownSeconds: rule.globalCooldownSeconds, oncePerStream: rule.oncePerStream,
  templateKey: rule.templateKey, themeKey: rule.themeKey, soundKey: rule.soundKey,
  notificationPriority: rule.notificationPriority
});
const sortRules = (rules: readonly Rule[]): readonly Rule[] => rules.slice().sort((a, b) => {
  const aRank = preferredEventRank.get(a.eventKind) ?? Number.MAX_SAFE_INTEGER;
  const bRank = preferredEventRank.get(b.eventKind) ?? Number.MAX_SAFE_INTEGER;
  return aRank - bRank || a.eventKind.localeCompare(b.eventKind) || a.sourcePlatform.localeCompare(b.sourcePlatform);
});
const replaceRule = (rules: readonly Rule[], rule: Rule): readonly Rule[] => sortRules(rules.some((item) => getRuleKey(item) === getRuleKey(rule))
  ? rules.map((item) => getRuleKey(item) === getRuleKey(rule) ? rule : item)
  : [rule, ...rules]);
const nullableText = (value: string): string | null => value.trim() || null;
const nullableNumber = (value: string): number | null => value.trim() ? Number(value) : null;
const getWhenLabel = (rule: EventRoutingRuleInput): string => rule.liveOnly ? "Live only" : rule.offlineOnly ? "Offline only" : "Any time";
const getSafeguardLabel = (rule: Rule): string => rule.safety.internalOnly ? "Internal only" : rule.approvalRequired ? "Approval" : rule.validation.requiresUserOptOutCheck ? "Opt-out" : "Default safety";
const getCooldownLabel = (rule: EventRoutingRuleInput): string => {
  const values: string[] = [];
  if (rule.perUserCooldownSeconds !== null) values.push(`${rule.perUserCooldownSeconds}s user`);
  if (rule.globalCooldownSeconds !== null) values.push(`${rule.globalCooldownSeconds}s global`);
  if (rule.oncePerStream) values.push("Once / stream");
  return values.join(" · ") || "—";
};
const getApprovalText = (approval: Approval): string => approval.event.context.displayText
  ?? approval.event.context.title
  ?? approval.event.context.projectLabel
  ?? approval.label;
const getContextDetails = (context: ApprovalContext): string => [
  context.displayName,
  context.amount === null ? null : `${context.amount}${context.currency ? ` ${context.currency}` : ""}`
].filter((value): value is string => Boolean(value)).join(" · ");
const getFailureMessage = (response: Response, reason?: string, issues?: readonly string[]): string => {
  if (response.status === 401 || reason === "not_authenticated") return "Sign in before managing event routing rules.";
  if (response.status === 403 || reason === "event_routing_admin_forbidden") return "Your account does not have event routing admin permission.";
  if (reason === "event_routing_admin_invalid_input") return issues?.length ? `Invalid routing rule: ${issues.join(", ")}.` : "The routing rule has invalid or missing fields.";
  return `Event routing admin request failed with ${response.status}.`;
};
const getLoadState = (response: Response, reason?: string): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") return "signed-out";
  if (response.status === 403 || reason === "event_routing_admin_forbidden" || reason === "event_routing_admin_user_unlinked") return "forbidden";
  return "failed";
};

const RuleIcon = ({ rule }: { rule: Rule }): React.ReactNode => {
  if (rule.sourcePlatform === "twitch" || rule.eventKind.startsWith("twitch.")) return <SiTwitch aria-hidden="true" />;
  if (rule.sourcePlatform === "youtube" || rule.eventKind.startsWith("youtube.")) return <SiYoutube aria-hidden="true" />;
  if (rule.sourcePlatform === "discord" || rule.eventKind.startsWith("discord.")) return <SiDiscord aria-hidden="true" />;
  if (rule.eventKind === "chat") return <FiMessageCircle aria-hidden="true" />;
  if (rule.safety.internalOnly) return <FiLock aria-hidden="true" />;
  return <FiGlobe aria-hidden="true" />;
};

const EventRoutingAdminClient = (): React.ReactNode => {
  const [rules, setRules] = useState<readonly Rule[]>([]);
  const [selectedRuleKey, setSelectedRuleKey] = useState("");
  const [formRule, setFormRule] = useState<EventRoutingRuleInput | null>(null);
  const [approvals, setApprovals] = useState<readonly Approval[]>([]);
  const [history, setHistory] = useState<readonly RoutingHistoryItem[]>([]);
  const [cooldownSummary, setCooldownSummary] = useState<CooldownSummary | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});
  const [overrideSource, setOverrideSource] = useState<ProductionSourcePlatform | "">("");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("Loading event routing rules...");
  const [busy, setBusy] = useState(false);
  const [reviewingApprovalId, setReviewingApprovalId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<EventRoutingRuleSourcePlatform | "all">("all");
  const [destinationFilter, setDestinationFilter] = useState<EventRoutingDestination | "all">("all");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [page, setPage] = useState(0);

  const selectedRule = useMemo(() => rules.find((rule) => getRuleKey(rule) === selectedRuleKey) ?? null, [rules, selectedRuleKey]);
  const productionRules = useMemo(() => rules.filter((rule) =>
    rule.sourcePlatform !== "test/system" && !rule.safety.simulatedOnly
  ), [rules]);
  const persistedCount = useMemo(() => productionRules.filter((rule) => rule.persisted).length, [productionRules]);
  const enabledCount = useMemo(() => productionRules.filter((rule) => rule.enabled).length, [productionRules]);
  const validation = useMemo(() => formRule ? validateEventRoutingRule(formRule) : null, [formRule]);
  const isDirty = useMemo(() => Boolean(selectedRule && formRule && JSON.stringify(toFormRule(selectedRule)) !== JSON.stringify(formRule)), [formRule, selectedRule]);

  const filteredRules = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return productionRules.filter((rule) => {
      const matchesQuery = !needle || rule.label.toLocaleLowerCase().includes(needle) || rule.eventKind.toLocaleLowerCase().includes(needle);
      const matchesSource = sourceFilter === "all" || rule.sourcePlatform === sourceFilter;
      const matchesDestination = destinationFilter === "all" || rule.destination === destinationFilter;
      const matchesState = stateFilter === "all"
        || (stateFilter === "enabled" && rule.enabled) || (stateFilter === "disabled" && !rule.enabled)
        || (stateFilter === "saved" && rule.persisted) || (stateFilter === "default" && !rule.persisted);
      return matchesQuery && matchesSource && matchesDestination && matchesState;
    });
  }, [destinationFilter, productionRules, query, sourceFilter, stateFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredRules.length / pageSize));
  const visibleRules = filteredRules.slice(page * pageSize, (page + 1) * pageSize);
  const selectedIndex = filteredRules.findIndex((rule) => getRuleKey(rule) === selectedRuleKey);
  const selectedCapabilities = getEventRoutingDestinationCapability(formRule?.destination ?? selectedRule?.destination ?? "ignore");
  const validOverrideSources = useMemo(() => selectedRule
    ? getEventRegistryEntry(selectedRule.eventKind).sourcePlatforms.filter(
      (source): source is Exclude<ProductionSourcePlatform, "any"> => source !== "test/system"
    )
    : [], [selectedRule]);

  const parseJson = async <T,>(response: Response): Promise<T | null> => {
    try { return await response.json() as T; } catch { return null; }
  };

  const loadRules = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    setMessage("Loading event routing rules...");
    try {
      const response = await fetch(`${apiBaseUrl}/admin/event-routing/rules`, { headers: createApiHeaders(), credentials: "include" });
      const payload = await parseJson<RulesResponse>(response);
      if (response.ok && payload?.ok) {
        const [approvalResponse, historyResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/admin/event-routing/approvals/pending`, { headers: createApiHeaders(), credentials: "include" }),
          fetch(`${apiBaseUrl}/admin/event-routing/history?limit=50`, { headers: createApiHeaders(), credentials: "include" })
        ]);
        const [approvalPayload, historyPayload] = await Promise.all([
          parseJson<ApprovalsResponse>(approvalResponse),
          parseJson<HistoryResponse>(historyResponse)
        ]);
        const ordered = sortRules(payload.rules);
        setRules(ordered);
        setApprovals(approvalResponse.ok && approvalPayload?.ok
          ? approvalPayload.approvals.filter((approval) => approval.productionEvent)
          : []);
        setHistory(historyResponse.ok && historyPayload?.ok ? historyPayload.history : []);
        const preferredRule = ordered.find((rule) => rule.eventKind === "website.signup" && rule.sourcePlatform === "any");
        setSelectedRuleKey((current) => ordered.some((rule) => getRuleKey(rule) === current)
          ? current
          : preferredRule ? getRuleKey(preferredRule) : ordered[0] ? getRuleKey(ordered[0]) : "");
        setLoadState("ready");
        setMessage(approvalResponse.ok && approvalPayload?.ok && historyResponse.ok && historyPayload?.ok
          ? "Event routing rules loaded."
          : "Rules loaded, but some operational data is unavailable.");
        return;
      }
      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState(getLoadState(response, reason));
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Event routing admin request failed.");
    }
  }, []);

  useEffect(() => { captureDevAuthTokenFromUrl(); void loadRules(); }, [loadRules]);
  useEffect(() => { if (selectedRule) setFormRule(toFormRule(selectedRule)); }, [selectedRule]);
  useEffect(() => {
    if (!selectedRule) {
      setCooldownSummary(null);
      return;
    }

    const controller = new AbortController();
    const loadCooldownSummary = async (): Promise<void> => {
      const queryParameters = new URLSearchParams({
        eventKind: selectedRule.eventKind,
        sourcePlatform: selectedRule.sourcePlatform
      });
      try {
        const response = await fetch(`${apiBaseUrl}/admin/event-routing/cooldowns/summary?${queryParameters}`, {
          headers: createApiHeaders(), credentials: "include", signal: controller.signal
        });
        const payload = await parseJson<CooldownResponse>(response);
        setCooldownSummary(response.ok && payload?.ok ? payload.summary : null);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setCooldownSummary(null);
      }
    };
    void loadCooldownSummary();
    return () => controller.abort();
  }, [selectedRule]);
  useEffect(() => { setPage(0); }, [destinationFilter, query, sourceFilter, stateFilter]);
  useEffect(() => { if (page >= pageCount) setPage(pageCount - 1); }, [page, pageCount]);

  const selectRule = useCallback((key: string): void => {
    if (key === selectedRuleKey) return;
    if (isDirty && !window.confirm("Discard unsaved changes and open another rule?")) return;
    setSelectedRuleKey(key);
  }, [isDirty, selectedRuleKey]);

  const moveSelection = useCallback((offset: -1 | 1): void => {
    if (isDirty || !filteredRules.length) return;
    const current = selectedIndex >= 0 ? selectedIndex : 0;
    const nextIndex = Math.min(filteredRules.length - 1, Math.max(0, current + offset));
    const next = filteredRules[nextIndex];
    if (!next) return;
    setSelectedRuleKey(getRuleKey(next));
    setPage(Math.floor(nextIndex / pageSize));
  }, [filteredRules, isDirty, selectedIndex]);

  const updateForm = <K extends keyof EventRoutingRuleInput>(key: K, value: EventRoutingRuleInput[K]): void => {
    setFormRule((current) => current ? { ...current, [key]: value } : current);
  };

  const updateDestination = (destination: EventRoutingDestination): void => {
    const capabilities = getEventRoutingDestinationCapability(destination);
    setFormRule((current) => current ? {
      ...current,
      destination,
      notificationPriority: capabilities.supportsPriority ? current.notificationPriority : "normal",
      templateKey: capabilities.supportsTemplate ? current.templateKey : null,
      themeKey: capabilities.supportsTheme ? current.themeKey : null,
      soundKey: capabilities.supportsSound ? current.soundKey : null
    } : current);
  };

  const saveRule = useCallback(async (advance = false): Promise<boolean> => {
    if (!formRule || !validation?.ok || !isDirty) return false;
    const currentIndex = filteredRules.findIndex((rule) => getRuleKey(rule) === selectedRuleKey);
    const nextRule = currentIndex >= 0 ? filteredRules[currentIndex + 1] : undefined;
    setBusy(true);
    setMessage("Saving event routing rule...");
    try {
      const response = await fetch(`${apiBaseUrl}/admin/event-routing/rules`, {
        method: "PUT", headers: createApiHeaders({ "Content-Type": "application/json" }), credentials: "include", body: JSON.stringify(formRule)
      });
      const payload = await parseJson<MutationResponse>(response);
      if (response.ok && payload?.ok) {
        setRules((current) => replaceRule(current, payload.rule));
        if (advance && nextRule) {
          setSelectedRuleKey(getRuleKey(nextRule));
          setPage(Math.floor((currentIndex + 1) / pageSize));
          setMessage(`Saved ${payload.rule.label}. Opened the next rule.`);
        } else {
          setSelectedRuleKey(getRuleKey(payload.rule));
          setFormRule(toFormRule(payload.rule));
          setMessage("Event routing rule saved.");
        }
        return true;
      }
      const reason = payload?.ok === false ? payload.reason : undefined;
      setMessage(getFailureMessage(response, reason, payload?.ok === false ? payload.issues : undefined));
      return false;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Saving event routing rule failed.");
      return false;
    } finally { setBusy(false); }
  }, [filteredRules, formRule, isDirty, selectedRuleKey, validation?.ok]);

  const addOverride = async (): Promise<void> => {
    if (!selectedRule || selectedRule.sourcePlatform !== "any" || !overrideSource) return;
    const existing = rules.find((rule) => rule.eventKind === selectedRule.eventKind && rule.sourcePlatform === overrideSource);
    if (existing) {
      setSelectedRuleKey(getRuleKey(existing));
      setOverrideSource("");
      return;
    }
    const rule = { ...toFormRule(selectedRule), sourcePlatform: overrideSource };
    setBusy(true);
    setMessage(`Adding ${sourceLabels[overrideSource]} override...`);
    try {
      const response = await fetch(`${apiBaseUrl}/admin/event-routing/rules`, {
        method: "PUT", headers: createApiHeaders({ "Content-Type": "application/json" }), credentials: "include", body: JSON.stringify(rule)
      });
      const payload = await parseJson<MutationResponse>(response);
      if (response.ok && payload?.ok) {
        setRules((current) => replaceRule(current, payload.rule));
        setSelectedRuleKey(getRuleKey(payload.rule));
        setOverrideSource("");
        setMessage(`${sourceLabels[payload.rule.sourcePlatform]} override added.`);
      } else {
        setMessage(getFailureMessage(response, payload?.ok === false ? payload.reason : undefined));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Adding the provider override failed.");
    } finally { setBusy(false); }
  };

  const resetRule = async (): Promise<void> => {
    if (!selectedRule || !selectedRule.persisted || isDirty) return;
    const currentRule = selectedRule;
    const fallbackDescription = currentRule.sourcePlatform === "any"
      ? "the generated default for this event kind"
      : `the ${sourceLabels.any} fallback rule`;
    if (!window.confirm(`Remove this saved rule? Routing will fall back to ${fallbackDescription}. History and cooldown records are kept.`)) return;
    setBusy(true);
    setMessage("Removing saved routing rule...");
    try {
      const response = await fetch(
        `${apiBaseUrl}/admin/event-routing/rules/${encodeURIComponent(currentRule.eventKind)}/${encodeURIComponent(currentRule.sourcePlatform)}`,
        { method: "DELETE", headers: createApiHeaders(), credentials: "include" }
      );
      const payload = await parseJson<RuleResetResponse>(response);
      if (response.ok && payload?.ok) {
        if (currentRule.sourcePlatform === "any") {
          setRules((current) => replaceRule(current, payload.fallback));
          setSelectedRuleKey(getRuleKey(payload.fallback));
        } else {
          setRules((current) => current.filter((rule) => getRuleKey(rule) !== getRuleKey(currentRule)));
          setSelectedRuleKey(getRuleKey(payload.fallback));
        }
        setMessage(`Saved rule removed. Now using ${sourceLabels[payload.fallback.sourcePlatform]} fallback.`);
      } else {
        setMessage(getFailureMessage(response, payload?.ok === false ? payload.reason : undefined));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Removing the routing rule failed.");
    } finally { setBusy(false); }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target;
      const editing = target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void saveRule(false); return; }
      if (editing || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); moveSelection(event.key === "ArrowUp" ? -1 : 1); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveSelection, saveRule]);

  const reviewApproval = async (id: string, action: "approve" | "reject"): Promise<void> => {
    setReviewingApprovalId(id);
    setMessage(action === "approve" ? "Approving queued event..." : "Rejecting queued event...");
    try {
      const response = await fetch(`${apiBaseUrl}/admin/event-routing/approvals/${encodeURIComponent(id)}/review`, {
        method: "POST", headers: createApiHeaders({ "Content-Type": "application/json" }), credentials: "include",
        body: JSON.stringify({ action, reviewNote: approvalNotes[id]?.trim() || null })
      });
      const payload = await parseJson<ReviewResponse>(response);
      if (response.ok && payload?.ok) {
        setApprovals((current) => current.filter((approval) => approval.id !== id));
        setApprovalNotes((current) => { const next = { ...current }; delete next[id]; return next; });
        setMessage(payload.approval.playback?.published?.emitted ? `Queued ${destinationLabels[payload.approval.destination]} playback.` : `Marked event ${payload.approval.status}.`);
        return;
      }
      const reason = payload?.ok === false ? payload.reason : undefined;
      if (reason === "event_routing_admin_production_execution_unavailable") {
        setMessage("Approval playback is available after real provider events execute routing rules. The event remains pending.");
      } else {
        setMessage(getFailureMessage(response, reason));
        setApprovals((current) => current.filter((approval) => approval.id !== id));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reviewing queued event failed.");
    } finally { setReviewingApprovalId(null); }
  };

  if (loadState !== "ready" || !selectedRule || !formRule || !validation) {
    return <section className={`${styles.loadState} ${styles[loadState]}`} aria-live="polite"><FiShield aria-hidden="true" /><div><h1>{loadState === "loading" ? "Loading Event Routing" : "Event Routing needs attention"}</h1><p>{message}</p></div>{loadState !== "loading" ? <button type="button" onClick={() => void loadRules()}>Try again</button> : null}</section>;
  }

  return <div className={styles.page}>
    <header className={styles.toolbar}>
      <div className={styles.titleBlock}><h1>Event Routing</h1><p>Choose what should happen when a real event is received</p><span>{productionRules.length} production rules · {persistedCount} saved · {enabledCount} enabled</span></div>
      <div className={styles.filters} aria-label="Filter event routing rules">
        <label className={styles.searchField}><span className={styles.srOnly}>Find an event kind</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an event kind" /><FiSearch aria-hidden="true" /></label>
        <label><span className={styles.srOnly}>Source</span><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)}><option value="all">All sources</option>{productionSourcePlatforms.map((source) => <option key={source} value={source}>{sourceLabels[source]}</option>)}</select><FiChevronDown aria-hidden="true" /></label>
        <label><span className={styles.srOnly}>Destination</span><select value={destinationFilter} onChange={(event) => setDestinationFilter(event.target.value as typeof destinationFilter)}><option value="all">All destinations</option>{eventRoutingDestinations.map((destination) => <option key={destination} value={destination}>{destinationLabels[destination]}</option>)}</select><FiChevronDown aria-hidden="true" /></label>
        <label><span className={styles.srOnly}>Rule state</span><select value={stateFilter} onChange={(event) => setStateFilter(event.target.value as StateFilter)}><option value="all">All states</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option><option value="saved">Saved</option><option value="default">Default</option></select><FiChevronDown aria-hidden="true" /></label>
        <button className={styles.iconButton} type="button" onClick={() => void loadRules()} disabled={busy} aria-label="Refresh rules"><FiRefreshCw aria-hidden="true" /></button>
      </div>
    </header>
    {message !== "Event routing rules loaded." ? <p className={styles.message} role="status">{message}</p> : null}
    <details className={styles.approvalQueue} open={approvals.length > 0}>
      <summary><FiShield aria-hidden="true" /><strong>Pending review</strong><span>{approvals.length} real event{approvals.length === 1 ? "" : "s"} waiting</span><small>Allowlisted context only</small><button type="button" onClick={(event) => { event.preventDefault(); void loadRules(); }} disabled={busy || reviewingApprovalId !== null}>Refresh <FiRefreshCw aria-hidden="true" /></button></summary>
      {approvals.length > 0 ? <ul>{approvals.map((approval) => <li key={approval.id}><div><strong>{approval.label}</strong><span>{sourceLabels[approval.event.sourcePlatform]} · {destinationLabels[approval.destination]} · {formatDate(approval.createdAt)}</span><p>{getApprovalText(approval)}</p>{getContextDetails(approval.event.context) ? <small>{getContextDetails(approval.event.context)}</small> : null}<label className={styles.reviewNote}>Optional review note<input maxLength={1000} value={approvalNotes[approval.id] ?? ""} onChange={(event) => setApprovalNotes((current) => ({ ...current, [approval.id]: event.target.value }))} /></label></div><div className={styles.approvalActions}><button type="button" onClick={() => void reviewApproval(approval.id, "reject")} disabled={reviewingApprovalId !== null}>Reject</button><button type="button" title="Available after real provider events execute routing rules" disabled>Approve</button></div></li>)}</ul> : <p className={styles.emptyPanel}>No real production events are waiting for review.</p>}
    </details>
    <details className={styles.historyPanel}>
      <summary><FiClock aria-hidden="true" /><strong>Routing history</strong><span>{history.length} recent real event{history.length === 1 ? "" : "s"}</span></summary>
      {history.length > 0 ? <ol>{history.map((item, index) => <li key={`${item.eventKind}:${item.sourcePlatform}:${item.occurredAt}:${index}`}><div><strong>{item.context.title ?? item.context.displayText ?? item.label}</strong><span>{sourceLabels[item.sourcePlatform]} · {item.destination ? destinationLabels[item.destination] : "No destination"} · {formatDate(item.occurredAt)}</span></div><small>{item.routingOutcome}</small></li>)}</ol> : <p className={styles.emptyPanel}>No real routing history has been recorded yet.</p>}
    </details>
    <div className={styles.workspace}>
      <section className={styles.ruleMaster} aria-label="Event routing rules">
        <div className={styles.tableScroller}><table><thead><tr><th>Event kind</th><th>Source</th><th>Destination</th><th>When</th><th>Safeguards</th><th>Cooldown</th><th>State</th></tr></thead><tbody>
          {visibleRules.map((rule) => { const key = getRuleKey(rule); return <tr key={key} className={key === selectedRuleKey ? styles.selectedRow : undefined}>
            <td><button className={styles.ruleSelect} type="button" onClick={() => selectRule(key)} aria-current={key === selectedRuleKey ? "true" : undefined}><span className={styles.ruleIcon}><RuleIcon rule={rule} /></span><span><strong>{rule.label}</strong><small>{rule.eventKind}</small></span></button></td>
            <td>{sourceLabels[rule.sourcePlatform]}</td><td>{destinationLabels[rule.destination]}</td><td>{getWhenLabel(rule)}</td><td>{getSafeguardLabel(rule)}</td><td>{getCooldownLabel(rule)}</td><td><span className={`${styles.stateDot} ${rule.enabled ? styles.enabledDot : ""}`} />{rule.enabled ? "Enabled" : "Disabled"} · {rule.persisted ? "Saved" : "Default"}</td>
          </tr>; })}
        </tbody></table>{visibleRules.length === 0 ? <p className={styles.emptyRules}>No rules match these filters.</p> : null}</div>
        <footer className={styles.tableFooter}><span>Showing {visibleRules.length} of {filteredRules.length} rules</span><div><button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0}><FiChevronLeft aria-hidden="true" /> Previous</button><span>{page + 1} / {pageCount}</span><button type="button" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={page >= pageCount - 1}>Next <FiChevronRight aria-hidden="true" /></button></div></footer>
      </section>
      <form className={styles.editor} onSubmit={(event) => { event.preventDefault(); void saveRule(false); }}>
        <header className={styles.editorHeader}><div><h2>{selectedRule.label}</h2><p>{selectedRule.eventKind} · {selectedRule.persisted ? "saved rule" : "default rule"}</p></div><span className={styles.savedBadge}>{selectedRule.persisted ? "Saved" : "Not saved"}</span><label className={styles.enabledToggle} title={selectedCapabilities.runtimeConsumer === "unavailable" ? "This destination has no runtime consumer yet." : undefined}><span>Enabled</span><input type="checkbox" checked={formRule.enabled} disabled={selectedCapabilities.runtimeConsumer === "unavailable"} onChange={(event) => updateForm("enabled", event.target.checked)} /><i aria-hidden="true" /></label><div className={styles.ruleNavigation}><span>Rule {selectedIndex >= 0 ? selectedIndex + 1 : "—"} of {filteredRules.length}</span><button type="button" onClick={() => moveSelection(-1)} disabled={isDirty || selectedIndex <= 0} aria-label="Previous rule"><FiChevronLeft aria-hidden="true" /></button><button type="button" onClick={() => moveSelection(1)} disabled={isDirty || selectedIndex < 0 || selectedIndex >= filteredRules.length - 1} aria-label="Next rule"><FiChevronRight aria-hidden="true" /></button><small>↑↓ select · Ctrl+Enter save</small></div></header>
        <section className={styles.editorSection}><div className={styles.threeColumns}><label>Source<span className={styles.readOnlyField}>{sourceLabels[formRule.sourcePlatform]}{formRule.sourcePlatform === "any" ? " fallback" : " override"}</span></label><label>Destination<select value={formRule.destination} onChange={(event) => updateDestination(event.target.value as EventRoutingDestination)}>{eventRoutingDestinations.map((destination) => { const capability = getEventRoutingDestinationCapability(destination); return <option disabled={capability.runtimeConsumer === "unavailable"} key={destination} value={destination}>{destinationLabels[destination]}{capability.runtimeConsumer === "unavailable" ? " — no consumer" : ""}</option>; })}</select></label><label>Priority<select disabled={!selectedCapabilities.supportsPriority} value={formRule.notificationPriority} onChange={(event) => updateForm("notificationPriority", event.target.value as EventRoutingNotificationPriority)}>{eventRoutingNotificationPriorities.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}</select></label></div>{selectedRule.sourcePlatform === "any" && validOverrideSources.length > 0 ? <div className={styles.overrideRow}><span>Provider-specific override</span><select aria-label="Provider override source" value={overrideSource} onChange={(event) => setOverrideSource(event.target.value as typeof overrideSource)}><option value="">Select provider</option>{validOverrideSources.map((source) => <option key={source} value={source}>{sourceLabels[source]}</option>)}</select><button type="button" onClick={() => void addOverride()} disabled={!overrideSource || busy}><FiPlus aria-hidden="true" /> Add override</button></div> : <p className={styles.helperText}>This provider override falls back to the Any rule when removed.</p>}</section>
        <section className={styles.editorSection}><h3>When</h3><div className={`${styles.segmented} ${styles.disabledSegmented}`} aria-label="Live and offline routing is not yet enforceable"><button type="button" disabled className={!formRule.liveOnly && !formRule.offlineOnly ? styles.activeSegment : ""}>Any time</button><button type="button" disabled className={formRule.liveOnly ? styles.activeSegment : ""}>Live only</button><button type="button" disabled className={formRule.offlineOnly ? styles.activeSegment : ""}>Offline only</button></div><p className={styles.helperText}>Not enforced yet. This control unlocks after routing receives authoritative stream state and fails closed when that state is unknown.</p></section>
        <section className={styles.editorSection}><h3>Cooldown configuration</h3><div className={styles.cooldownGrid}><label>Per user<input type="number" min="0" inputMode="numeric" value={formRule.perUserCooldownSeconds ?? ""} placeholder="—" onChange={(event) => updateForm("perUserCooldownSeconds", nullableNumber(event.target.value))} /><small>Requires a stable user or actor identity.</small></label><label>Global<input type="number" min="0" inputMode="numeric" value={formRule.globalCooldownSeconds ?? ""} placeholder="—" onChange={(event) => updateForm("globalCooldownSeconds", nullableNumber(event.target.value))} /><small>Applies to the selected saved rule.</small></label><label className={styles.checkLabel}><input type="checkbox" checked={formRule.oncePerStream} onChange={(event) => updateForm("oncePerStream", event.target.checked)} />Once per stream</label></div><p className={styles.helperText}>Once per stream requires a stream-session or schedule identity. Configuration alone does not prove enforcement.</p><div className={styles.runtimeSummary}><FiClock aria-hidden="true" /><span>Active cooldowns</span><strong>{cooldownSummary?.activeCount ?? "—"}</strong><span>Nearest expiry</span><strong>{cooldownSummary?.nearestExpiry ? formatDate(cooldownSummary.nearestExpiry) : "None"}</strong></div></section>
        <section className={styles.editorSection}><h3>Display</h3><div className={styles.threeColumns}><label>Template<input disabled={!selectedCapabilities.supportsTemplate} value={formRule.templateKey ?? ""} maxLength={80} placeholder={selectedCapabilities.supportsTemplate ? "—" : "Not consumed"} onChange={(event) => updateForm("templateKey", nullableText(event.target.value))} /></label><label>Theme<input disabled={!selectedCapabilities.supportsTheme} value={formRule.themeKey ?? ""} maxLength={80} placeholder={selectedCapabilities.supportsTheme ? "—" : "Catalog planned"} onChange={(event) => updateForm("themeKey", nullableText(event.target.value))} /></label><label>Sound<input disabled={!selectedCapabilities.supportsSound} value={formRule.soundKey ?? ""} maxLength={80} placeholder={selectedCapabilities.supportsSound ? "—" : "Overlay only"} onChange={(event) => updateForm("soundKey", nullableText(event.target.value))} /></label></div></section>
        <section className={styles.editorSection}><h3>Safeguards</h3><div className={styles.safeguards}><label className={styles.checkLabel}><input type="checkbox" checked={formRule.approvalRequired} onChange={(event) => updateForm("approvalRequired", event.target.checked)} />Approval required</label><div><span>Opt-out requirement</span><strong>{validation.requiresUserOptOutCheck ? "Required for this destination" : "Not required for this destination"}</strong></div></div></section>
        <section className={styles.safetySection}><div className={styles.safetyHeading}>{validation.ok ? <FiCheck aria-hidden="true" /> : <FiAlertTriangle aria-hidden="true" />}<strong>Configuration</strong><span>{validation.ok ? "Valid configuration" : "Blocked"}</span></div><dl><div><dt>Opt-out requirement</dt><dd>{validation.requiresUserOptOutCheck ? "Required" : "Not required"}</dd></div><div><dt>Cooldown recommendation</dt><dd>{validation.requiresCooldownCheck ? "Recommended" : "Not recommended"}</dd></div><div><dt>Approval recommendation</dt><dd>{validation.requiresApprovalByDefault ? "Recommended" : "Not recommended"}</dd></div><div><dt>Last saved</dt><dd>{formatDate(selectedRule.updatedAt)}</dd></div></dl>{validation.issues.length > 0 ? <ul className={styles.validationIssues}>{validation.issues.map((issue) => <li key={issue}>{issueLabels[issue]}</li>)}</ul> : null}<p className={styles.caution}><FiAlertTriangle aria-hidden="true" /> Validation checks rule configuration only; it is not proof of end-to-end runtime readiness.</p><p className={styles.gateNote}>Real provider intake is active. Execution of these routing rules by normalized real intake is the remaining production automation step.</p></section>
        <footer className={styles.editorFooter}><span>{isDirty ? "Unsaved changes" : "No unsaved changes"}</span>{selectedRule.persisted ? <button type="button" className={styles.dangerAction} onClick={() => void resetRule()} disabled={isDirty || busy}><FiTrash2 aria-hidden="true" /> Remove saved rule</button> : null}<button type="button" onClick={() => setFormRule(toFormRule(selectedRule))} disabled={!isDirty || busy}>Discard</button><button type="submit" disabled={!isDirty || !validation.ok || busy}>{busy ? "Saving..." : "Save rule"}</button><button type="button" className={styles.primaryAction} onClick={() => void saveRule(true)} disabled={!isDirty || !validation.ok || busy || selectedIndex >= filteredRules.length - 1}>Save & next</button></footer>
      </form>
    </div>
  </div>;
};

export default EventRoutingAdminClient;
