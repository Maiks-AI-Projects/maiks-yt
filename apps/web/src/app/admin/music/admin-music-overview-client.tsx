"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { captureDevAuthTokenFromUrl } from "../../dev-auth-token";
import type { MusicAdminOverview } from "../../music/music-api.types";
import styles from "../../music/music.module.css";
import {
  emptyMusicAdminOverview,
  loadMusicAdminOverview,
  type MusicAdminLoadState
} from "./admin-music-data.service";
import { MusicAdminHeader, MusicAdminStatus } from "./admin-music-shared";

const taskLinks = [
  { href: "/admin/music/catalog", label: "Catalog", text: "Provider policy plus track, source, and license authoring." },
  { href: "/admin/music/playlists", label: "Playlists", text: "Playlist records and membership counts." },
  { href: "/admin/music/review", label: "Review", text: "Queue decisions plus active blacklist blocks." },
  { href: "/admin/music/history", label: "History", text: "Recent playback outcomes and source snapshots." }
] as const;

const AdminMusicOverviewClient = (): React.ReactNode => {
  const [loadState, setLoadState] = useState<MusicAdminLoadState>("loading");
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

  return (
    <>
      <MusicAdminHeader
        description="Compact entry point for music catalog, playlist, review, and playback-history operations."
        title="Music"
      />

      <MusicAdminStatus
        countLabel={`${overview.tracks.length} tracks / ${overview.reviewQueue.length} review items`}
        loadState={loadState}
        message="Use the focused sections below for music operations."
        onRefresh={() => void refresh()}
      />

      <section className={styles.surface}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Tasks</h2>
            <p>Each route owns one music workflow.</p>
          </div>
        </div>
        <div className={styles.compactGrid}>
          {taskLinks.map((task) => (
            <Link className={styles.taskLink} href={task.href} key={task.href}>
              <strong>{task.label}</strong>
              <span>{task.text}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.surface}>
        <div className={styles.compactGrid}>
          <span className={styles.badge}>{overview.providerPolicies.length} provider policies</span>
          <span className={styles.badge}>{overview.playlists.length} playlists</span>
          <span className={styles.badge}>{overview.blacklistEntries.length} blacklist entries</span>
          <span className={styles.badge}>{overview.playHistory.length} history rows</span>
        </div>
      </section>
    </>
  );
};

export default AdminMusicOverviewClient;
