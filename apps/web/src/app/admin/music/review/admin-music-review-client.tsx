"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { captureDevAuthTokenFromUrl } from "../../../dev-auth-token";
import {
  createAdminMusicRecord,
  resolveMusicReviewQueueItem
} from "../../../music/music-api.service";
import type {
  MusicAdminOverview,
  MusicReviewAction
} from "../../../music/music-api.types";
import styles from "../../../music/music.module.css";
import {
  emptyMusicAdminOverview,
  loadMusicAdminOverview,
  nullableStringValue,
  stringValue,
  type MusicAdminLoadState
} from "../admin-music-data.service";
import {
  CompactRows,
  MusicAdminHeader,
  MusicAdminStatus,
  SelectField,
  TextField
} from "../admin-music-shared";
import {
  buildReviewBlacklistRow,
  buildReviewSelectionPayload,
  buildReviewSourceOptions,
  buildReviewTrackOptions,
  findReviewSource,
  getReviewSelectionStateMessage,
  sourceSelectionUnavailableMessage,
  trackSelectionUnavailableMessage
} from "./admin-music-review-selection.rules";

const reviewActions = ["keep", "restrict", "reject", "blacklist"] as const;

const AdminMusicReviewClient = (): React.ReactNode => {
  const [loadState, setLoadState] = useState<MusicAdminLoadState>("loading");
  const [message, setMessage] = useState("Review actions are explicit: keep, restrict, reject, or blacklist.");
  const [overview, setOverview] = useState<MusicAdminOverview>(emptyMusicAdminOverview);
  const [selectedBlacklistSourceId, setSelectedBlacklistSourceId] = useState<string | null>(null);
  const [selectedBlacklistTrackId, setSelectedBlacklistTrackId] = useState<string | null>(null);
  const refreshGeneration = useRef(0);
  const reviewTrackOptions = useMemo(() => buildReviewTrackOptions(overview.tracks), [overview.tracks]);
  const reviewSourceOptions = useMemo(
    () => buildReviewSourceOptions(overview.tracks, selectedBlacklistTrackId),
    [overview.tracks, selectedBlacklistTrackId]
  );
  const reviewSelectionStateMessage = getReviewSelectionStateMessage(loadState);
  const selectedTrackReturned = selectedBlacklistTrackId
    ? reviewTrackOptions.some((track) => track.id === selectedBlacklistTrackId)
    : true;
  const selectedSourceReturned = selectedBlacklistSourceId
    ? reviewSourceOptions.some((source) => source.id === selectedBlacklistSourceId)
    : true;

  const refresh = async (): Promise<void> => {
    const generation = refreshGeneration.current + 1;
    refreshGeneration.current = generation;
    setLoadState("loading");
    const result = await loadMusicAdminOverview();

    if (generation !== refreshGeneration.current) {
      return;
    }

    setLoadState(result.loadState);

    if (result.loadState === "ready") {
      setOverview(result.overview);
      return;
    }

    if (result.loadState === "signed-out" || result.loadState === "forbidden") {
      setOverview(emptyMusicAdminOverview);
      setSelectedBlacklistSourceId(null);
      setSelectedBlacklistTrackId(null);
    }
  };

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void refresh();
  }, []);

  const reviewQueueItem = async (id: string, action: MusicReviewAction): Promise<void> => {
    setMessage(`Marking review item ${action}...`);
    try {
      const response = await resolveMusicReviewQueueItem(id, action, null);

      if (!response.payload.ok) {
        setMessage(`Review action blocked: ${response.payload.reason}`);
        return;
      }

      setMessage(`Review item marked ${action}.`);
      await refresh();
    } catch {
      setMessage("Review action failed.");
    }
  };

  const submitBlacklist = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setMessage("Saving blacklist entry...");
    const data = new FormData(event.currentTarget);
    const selection = buildReviewSelectionPayload(
      overview.tracks,
      stringValue(data, "scope"),
      selectedBlacklistTrackId,
      selectedBlacklistSourceId,
      loadState === "ready"
    );

    if (!selection.ok) {
      setMessage(selection.reason);
      return;
    }

    try {
      const response = await createAdminMusicRecord("/admin/music/blacklist", {
        normalizedValue: stringValue(data, "normalizedValue"),
        providerKey: nullableStringValue(data, "providerKey"),
        reason: stringValue(data, "reason"),
        scope: stringValue(data, "scope"),
        severity: stringValue(data, "severity"),
        sourceId: selection.sourceId,
        trackId: selection.trackId
      });

      if (!response.payload.ok) {
        setMessage(`Blacklist save blocked: ${response.payload.reason}`);
        return;
      }

      setMessage("Blacklist entry saved.");
      await refresh();
    } catch {
      setMessage("Blacklist save failed.");
    }
  };

  const updateBlacklistTrackSelection = (trackId: string | null): void => {
    setSelectedBlacklistTrackId(trackId);

    if (!trackId) {
      setSelectedBlacklistSourceId(null);
      return;
    }

    if (!selectedBlacklistSourceId) {
      return;
    }

    const selectedSource = findReviewSource(overview.tracks, selectedBlacklistSourceId);

    if (selectedSource?.trackId !== trackId) {
      setSelectedBlacklistSourceId(null);
    }
  };

  const updateBlacklistSourceSelection = (sourceId: string | null): void => {
    setSelectedBlacklistSourceId(sourceId);

    const selectedSource = findReviewSource(overview.tracks, sourceId);

    if (selectedSource) {
      setSelectedBlacklistTrackId(selectedSource.trackId);
    }
  };

  return (
    <>
      <MusicAdminHeader
        description="Resolve queued music decisions and maintain explicit blacklist entries."
        title="Music Review"
      />
      <MusicAdminStatus
        countLabel={`${overview.reviewQueue.length} review items / ${overview.blacklistEntries.length} blacklist entries`}
        loadState={loadState}
        message={message}
        onRefresh={() => void refresh()}
      />
      <section className={styles.adminSection}>
        <h2>Review Queue</h2>
        {overview.reviewQueue.length === 0 ? (
          <p className={styles.emptyState}>No review queue items returned.</p>
        ) : overview.reviewQueue.map((item) => (
          <div className={styles.rankRow} key={item.id}>
            <span className={styles.rankNumber}>{item.priority}</span>
            <span className={styles.rowTitle}>
              <strong>{item.summary}</strong>
              <span>{item.queueKind} / {item.reasonCode} / {item.status}</span>
            </span>
            <span className={styles.rowActions}>
              {reviewActions.map((action) => (
                <button
                  className={action === "keep" ? styles.primaryButton : styles.textButton}
                  key={action}
                  onClick={() => void reviewQueueItem(item.id, action)}
                  type="button"
                >
                  {action[0]?.toUpperCase()}{action.slice(1)}
                </button>
              ))}
            </span>
          </div>
        ))}
      </section>
      <section className={styles.adminSection}>
        <h2>Blacklist</h2>
        <form className={styles.formGrid} onSubmit={(event) => void submitBlacklist(event)}>
          <SelectField name="scope" label="Scope" options={["track", "source", "artist", "provider", "external_id", "keyword"]} />
          <TextField name="normalizedValue" label="Value" required />
          <label className={styles.compactSelect}>
            <span>Track</span>
            <select
              disabled={loadState !== "ready" || (reviewTrackOptions.length === 0 && !selectedBlacklistTrackId)}
              onChange={(event) => updateBlacklistTrackSelection(event.currentTarget.value || null)}
              value={selectedBlacklistTrackId ?? ""}
            >
              <option value="">No track selected</option>
              {!selectedTrackReturned && selectedBlacklistTrackId ? (
                <option value={selectedBlacklistTrackId}>{trackSelectionUnavailableMessage}</option>
              ) : null}
              {reviewTrackOptions.map((track) => (
                <option key={track.id} value={track.id}>{track.label}</option>
              ))}
            </select>
            {reviewSelectionStateMessage || reviewTrackOptions.length === 0 ? (
              <span>{reviewSelectionStateMessage ?? "No catalog tracks returned."}</span>
            ) : null}
            {!selectedTrackReturned ? <span>{trackSelectionUnavailableMessage}</span> : null}
          </label>
          <label className={styles.compactSelect}>
            <span>Source</span>
            <select
              disabled={loadState !== "ready" || (reviewSourceOptions.length === 0 && !selectedBlacklistSourceId)}
              onChange={(event) => updateBlacklistSourceSelection(event.currentTarget.value || null)}
              value={selectedBlacklistSourceId ?? ""}
            >
              <option value="">No source selected</option>
              {!selectedSourceReturned && selectedBlacklistSourceId ? (
                <option value={selectedBlacklistSourceId}>{sourceSelectionUnavailableMessage}</option>
              ) : null}
              {reviewSourceOptions.map((source) => (
                <option key={source.id} value={source.id}>{source.label}</option>
              ))}
            </select>
            {reviewSelectionStateMessage || reviewSourceOptions.length === 0 ? (
              <span>{reviewSelectionStateMessage ?? "No matching sources returned."}</span>
            ) : null}
            {!selectedSourceReturned ? <span>{sourceSelectionUnavailableMessage}</span> : null}
          </label>
          <TextField name="providerKey" label="Provider key" />
          <SelectField name="severity" label="Severity" options={["temporary", "permanent", "safety", "rights"]} />
          <TextField name="reason" label="Reason" required />
          <button className={styles.primaryButton} type="submit">Add block</button>
        </form>
        <CompactRows
          emptyLabel="No active blacklist entries returned."
          rows={overview.blacklistEntries.map((entry) => buildReviewBlacklistRow(entry, overview.tracks))}
        />
      </section>
    </>
  );
};

export default AdminMusicReviewClient;
