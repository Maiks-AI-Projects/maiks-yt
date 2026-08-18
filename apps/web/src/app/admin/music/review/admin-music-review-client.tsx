"use client";

import { type FormEvent, useEffect, useState } from "react";

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

const reviewActions = ["keep", "restrict", "reject", "blacklist"] as const;

const AdminMusicReviewClient = (): React.ReactNode => {
  const [loadState, setLoadState] = useState<MusicAdminLoadState>("loading");
  const [message, setMessage] = useState("Review actions are explicit: keep, restrict, reject, or blacklist.");
  const [overview, setOverview] = useState<MusicAdminOverview>(emptyMusicAdminOverview);

  const refresh = async (): Promise<void> => {
    setLoadState("loading");
    const result = await loadMusicAdminOverview();
    setLoadState(result.loadState);
    setOverview(result.overview);
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

    try {
      const response = await createAdminMusicRecord("/admin/music/blacklist", {
        normalizedValue: stringValue(data, "normalizedValue"),
        providerKey: nullableStringValue(data, "providerKey"),
        reason: stringValue(data, "reason"),
        scope: stringValue(data, "scope"),
        severity: stringValue(data, "severity"),
        sourceId: nullableStringValue(data, "sourceId"),
        trackId: nullableStringValue(data, "trackId")
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
          <TextField name="trackId" label="Track id" />
          <TextField name="sourceId" label="Source id" />
          <TextField name="providerKey" label="Provider key" />
          <SelectField name="severity" label="Severity" options={["temporary", "permanent", "safety", "rights"]} />
          <TextField name="reason" label="Reason" required />
          <button className={styles.primaryButton} type="submit">Add block</button>
        </form>
        <CompactRows
          emptyLabel="No active blacklist entries returned."
          rows={overview.blacklistEntries.map((entry) => ({
            action: entry.revokedAt ? "Revoked" : "Active",
            meta: `${entry.scope} / ${entry.providerKey ?? entry.trackId ?? entry.sourceId ?? "catalog"}`,
            state: entry.severity,
            title: entry.normalizedValue
          }))}
        />
      </section>
    </>
  );
};

export default AdminMusicReviewClient;
