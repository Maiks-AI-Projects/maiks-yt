"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiChevronDown, FiClock, FiEdit2, FiExternalLink, FiFolder, FiGlobe, FiLock,
  FiPlayCircle, FiPlus, FiSearch, FiXCircle
} from "react-icons/fi";
import type {
  StreamScheduleCancellationReasonCode, StreamScheduleChannelOption, StreamScheduleEntry, StreamScheduleGameOption,
  StreamScheduleProjectOption, StreamScheduleStatus, StreamScheduleVisibility
} from "@maiks-yt/domain/schedule";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";
import { cancellationReasonLabels, formatScheduleDate, formatScheduleLabel } from "../../schedule/stream-schedule-data";
import styles from "./schedule-admin.module.css";
import {
  buildGameFocusLinksForSubmit,
  toGameLinkForm,
  type GameLinkFormState
} from "./stream-schedule-admin.rules";
import {
  combineLocalDateAndTime,
  normalizeScheduleKey,
  splitLocalDateTime,
  validateScheduleForm,
  type ScheduleFormError
} from "./stream-schedule-form.rules";

type AdminScheduleResponse =
  | { ok: true; streams: readonly StreamScheduleEntry[]; projectOptions: readonly StreamScheduleProjectOption[]; gameOptions: readonly StreamScheduleGameOption[]; channelOptions?: readonly StreamScheduleChannelOption[] }
  | { ok: false; reason: string };
type AdminScheduleMutationResponse = { ok: true; stream: StreamScheduleEntry } | { ok: false; reason: string; issues?: readonly string[] };
type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";
type ScheduleFilter = "upcoming" | "all" | "cancelled";
type ScheduleSort = "soonest" | "latest";

type ScheduleFormState = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  channelKey: string;
  topicKey: string;
  themeKey: string;
  projectId: string;
  focusLabel: string;
  focusNote: string;
  visibility: StreamScheduleVisibility;
  status: StreamScheduleStatus;
};
type CancellationFormState = { cancellationReasonCode: StreamScheduleCancellationReasonCode; cancellationReason: string };

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.maiks.yt";
const scheduleDraftStorageKey = "maiks-yt:admin:schedule:unfinished-form:v1";
const visibilities = ["draft", "public", "private"] satisfies StreamScheduleVisibility[];
const editableStatuses = ["planned", "live", "completed"] satisfies StreamScheduleStatus[];
const cancellationReasonCodes = ["health", "family", "energy", "technical", "schedule-conflict", "other"] satisfies StreamScheduleCancellationReasonCode[];
const emptyScheduleForm: ScheduleFormState = {
  title: "", description: "", startsAt: "", endsAt: "", channelKey: "coding", topicKey: "maiks-yt",
  themeKey: "default", projectId: "", focusLabel: "", focusNote: "", visibility: "draft", status: "planned"
};
const defaultCancellationForm: CancellationFormState = { cancellationReasonCode: "energy", cancellationReason: "" };
const defaultGameLinkForm: GameLinkFormState = { gameId: "", publicNote: "" };

type PersistedScheduleDraft = {
  creationRequestId: string;
  selectedStreamId: string;
  scheduleForm: ScheduleFormState;
  gameLinkForm: GameLinkFormState;
  selectedChannelRefs: readonly string[];
};

const createScheduleRequestId = (): string => globalThis.crypto.randomUUID();

const readPersistedScheduleDraft = (): PersistedScheduleDraft | null => {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(scheduleDraftStorageKey) ?? "null") as Partial<PersistedScheduleDraft> | null;
    if (!value || typeof value.selectedStreamId !== "string" || !value.scheduleForm || !value.gameLinkForm || !Array.isArray(value.selectedChannelRefs)) return null;
    if (typeof value.scheduleForm.title !== "string" || typeof value.scheduleForm.startsAt !== "string") return null;
    return {
      ...(value as Omit<PersistedScheduleDraft, "creationRequestId">),
      creationRequestId: typeof value.creationRequestId === "string" && value.creationRequestId.length > 0
        ? value.creationRequestId
        : createScheduleRequestId()
    };
  } catch {
    return null;
  }
};

const removePersistedScheduleDraft = (): void => {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(scheduleDraftStorageKey); } catch { /* draft persistence is best effort */ }
};

const writePersistedScheduleDraft = (draft: PersistedScheduleDraft): void => {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(scheduleDraftStorageKey, JSON.stringify(draft)); } catch { /* form state remains in memory */ }
};

const toDateTimeLocal = (value: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromDateTimeLocal = (value: string): string => new Date(value).toISOString();
const createNewScheduleForm = (): ScheduleFormState => {
  const startsAt = new Date();
  startsAt.setMinutes(0, 0, 0);
  startsAt.setHours(startsAt.getHours() + 1);
  const endsAt = new Date(startsAt.getTime() + 3 * 60 * 60 * 1_000);
  return { ...emptyScheduleForm, startsAt: toDateTimeLocal(startsAt.toISOString()), endsAt: toDateTimeLocal(endsAt.toISOString()) };
};
const toScheduleForm = (stream: StreamScheduleEntry): ScheduleFormState => ({
  title: stream.title,
  description: stream.description ?? "",
  startsAt: toDateTimeLocal(stream.startsAt),
  endsAt: toDateTimeLocal(stream.endsAt),
  channelKey: stream.channelKey,
  topicKey: stream.topicKey ?? "",
  themeKey: stream.themeKey ?? "",
  projectId: stream.projectId ?? "",
  focusLabel: stream.focusLabel ?? "",
  focusNote: stream.focusNote ?? "",
  visibility: stream.visibility,
  status: stream.status
});
const formatTime = (value: string): string => new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit"
}).format(new Date(value));
const formatDayHeading = (value: string): string => {
  const date = new Date(value);
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(date);
  const calendarDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date);
  return `${weekday} · ${calendarDate}`.toUpperCase();
};
const getLocalDateKey = (value: string): string => {
  const date = new Date(value);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
};
const getFailureMessage = (response: Response, reason?: string): string => {
  if (response.status === 401 || reason === "not_authenticated") return "Sign in before managing the stream schedule.";
  if (response.status === 403 || reason === "stream_schedule_admin_forbidden") return "Your account does not have stream schedule permission.";
  if (reason === "stream_schedule_invalid_input") return "The schedule request has invalid or missing fields.";
  if (reason === "stream_schedule_not_found") return "That scheduled stream could not be found.";
  return `Stream schedule request failed with ${response.status}.`;
};
const getLoadStateForFailure = (response: Response, reason?: string): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") return "signed-out";
  if (response.status === 403 || reason === "stream_schedule_admin_forbidden" || reason === "stream_schedule_admin_user_unlinked") return "forbidden";
  return "failed";
};
const getStatusClassName = (status: StreamScheduleStatus): string => {
  if (status === "cancelled") return styles.statusCancelled ?? "";
  if (status === "completed") return styles.statusCompleted ?? "";
  if (status === "live") return styles.statusLive ?? "";
  return styles.statusPlanned ?? "";
};

const StreamScheduleAdminClient = (): React.ReactNode => {
  const [streams, setStreams] = useState<readonly StreamScheduleEntry[]>([]);
  const [projectOptions, setProjectOptions] = useState<readonly StreamScheduleProjectOption[]>([]);
  const [gameOptions, setGameOptions] = useState<readonly StreamScheduleGameOption[]>([]);
  const [channelOptions, setChannelOptions] = useState<readonly StreamScheduleChannelOption[]>([]);
  const [selectedStreamId, setSelectedStreamId] = useState("");
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(emptyScheduleForm);
  const [cancellationForm, setCancellationForm] = useState<CancellationFormState>(defaultCancellationForm);
  const [gameLinkForm, setGameLinkForm] = useState<GameLinkFormState>(defaultGameLinkForm);
  const [selectedChannelRefs, setSelectedChannelRefs] = useState<readonly string[]>([]);
  const [creationRequestId, setCreationRequestId] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("Loading stream schedule admin...");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [filter, setFilter] = useState<ScheduleFilter>("upcoming");
  const [sort, setSort] = useState<ScheduleSort>("soonest");
  const [searchQuery, setSearchQuery] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<readonly ScheduleFormError[]>([]);

  const selectedStream = useMemo(() => streams.find((stream) => stream.id === selectedStreamId) ?? null, [streams, selectedStreamId]);
  const visibleStreams = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const query = searchQuery.trim().toLocaleLowerCase();
    return streams.filter((stream) => {
      if (filter === "cancelled" && stream.status !== "cancelled") return false;
      if (filter === "upcoming" && (new Date(stream.startsAt) < startOfToday || stream.status === "completed")) return false;
      if (!query) return true;
      return [stream.title, stream.channelKey, stream.focusLabel, stream.focusProject?.title, ...stream.gameLinks.map((game) => game.title)]
        .some((value) => value?.toLocaleLowerCase().includes(query));
    }).slice().sort((left, right) => sort === "soonest" ? left.startsAt.localeCompare(right.startsAt) : right.startsAt.localeCompare(left.startsAt));
  }, [filter, searchQuery, sort, streams]);
  const groupedStreams = useMemo(() => {
    const groups: Array<{ dateKey: string; heading: string; streams: StreamScheduleEntry[] }> = [];
    for (const stream of visibleStreams) {
      const dateKey = getLocalDateKey(stream.startsAt);
      const current = groups.at(-1);
      if (current?.dateKey === dateKey) current.streams.push(stream);
      else groups.push({ dateKey, heading: formatDayHeading(stream.startsAt), streams: [stream] });
    }
    return groups;
  }, [visibleStreams]);
  const hasUnsavedChanges = useMemo(() => selectedStream
    ? JSON.stringify(scheduleForm) !== JSON.stringify(toScheduleForm(selectedStream))
      || JSON.stringify(gameLinkForm) !== JSON.stringify(toGameLinkForm(selectedStream))
      || JSON.stringify(selectedChannelRefs) !== JSON.stringify(selectedStream.channelTargets?.map((target) => target.channelRef) ?? [])
    : scheduleForm.title.trim().length > 0,
  [gameLinkForm, scheduleForm, selectedChannelRefs, selectedStream]);

  const replaceStream = useCallback((stream: StreamScheduleEntry): void => {
    setStreams((current) => {
      const next = current.some((candidate) => candidate.id === stream.id)
        ? current.map((candidate) => candidate.id === stream.id ? stream : candidate)
        : [stream, ...current];
      return next.slice().sort((left, right) => left.startsAt.localeCompare(right.startsAt));
    });
    setSelectedStreamId(stream.id);
    setScheduleForm(toScheduleForm(stream));
    setGameLinkForm(toGameLinkForm(stream));
    setSelectedChannelRefs(stream.channelTargets?.map((target) => target.channelRef) ?? []);
    setCancellationForm({ cancellationReasonCode: stream.cancellationReasonCode ?? "energy", cancellationReason: stream.cancellationReason ?? "" });
    removePersistedScheduleDraft();
  }, []);

  const parseJson = async <ResponseBody,>(response: Response): Promise<ResponseBody | null> => {
    try { return await response.json() as ResponseBody; } catch { return null; }
  };
  const loadStreams = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    setMessage("Loading stream schedule admin...");
    try {
      const response = await fetch(`${apiBaseUrl}/admin/schedule`, { headers: createApiHeaders(), credentials: "include" });
      const payload = await parseJson<AdminScheduleResponse>(response);
      if (response.ok && payload?.ok) {
        setStreams(payload.streams);
        setProjectOptions(payload.projectOptions);
        setGameOptions(payload.gameOptions);
        setChannelOptions(payload.channelOptions ?? []);
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const firstStream = payload.streams.find((stream) =>
          new Date(stream.startsAt) >= startOfToday && stream.status !== "completed" && stream.status !== "cancelled"
        ) ?? null;
        const persistedDraft = readPersistedScheduleDraft();
        const persistedStream = persistedDraft?.selectedStreamId
          ? payload.streams.find((stream) => stream.id === persistedDraft.selectedStreamId) ?? null
          : null;
        const canRestoreDraft = Boolean(persistedDraft && (!persistedDraft.selectedStreamId || persistedStream));
        const initialStream = canRestoreDraft ? persistedStream : firstStream;
        setSelectedStreamId(canRestoreDraft ? persistedDraft?.selectedStreamId ?? "" : firstStream?.id ?? "");
        setCreationRequestId(canRestoreDraft ? persistedDraft?.creationRequestId ?? createScheduleRequestId() : createScheduleRequestId());
        setScheduleForm(canRestoreDraft ? persistedDraft?.scheduleForm ?? createNewScheduleForm() : firstStream ? toScheduleForm(firstStream) : createNewScheduleForm());
        setGameLinkForm(canRestoreDraft ? persistedDraft?.gameLinkForm ?? defaultGameLinkForm : firstStream ? toGameLinkForm(firstStream) : defaultGameLinkForm);
        setSelectedChannelRefs(canRestoreDraft ? persistedDraft?.selectedChannelRefs ?? [] : firstStream?.channelTargets?.map((target) => target.channelRef) ?? []);
        setCancellationForm(initialStream ? { cancellationReasonCode: initialStream.cancellationReasonCode ?? "energy", cancellationReason: initialStream.cancellationReason ?? "" } : defaultCancellationForm);
        if (persistedStream && new Date(persistedStream.startsAt) < startOfToday) setFilter("all");
        setLoadState("ready");
        setMessage(canRestoreDraft ? "Your unfinished stream form was restored." : firstStream ? "Schedule ready." : payload.streams.length === 0
          ? "No scheduled streams exist yet. Creating a new draft stream."
          : "No upcoming streams. Creating a new draft stream; older streams remain under All.");
        return;
      }
      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState(getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Stream schedule admin request failed.");
    }
  }, []);
  useEffect(() => { captureDevAuthTokenFromUrl(); void loadStreams(); }, [loadStreams]);
  useEffect(() => {
    if (loadState !== "ready" || typeof window === "undefined") return;
    if (!hasUnsavedChanges && selectedStream) {
      removePersistedScheduleDraft();
      return;
    }
    if (!creationRequestId) return;
    writePersistedScheduleDraft({ creationRequestId, selectedStreamId, scheduleForm, gameLinkForm, selectedChannelRefs });
  }, [creationRequestId, gameLinkForm, hasUnsavedChanges, loadState, scheduleForm, selectedChannelRefs, selectedStream, selectedStreamId]);
  useEffect(() => {
    if (!cancelDialogOpen) return;
    const closeOnEscape = (event: KeyboardEvent): void => { if (event.key === "Escape" && busyAction === null) setCancelDialogOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busyAction, cancelDialogOpen]);

  const runMutation = async (label: string, path: string, options: {
    method: "POST" | "PATCH" | "PUT";
    body: Record<string, unknown>;
    idempotencyKey?: string;
  }): Promise<StreamScheduleEntry | null> => {
    setBusyAction(label);
    setMessage(`${label}...`);
    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: options.method,
        headers: createApiHeaders({
          "Content-Type": "application/json",
          ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {})
        }),
        credentials: "include",
        body: JSON.stringify(options.body)
      });
      const payload = await parseJson<AdminScheduleMutationResponse>(response);
      if (response.ok && payload?.ok) {
        replaceStream(payload.stream);
        setLoadState("ready");
        setFormErrors([]);
        setMessage(`${label} saved successfully.`);
        return payload.stream;
      }
      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState((current) => current === "ready" ? current : getLoadStateForFailure(response, reason));
      const failureMessage = getFailureMessage(response, reason);
      setFormErrors([{ field: "global", message: payload?.ok === false && payload.issues?.length
        ? payload.issues.join(" ")
        : failureMessage }]);
      setMessage(`${label} failed. Your entries were kept.`);
      return null;
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : `${label} failed.`;
      setFormErrors([{ field: "global", message: `${failureMessage} Your entries were kept.` }]);
      setMessage(`${label} failed. Your entries were kept.`);
      return null;
    } finally { setBusyAction(null); }
  };

  const selectStream = (streamId: string): void => {
    const stream = streams.find((candidate) => candidate.id === streamId);
    setSelectedStreamId(streamId);
    if (!stream) return;
    setScheduleForm(toScheduleForm(stream));
    setGameLinkForm(toGameLinkForm(stream));
    setSelectedChannelRefs(stream.channelTargets?.map((target) => target.channelRef) ?? []);
    setFormErrors([]);
    setCancellationForm({ cancellationReasonCode: stream.cancellationReasonCode ?? "energy", cancellationReason: stream.cancellationReason ?? "" });
  };
  const startNewStream = (): void => {
    setSelectedStreamId("");
    setCreationRequestId(createScheduleRequestId());
    setScheduleForm(createNewScheduleForm());
    setCancellationForm(defaultCancellationForm);
    setGameLinkForm(defaultGameLinkForm);
    setSelectedChannelRefs([]);
    setFormErrors([]);
    setMessage("Creating a new draft stream.");
  };
  const discardChanges = (): void => {
    if (selectedStream) {
      setScheduleForm(toScheduleForm(selectedStream));
      setGameLinkForm(toGameLinkForm(selectedStream));
      setSelectedChannelRefs(selectedStream.channelTargets?.map((target) => target.channelRef) ?? []);
      setMessage("Unsaved changes discarded.");
    } else {
      setCreationRequestId(createScheduleRequestId());
      setScheduleForm(createNewScheduleForm());
      setGameLinkForm(defaultGameLinkForm);
      setSelectedChannelRefs([]);
    }
    setFormErrors([]);
  };
  const buildSchedulePayload = (): Record<string, unknown> => ({
    ...scheduleForm,
    description: scheduleForm.description.trim() || null,
    startsAt: fromDateTimeLocal(scheduleForm.startsAt),
    endsAt: scheduleForm.endsAt ? fromDateTimeLocal(scheduleForm.endsAt) : null,
    channelKey: normalizeScheduleKey(channelOptions.find((option) => option.channelRef === selectedChannelRefs[0])?.displayName ?? scheduleForm.channelKey),
    channelRefs: selectedChannelRefs,
    topicKey: normalizeScheduleKey(scheduleForm.topicKey) || null,
    themeKey: normalizeScheduleKey(scheduleForm.themeKey) || null,
    projectId: scheduleForm.projectId || null,
    focusLabel: scheduleForm.focusLabel.trim() || null,
    focusNote: scheduleForm.focusNote.trim() || null,
    cancellationReasonCode: scheduleForm.status === "cancelled" ? cancellationForm.cancellationReasonCode : null,
    cancellationReason: scheduleForm.status === "cancelled" ? cancellationForm.cancellationReason : null
  });
  const saveGameLink = async (streamId: string): Promise<StreamScheduleEntry | null> => runMutation("Saving game focus", `/admin/schedule/${encodeURIComponent(streamId)}/games`, {
    method: "PUT",
    body: { links: buildGameFocusLinksForSubmit(selectedStream, gameLinkForm) }
  });
  const saveStream = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const validationErrors = validateScheduleForm({ ...scheduleForm, channelRefs: selectedChannelRefs });
    if (validationErrors.length > 0) {
      setFormErrors(validationErrors);
      setMessage("Stream was not saved. Fix the highlighted fields; your entries were kept.");
      if (typeof document !== "undefined" && validationErrors[0]?.field !== "global") {
        document.getElementById(`schedule-${validationErrors[0]?.field}`)?.focus();
      }
      return;
    }
    setFormErrors([]);
    const gameLinkChanged = JSON.stringify(gameLinkForm) !== JSON.stringify(selectedStream ? toGameLinkForm(selectedStream) : defaultGameLinkForm);
    const savedStream = selectedStream
      ? await runMutation("Saving stream", `/admin/schedule/${encodeURIComponent(selectedStream.id)}`, { method: "PATCH", body: buildSchedulePayload() })
      : await runMutation("Creating stream", "/admin/schedule", {
        method: "POST",
        body: buildSchedulePayload(),
        idempotencyKey: creationRequestId
      });
    if (savedStream && (gameLinkChanged || (!selectedStream && gameLinkForm.gameId))) await saveGameLink(savedStream.id);
  };
  const openCancelDialog = (): void => {
    if (!selectedStream || selectedStream.status === "cancelled") return;
    setCancellationForm({ cancellationReasonCode: selectedStream.cancellationReasonCode ?? "energy", cancellationReason: selectedStream.cancellationReason ?? "" });
    setCancelError(null);
    setCancelDialogOpen(true);
  };
  const cancelStream = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selectedStream) { setCancelError("Choose a scheduled stream before cancelling."); return; }
    if (!cancellationForm.cancellationReason.trim()) { setCancelError("Add a public reason before cancelling this stream."); return; }
    const cancelledStream = await runMutation("Cancelling stream", `/admin/schedule/${encodeURIComponent(selectedStream.id)}/cancel`, {
      method: "POST",
      body: { ...cancellationForm, cancellationReason: cancellationForm.cancellationReason.trim() }
    });
    if (cancelledStream) {
      setCancelDialogOpen(false);
      setCancelError(null);
      setMessage("Stream cancelled. The public reason is saved with the schedule.");
    }
  };

  return <>
    <header className={styles.pageHeader}>
      <div><h1>Stream Schedule</h1><p>Manage the next few streams shown on the public schedule.</p></div>
      <div className={styles.headerActions}>
        <a className={styles.publicLink} href="/schedule">View public schedule <FiExternalLink aria-hidden="true" /></a>
        <button type="button" onClick={startNewStream}><FiPlus aria-hidden="true" />New stream</button>
      </div>
    </header>

    {loadState !== "ready" ? <section className={`project-admin-state ${loadState}`}>
      <h2>{loadState === "loading" ? "Loading" : loadState === "signed-out" ? "Sign In Required" : loadState === "forbidden" ? "Forbidden" : "Unavailable"}</h2>
      <p>{message}</p>
      {loadState !== "loading" ? <button type="button" className="secondary-action" onClick={() => void loadStreams()}>Retry</button> : null}
    </section> : null}

    {loadState === "ready" ? <div className={styles.scheduleLayout}>
      <section className={styles.streamListPane} aria-label="Scheduled streams">
        <div className={styles.listToolbar}>
          <label className={styles.searchField}>
            <FiSearch aria-hidden="true" /><span className={styles.visuallyHidden}>Search streams</span>
            <input type="search" placeholder="Search streams" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
          </label>
          <div className={styles.filters} aria-label="Filter schedule">
            {(["upcoming", "all", "cancelled"] as const).map((option) => <button
              aria-pressed={filter === option} className={filter === option ? styles.activeFilter : undefined}
              key={option} type="button" onClick={() => setFilter(option)}>{formatScheduleLabel(option)}</button>)}
          </div>
          <label className={styles.sortField}>
            <span className={styles.visuallyHidden}>Sort streams</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as ScheduleSort)}>
              <option value="soonest">Soonest first</option><option value="latest">Latest first</option>
            </select><FiChevronDown aria-hidden="true" />
          </label>
        </div>
        <p className={styles.statusMessage} aria-live="polite">{message}</p>
        {groupedStreams.length === 0 ? <div className={styles.emptyList}><strong>No matching streams</strong><p>Try another filter or create a new draft stream.</p></div> :
          <div className={styles.streamGroups}>{groupedStreams.map((group) => <section className={styles.streamGroup} key={group.dateKey}>
            <h2>{group.heading}</h2>
            {group.streams.map((stream) => {
              const focusTitle = stream.focusProject?.title ?? stream.gameLinks[0]?.title ?? null;
              const FocusIcon = stream.focusProject ? FiFolder : FiPlayCircle;
              const VisibilityIcon = stream.visibility === "public" ? FiGlobe : FiLock;
              return <button aria-pressed={selectedStreamId === stream.id}
                className={`${styles.streamRow} ${selectedStreamId === stream.id ? styles.selectedRow : ""}`}
                key={stream.id} type="button" onClick={() => selectStream(stream.id)}>
                <span className={styles.streamTime}><strong>{formatTime(stream.startsAt)}</strong>{stream.endsAt ? <small>{formatTime(stream.endsAt)} end</small> : null}</span>
                <span className={styles.streamSummary}>
                  <span className={styles.titleLine}><strong>{stream.title}</strong><span className={`${styles.statusPill} ${getStatusClassName(stream.status)}`}>{formatScheduleLabel(stream.status)}</span></span>
                  <span className={styles.streamMeta}>
                    {stream.status === "cancelled" && stream.cancellationReason ? <span className={styles.cancelReason}><FiXCircle aria-hidden="true" />{stream.cancellationReason}</span>
                      : focusTitle ? <span><FocusIcon aria-hidden="true" />{focusTitle}</span> : null}
                    <span># {stream.channelKey}</span><span><VisibilityIcon aria-hidden="true" />{formatScheduleLabel(stream.visibility)}</span>
                  </span>
                </span><FiEdit2 aria-hidden="true" className={styles.editIcon} />
              </button>;
            })}
          </section>)}</div>}
      </section>

      <section className={styles.editorPane} aria-label={selectedStream ? "Edit stream" : "Create stream"}>
        <form className={styles.editorForm} noValidate onSubmit={(event) => void saveStream(event)}>
          <div className={styles.editorHeading}><div><h2>{selectedStream ? "Edit stream" : "Create stream"}</h2><span className={`${styles.statusPill} ${getStatusClassName(scheduleForm.status)}`}>{formatScheduleLabel(scheduleForm.status)}</span></div></div>
          {formErrors.length > 0 ? <section className={styles.formErrorSummary} role="alert" aria-live="assertive">
            <strong>Stream not saved</strong>
            <ul>{formErrors.map((error, index) => <li key={`${error.field}-${index}`}>{error.message}</li>)}</ul>
          </section> : null}
          <div className={styles.twoColumnFields}>
            <label>Title<input aria-invalid={formErrors.some((error) => error.field === "title")} id="schedule-title" required maxLength={191} value={scheduleForm.title} onChange={(event) => setScheduleForm((current) => ({ ...current, title: event.target.value }))} /></label>
            <label>Description<textarea maxLength={2000} rows={2} value={scheduleForm.description} onChange={(event) => setScheduleForm((current) => ({ ...current, description: event.target.value }))} /></label>
            <fieldset className={styles.dateTimeField}><legend>Starts</legend><div>
              <label><span>Date</span><input aria-invalid={formErrors.some((error) => error.field === "startsAt")} id="schedule-startsAt" required type="date" value={splitLocalDateTime(scheduleForm.startsAt).date} onChange={(event) => setScheduleForm((current) => ({ ...current, startsAt: combineLocalDateAndTime(event.target.value, splitLocalDateTime(current.startsAt).time) }))} /></label>
              <label><span>Time (24-hour)</span><input aria-label="Start time (24-hour)" inputMode="numeric" maxLength={5} pattern="(?:[01]\\d|2[0-3]):[0-5]\\d" placeholder="21:00" required type="text" value={splitLocalDateTime(scheduleForm.startsAt).time} onChange={(event) => setScheduleForm((current) => ({ ...current, startsAt: combineLocalDateAndTime(splitLocalDateTime(current.startsAt).date, event.target.value) || `${splitLocalDateTime(current.startsAt).date}T${event.target.value}` }))} /></label>
            </div></fieldset>
            <fieldset className={styles.dateTimeField}><legend>Ends</legend><div>
              <label><span>Date</span><input aria-invalid={formErrors.some((error) => error.field === "endsAt")} id="schedule-endsAt" type="date" value={splitLocalDateTime(scheduleForm.endsAt).date} onChange={(event) => setScheduleForm((current) => ({ ...current, endsAt: event.target.value ? combineLocalDateAndTime(event.target.value, splitLocalDateTime(current.endsAt).time || "00:00") : "" }))} /></label>
              <label><span>Time (24-hour)</span><input aria-label="End time (24-hour)" inputMode="numeric" maxLength={5} pattern="(?:[01]\\d|2[0-3]):[0-5]\\d" placeholder="00:00" type="text" value={splitLocalDateTime(scheduleForm.endsAt).time} onChange={(event) => setScheduleForm((current) => ({ ...current, endsAt: combineLocalDateAndTime(splitLocalDateTime(current.endsAt).date, event.target.value) || `${splitLocalDateTime(current.endsAt).date}T${event.target.value}` }))} /></label>
            </div></fieldset>
            <label>Stream focus / project<select value={scheduleForm.projectId} onChange={(event) => setScheduleForm((current) => ({ ...current, projectId: event.target.value }))}>
              <option value="">No linked project</option>{projectOptions.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
            <label>Focus label<input maxLength={120} placeholder="Stream focus" value={scheduleForm.focusLabel} onChange={(event) => setScheduleForm((current) => ({ ...current, focusLabel: event.target.value }))} /></label>
          </div>
          <label>Focus note<textarea maxLength={280} rows={2} value={scheduleForm.focusNote} onChange={(event) => setScheduleForm((current) => ({ ...current, focusNote: event.target.value }))} /></label>
          <div className={styles.twoColumnFields}>
            <label>Game focus<select value={gameLinkForm.gameId} onChange={(event) => setGameLinkForm((current) => ({ ...current, gameId: event.target.value }))}>
              <option value="">No linked game</option>{gameOptions.map((game) => <option key={game.id} value={game.id}>{game.title}{game.platformLabel ? ` / ${game.platformLabel}` : ""}{game.visibility === "private" ? " (private)" : ""}</option>)}</select></label>
            <label>Public game note<input disabled={!gameLinkForm.gameId} maxLength={280} placeholder={gameLinkForm.gameId ? "Optional public context" : "Available after linking a game"}
              value={gameLinkForm.publicNote} onChange={(event) => setGameLinkForm((current) => ({ ...current, publicNote: event.target.value }))} /></label>
          </div>
          <div className={styles.twoColumnFields}>
            <label>Visibility<select value={scheduleForm.visibility} onChange={(event) => setScheduleForm((current) => ({ ...current, visibility: event.target.value as StreamScheduleVisibility }))}>
              {visibilities.map((visibility) => <option key={visibility} value={visibility}>{formatScheduleLabel(visibility)}</option>)}</select></label>
            <label>Status<select value={scheduleForm.status} onChange={(event) => setScheduleForm((current) => ({ ...current, status: event.target.value as StreamScheduleStatus }))}>
              {scheduleForm.status === "cancelled" ? <option value="cancelled">Cancelled</option> : null}{editableStatuses.map((status) => <option key={status} value={status}>{formatScheduleLabel(status)}</option>)}</select></label>
          </div>
          <fieldset aria-invalid={formErrors.some((error) => error.field === "channelKey")} className={styles.channelSelector} id="schedule-channelKey">
            <legend>Channels</legend>
            {channelOptions.length === 0 ? <p>No connected Twitch or YouTube channels were found. Connect a provider before saving this stream.</p>
              : <div>{channelOptions.map((option) => <label key={option.channelRef}>
                <input checked={selectedChannelRefs.includes(option.channelRef)} type="checkbox" onChange={() => setSelectedChannelRefs((current) => current.includes(option.channelRef)
                  ? current.filter((channelRef) => channelRef !== option.channelRef)
                  : [...current, option.channelRef])} />
                <span><strong>{option.displayName}</strong><small>{option.provider === "youtube" ? "YouTube" : "Twitch"}{option.handle ? ` · ${option.handle}` : ""}</small></span>
              </label>)}</div>}
          </fieldset>
          <details className={styles.technicalFields}><summary>Topic &amp; theme</summary><div className={styles.twoColumnFields}>
            <label>Topic<input maxLength={80} value={scheduleForm.topicKey} onChange={(event) => setScheduleForm((current) => ({ ...current, topicKey: event.target.value }))} /><small>Spaces and capitals are accepted.</small></label>
            <label>Theme<input maxLength={80} value={scheduleForm.themeKey} onChange={(event) => setScheduleForm((current) => ({ ...current, themeKey: event.target.value }))} /><small>Spaces and capitals are accepted.</small></label>
          </div></details>
          <div className={styles.saveBar}><span>{hasUnsavedChanges ? "Unsaved changes" : "No unsaved changes"}</span><div>
            <button className="secondary-action" disabled={!hasUnsavedChanges || busyAction !== null} type="button" onClick={discardChanges}>Discard</button>
            <button disabled={busyAction !== null} type="submit">{busyAction ? "Saving..." : selectedStream ? "Save changes" : "Create stream"}</button>
          </div></div>
          {selectedStream ? <section className={styles.cancelStrip}><div><h3>Need to cancel?</h3><p>Add a public reason so viewers know the plan changed.</p></div>
            <button className={styles.cancelButton} disabled={busyAction !== null || selectedStream.status === "cancelled"} type="button" onClick={openCancelDialog}>
              <FiXCircle aria-hidden="true" />{selectedStream.status === "cancelled" ? "Stream cancelled" : "Cancel stream"}</button></section> : null}
        </form>
      </section>
    </div> : null}

    {cancelDialogOpen && selectedStream ? <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && busyAction === null) setCancelDialogOpen(false);
    }}><dialog aria-labelledby="cancel-stream-title" aria-modal="true" className={styles.cancelDialog} open>
      <form onSubmit={(event) => void cancelStream(event)}>
        <div className={styles.dialogHeading}><div><span className={styles.dangerEyebrow}>Cancel scheduled stream</span><h2 id="cancel-stream-title">Why is “{selectedStream.title}” cancelled?</h2></div>
          <button aria-label="Close cancellation dialog" className={styles.iconButton} disabled={busyAction !== null} type="button" onClick={() => setCancelDialogOpen(false)}><FiXCircle aria-hidden="true" /></button></div>
        <p className={styles.dialogIntro}>This public reason is saved with the schedule for reuse. Cancelling here does not post to social platforms.</p>
        <div className={styles.dialogFields}>
          <label>Reason<select value={cancellationForm.cancellationReasonCode} onChange={(event) => setCancellationForm((current) => ({ ...current, cancellationReasonCode: event.target.value as StreamScheduleCancellationReasonCode }))}>
            {cancellationReasonCodes.map((code) => <option key={code} value={code}>{cancellationReasonLabels[code]}</option>)}</select></label>
          <label>Public explanation<textarea autoFocus required maxLength={500} placeholder="Briefly explain the change for viewers." rows={4} value={cancellationForm.cancellationReason}
            onChange={(event) => { setCancellationForm((current) => ({ ...current, cancellationReason: event.target.value })); setCancelError(null); }} /></label>
          <span className={styles.characterCount}>{cancellationForm.cancellationReason.length} / 500</span>
        </div>
        {cancelError ? <p className={styles.dialogError} role="alert">{cancelError}</p> : null}
        <div className={styles.dialogActions}><span><FiClock aria-hidden="true" />{formatScheduleDate(selectedStream.startsAt)}</span><div>
          <button className="secondary-action" disabled={busyAction !== null} type="button" onClick={() => setCancelDialogOpen(false)}>Keep stream</button>
          <button className={styles.confirmCancelButton} disabled={busyAction !== null} type="submit">{busyAction === "Cancelling stream" ? "Cancelling..." : "Cancel stream"}</button>
        </div></div>
      </form>
    </dialog></div> : null}
  </>;
};

export default StreamScheduleAdminClient;
