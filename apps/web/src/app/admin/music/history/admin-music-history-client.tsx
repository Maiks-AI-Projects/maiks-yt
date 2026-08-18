"use client";

import { useEffect, useState } from "react";

import { captureDevAuthTokenFromUrl } from "../../../dev-auth-token";
import type { MusicAdminOverview } from "../../../music/music-api.types";
import styles from "../../../music/music.module.css";
import {
  emptyMusicAdminOverview,
  formatAdminMusicDate,
  loadMusicAdminOverview,
  type MusicAdminLoadState
} from "../admin-music-data.service";
import {
  CompactRows,
  MusicAdminHeader,
  MusicAdminStatus
} from "../admin-music-shared";

const AdminMusicHistoryClient = (): React.ReactNode => {
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
        description="Recent playback outcomes, source snapshots, and visibility state."
        title="Music History"
      />
      <MusicAdminStatus
        countLabel={`${overview.playHistory.length} history rows`}
        loadState={loadState}
        message="Read-only recent play history from the music API."
        onRefresh={() => void refresh()}
      />
      <section className={styles.adminSection}>
        <h2>Recent Plays</h2>
        <CompactRows
          emptyLabel="No play history returned."
          rows={overview.playHistory.map((history) => ({
            action: history.publicVisible ? "Public" : "Private",
            meta: `${history.artistSnapshot} / ${history.providerKeySnapshot} / ${formatAdminMusicDate(history.startedAt)}`,
            state: history.outcome,
            title: history.titleSnapshot
          }))}
        />
      </section>
    </>
  );
};

export default AdminMusicHistoryClient;
