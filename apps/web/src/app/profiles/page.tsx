import type { Metadata } from "next";

import { ProfileSearchClient } from "./profile-search-client";
import styles from "./profile-search.module.css";

export const metadata: Metadata = {
  title: "Find Profiles | Maiks.yt",
  description: "A static design mock for finding public and private Maiks.yt profiles."
};

const ProfilesPage = (): React.ReactNode => (
  <main className={styles.page}>
    <header className={styles.intro}>
      <div className={styles.mockNotice} role="note" aria-label="Design mock status">
        <strong>Design mock</strong>
        <span>Search is not connected to live accounts yet. Every query returns two static Michael profile examples.</span>
      </div>
      <p className={styles.eyebrow}>Community profiles</p>
      <h1>Find a profile</h1>
      <p>Search by public name, channel identity, provider account, or verified in-game name.</p>
    </header>
    <section className={styles.searchArea} aria-label="Profile search mock">
      <ProfileSearchClient />
    </section>
  </main>
);

export default ProfilesPage;
