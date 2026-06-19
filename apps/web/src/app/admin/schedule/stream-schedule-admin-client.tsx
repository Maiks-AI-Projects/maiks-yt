"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  StreamScheduleCancellationReasonCode,
  StreamScheduleEntry,
  StreamScheduleStatus,
  StreamScheduleVisibility
} from "@maiks-yt/domain/schedule";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";
import {
  cancellationReasonLabels,
  formatScheduleDate,
  formatScheduleLabel
} from "../../schedule/stream-schedule-data";

type AdminScheduleResponse =
  | {
    ok: true;
    streams: readonly StreamScheduleEntry[];
  }
  | {
    ok: false;
    reason: string;
  };

type AdminScheduleMutationResponse =
  | {
    ok: true;
    stream: StreamScheduleEntry;
  }
  | {
    ok: false;
    reason: string;
  };

type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";

type ScheduleFormState = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  channelKey: string;
  topicKey: string;
  themeKey: string;
  visibility: StreamScheduleVisibility;
  status: StreamScheduleStatus;
};

type CancellationFormState = {
  cancellationReasonCode: StreamScheduleCancellationReasonCode;
  cancellationReason: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const visibilities = ["draft", "public", "private"] satisfies StreamScheduleVisibility[];
const editableStatuses = ["planned", "live", "completed"] satisfies StreamScheduleStatus[];
const cancellationReasonCodes = [
  "health",
  "family",
  "energy",
  "technical",
  "schedule-conflict",
  "other"
] satisfies StreamScheduleCancellationReasonCode[];

const defaultScheduleForm: ScheduleFormState = {
  title: "",
  description: "",
  startsAt: "2026-06-20T18:00",
  endsAt: "",
  channelKey: "coding",
  topicKey: "maiks-yt",
  themeKey: "default",
  visibility: "draft",
  status: "planned"
};

const defaultCancellationForm: CancellationFormState = {
  cancellationReasonCode: "energy",
  cancellationReason: ""
};

const toDateTimeLocal = (value: string | null): string => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const fromDateTimeLocal = (value: string): string =>
  new Date(value).toISOString();

const toScheduleForm = (stream: StreamScheduleEntry): ScheduleFormState => ({
  title: stream.title,
  description: stream.description ?? "",
  startsAt: toDateTimeLocal(stream.startsAt),
  endsAt: toDateTimeLocal(stream.endsAt),
  channelKey: stream.channelKey,
  topicKey: stream.topicKey ?? "",
  themeKey: stream.themeKey ?? "",
  visibility: stream.visibility,
  status: stream.status
});

const getFailureMessage = (response: Response, reason?: string): string => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "Sign in before managing the stream schedule.";
  }

  if (response.status === 403 || reason === "stream_schedule_admin_forbidden") {
    return "Your account does not have stream schedule permission.";
  }

  if (reason === "stream_schedule_invalid_input") {
    return "The schedule request has invalid or missing fields.";
  }

  if (reason === "stream_schedule_not_found") {
    return "That scheduled stream could not be found.";
  }

  return `Stream schedule request failed with ${response.status}.`;
};

const getLoadStateForFailure = (response: Response, reason?: string): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

  if (response.status === 403 || reason === "stream_schedule_admin_forbidden" || reason === "stream_schedule_admin_user_unlinked") {
    return "forbidden";
  }

  return "failed";
};

const StreamScheduleAdminClient = (): React.ReactNode => {
  const [streams, setStreams] = useState<readonly StreamScheduleEntry[]>([]);
  const [selectedStreamId, setSelectedStreamId] = useState<string>("");
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(defaultScheduleForm);
  const [cancellationForm, setCancellationForm] = useState<CancellationFormState>(defaultCancellationForm);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string>("Loading stream schedule admin...");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const selectedStream = useMemo(
    () => streams.find((stream) => stream.id === selectedStreamId) ?? null,
    [streams, selectedStreamId]
  );

  const replaceStream = useCallback((stream: StreamScheduleEntry): void => {
    setStreams((current) => {
      const exists = current.some((candidate) => candidate.id === stream.id);
      const next = exists
        ? current.map((candidate) => candidate.id === stream.id ? stream : candidate)
        : [stream, ...current];

      return next.slice().sort((left, right) => left.startsAt.localeCompare(right.startsAt));
    });
    setSelectedStreamId(stream.id);
    setScheduleForm(toScheduleForm(stream));
    setCancellationForm({
      cancellationReasonCode: stream.cancellationReasonCode ?? "energy",
      cancellationReason: stream.cancellationReason ?? ""
    });
  }, []);

  const parseJson = async <ResponseBody,>(response: Response): Promise<ResponseBody | null> => {
    try {
      return await response.json() as ResponseBody;
    } catch {
      return null;
    }
  };

  const loadStreams = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    setMessage("Loading stream schedule admin...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/schedule`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<AdminScheduleResponse>(response);

      if (response.ok && payload?.ok) {
        setStreams(payload.streams);
        const firstStream = payload.streams[0] ?? null;
        setSelectedStreamId(firstStream?.id ?? "");
        setScheduleForm(firstStream ? toScheduleForm(firstStream) : defaultScheduleForm);
        setCancellationForm(firstStream ? {
          cancellationReasonCode: firstStream.cancellationReasonCode ?? "energy",
          cancellationReason: firstStream.cancellationReason ?? ""
        } : defaultCancellationForm);
        setLoadState("ready");
        setMessage(payload.streams.length === 0 ? "No scheduled streams exist yet." : "Stream schedule admin loaded.");
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

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadStreams();
  }, [loadStreams]);

  const runMutation = async (
    label: string,
    path: string,
    options: {
      method: "POST" | "PATCH";
      body: Record<string, unknown>;
    }
  ): Promise<StreamScheduleEntry | null> => {
    setBusyAction(label);
    setMessage(`${label}...`);

    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: options.method,
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        credentials: "include",
        body: JSON.stringify(options.body)
      });
      const payload = await parseJson<AdminScheduleMutationResponse>(response);

      if (response.ok && payload?.ok) {
        replaceStream(payload.stream);
        setLoadState("ready");
        setMessage(`${label} saved.`);
        return payload.stream;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState((current) => current === "ready" ? current : getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
      return null;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${label} failed.`);
      return null;
    } finally {
      setBusyAction(null);
    }
  };

  const selectStream = (streamId: string): void => {
    const stream = streams.find((candidate) => candidate.id === streamId);

    setSelectedStreamId(streamId);
    if (stream) {
      setScheduleForm(toScheduleForm(stream));
      setCancellationForm({
        cancellationReasonCode: stream.cancellationReasonCode ?? "energy",
        cancellationReason: stream.cancellationReason ?? ""
      });
    }
  };

  const buildSchedulePayload = (): Record<string, unknown> => ({
    ...scheduleForm,
    description: scheduleForm.description.trim() || null,
    startsAt: fromDateTimeLocal(scheduleForm.startsAt),
    endsAt: scheduleForm.endsAt ? fromDateTimeLocal(scheduleForm.endsAt) : null,
    topicKey: scheduleForm.topicKey.trim() || null,
    themeKey: scheduleForm.themeKey.trim() || null,
    cancellationReasonCode: scheduleForm.status === "cancelled" ? cancellationForm.cancellationReasonCode : null,
    cancellationReason: scheduleForm.status === "cancelled" ? cancellationForm.cancellationReason : null
  });

  const createStream = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await runMutation("Creating scheduled stream", "/admin/schedule", {
      method: "POST",
      body: buildSchedulePayload()
    });
  };

  const updateStream = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!selectedStream) {
      setMessage("Choose a scheduled stream before saving changes.");
      return;
    }

    await runMutation("Saving scheduled stream", `/admin/schedule/${encodeURIComponent(selectedStream.id)}`, {
      method: "PATCH",
      body: buildSchedulePayload()
    });
  };

  const cancelStream = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!selectedStream) {
      setMessage("Choose a scheduled stream before cancelling.");
      return;
    }

    await runMutation("Cancelling scheduled stream", `/admin/schedule/${encodeURIComponent(selectedStream.id)}/cancel`, {
      method: "POST",
      body: cancellationForm
    });
  };

  return (
    <>
      <header className="project-admin-header">
        <p className="eyebrow">Owner Admin</p>
        <h1>Stream Schedule</h1>
        <p aria-live="polite">{message}</p>
      </header>

      {loadState !== "ready" ? (
        <section className={`project-admin-state ${loadState}`}>
          <h2>{loadState === "loading" ? "Loading" : loadState === "signed-out" ? "Sign In Required" : loadState === "forbidden" ? "Forbidden" : "Unavailable"}</h2>
          <p>{message}</p>
          {loadState !== "loading" ? (
            <button type="button" className="secondary-action" onClick={() => void loadStreams()}>
              Retry
            </button>
          ) : null}
        </section>
      ) : null}

      {loadState === "ready" ? (
        <div className="project-admin-layout">
          <aside className="project-admin-sidebar" aria-label="Scheduled streams">
            <div className="project-admin-sidebar-heading">
              <h2>Streams</h2>
              <button type="button" className="secondary-action" onClick={() => {
                setSelectedStreamId("");
                setScheduleForm(defaultScheduleForm);
                setCancellationForm(defaultCancellationForm);
              }}>
                New
              </button>
            </div>
            {streams.length === 0 ? (
              <p>No scheduled streams yet.</p>
            ) : (
              <div className="project-admin-selector">
                {streams.map((stream) => (
                  <button
                    key={stream.id}
                    type="button"
                    className={stream.id === selectedStreamId ? "selected" : ""}
                    onClick={() => selectStream(stream.id)}
                  >
                    <strong>{stream.title}</strong>
                    <span>{formatScheduleLabel(stream.visibility)} / {formatScheduleLabel(stream.status)}</span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="project-admin-workspace" aria-label="Stream schedule editor">
            <section className="project-admin-panel visibility-panel">
              <div>
                <h2>Public Visibility</h2>
                <p>
                  {selectedStream
                    ? selectedStream.visibility === "public"
                      ? "This scheduled stream can appear on the public schedule."
                      : "This scheduled stream is hidden from the public schedule."
                    : "Create schedule entries as drafts, then mark them public when ready."}
                </p>
              </div>
              {selectedStream ? (
                <div className="project-admin-actions">
                  <a className="button-link secondary-action" href="/schedule">
                    Public Page
                  </a>
                </div>
              ) : null}
            </section>

            <form className="project-admin-panel project-admin-form schedule-admin-form" onSubmit={(event) => selectedStream ? void updateStream(event) : void createStream(event)}>
              <div className="project-admin-panel-heading">
                <h2>{selectedStream ? "Stream Basics" : "Create Stream"}</h2>
                <button type="submit" disabled={busyAction !== null}>
                  {busyAction ? "Saving..." : selectedStream ? "Save Stream" : "Create Stream"}
                </button>
              </div>
              <label>
                Title
                <input value={scheduleForm.title} onChange={(event) => setScheduleForm((current) => ({ ...current, title: event.target.value }))} required maxLength={191} />
              </label>
              <label>
                Description
                <textarea value={scheduleForm.description} onChange={(event) => setScheduleForm((current) => ({ ...current, description: event.target.value }))} maxLength={2000} rows={4} />
              </label>
              <div className="project-admin-form-grid">
                <label>
                  Starts
                  <input type="datetime-local" value={scheduleForm.startsAt} onChange={(event) => setScheduleForm((current) => ({ ...current, startsAt: event.target.value }))} required />
                </label>
                <label>
                  Ends
                  <input type="datetime-local" value={scheduleForm.endsAt} onChange={(event) => setScheduleForm((current) => ({ ...current, endsAt: event.target.value }))} />
                </label>
                <label>
                  Channel
                  <input value={scheduleForm.channelKey} onChange={(event) => setScheduleForm((current) => ({ ...current, channelKey: event.target.value }))} required pattern="[a-z0-9][a-z0-9-]{0,79}" maxLength={80} />
                </label>
                <label>
                  Topic
                  <input value={scheduleForm.topicKey} onChange={(event) => setScheduleForm((current) => ({ ...current, topicKey: event.target.value }))} pattern="[a-z0-9][a-z0-9-]{0,79}" maxLength={80} />
                </label>
                <label>
                  Theme
                  <input value={scheduleForm.themeKey} onChange={(event) => setScheduleForm((current) => ({ ...current, themeKey: event.target.value }))} pattern="[a-z0-9][a-z0-9-]{0,79}" maxLength={80} />
                </label>
                <label>
                  Visibility
                  <select value={scheduleForm.visibility} onChange={(event) => setScheduleForm((current) => ({ ...current, visibility: event.target.value as StreamScheduleVisibility }))}>
                    {visibilities.map((visibility) => <option key={visibility} value={visibility}>{formatScheduleLabel(visibility)}</option>)}
                  </select>
                </label>
                <label>
                  Status
                  <select value={scheduleForm.status} onChange={(event) => setScheduleForm((current) => ({ ...current, status: event.target.value as StreamScheduleStatus }))}>
                    {scheduleForm.status === "cancelled" ? <option value="cancelled">Cancelled</option> : null}
                    {editableStatuses.map((status) => <option key={status} value={status}>{formatScheduleLabel(status)}</option>)}
                  </select>
                </label>
              </div>
            </form>

            {selectedStream ? (
              <form className="project-admin-panel project-admin-form schedule-cancel-form" onSubmit={(event) => void cancelStream(event)}>
                <div className="project-admin-panel-heading">
                  <h2>Cancellation</h2>
                  <button type="submit" disabled={busyAction !== null || selectedStream.status === "cancelled"}>
                    Cancel Stream
                  </button>
                </div>
                <div className="project-admin-form-grid">
                  <label>
                    Reason Template
                    <select value={cancellationForm.cancellationReasonCode} onChange={(event) => setCancellationForm((current) => ({ ...current, cancellationReasonCode: event.target.value as StreamScheduleCancellationReasonCode }))}>
                      {cancellationReasonCodes.map((code) => <option key={code} value={code}>{cancellationReasonLabels[code]}</option>)}
                    </select>
                  </label>
                  <label>
                    Public Reason
                    <textarea value={cancellationForm.cancellationReason} onChange={(event) => setCancellationForm((current) => ({ ...current, cancellationReason: event.target.value }))} required maxLength={500} rows={3} />
                  </label>
                </div>
              </form>
            ) : null}

            <section className="project-admin-panel">
              <h2>Schedule Preview</h2>
              {selectedStream ? (
                <div className={`schedule-admin-preview ${selectedStream.status}`}>
                  <strong>{selectedStream.title}</strong>
                  <span>{formatScheduleDate(selectedStream.startsAt)}</span>
                  {selectedStream.status === "cancelled" ? (
                    <p>Cancelled: {selectedStream.cancellationReason}</p>
                  ) : null}
                </div>
              ) : (
                <p>Choose or create a stream to preview the public wording.</p>
              )}
            </section>

            <section className="project-admin-panel project-admin-note">
              <h2>Deferred</h2>
              <p>Twitch/YouTube scheduling sync, Discord/social announcements, recurrence automation, notifications, AI, money, and moderation stay outside this manual scheduling slice.</p>
            </section>
          </section>
        </div>
      ) : null}
    </>
  );
};

export default StreamScheduleAdminClient;
