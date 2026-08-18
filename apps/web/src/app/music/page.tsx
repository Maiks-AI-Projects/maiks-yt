import type { Metadata } from "next";

import MusicPublicClient from "./music-public-client";
import styles from "./music.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Music Requests | Maiks.yt",
  description: "Search stream-safe catalog tracks, preview clips, and request one for a stream."
};

const MusicPage = (): React.ReactNode => (
  <main className={styles.page}>
    <header className={styles.header}>
      <p className={styles.eyebrow}>Stream-safe music</p>
      <h1>Music requests</h1>
      <p>
        Search eligible catalog tracks, check the attribution cue, preview the available clip,
        and send one free request when the request gate is open.
      </p>
    </header>

    <MusicPublicClient />
  </main>
);

export default MusicPage;
