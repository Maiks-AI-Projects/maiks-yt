import type { Metadata } from "next";
import Image from "next/image";

import { CreatorLinkRow } from "./creator-link-row";
import { getCreatorLinks } from "./creator-links-data";
import styles from "./links.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Creator links",
  description: "Official Maiks.yt channels, community spaces, project pages, and public resources."
};

const LinksPage = async (): Promise<React.ReactNode> => {
  const result = await getCreatorLinks();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.profile}>
          <Image
            alt="Michael"
            className={styles.portrait}
            height={112}
            priority
            src="/images/profiles/michael-profile-portrait.png"
            width={112}
          />
          <p className={styles.eyebrow}>Official creator links</p>
          <h1>Michael / Maiks.yt</h1>
          <p>
            Streams, videos, community spaces, projects, public updates, and account access in one
            place.
          </p>
        </header>

        {result.status === "error" ? (
          <section className={styles.loadState} aria-live="polite">
            <strong>The live link list is temporarily unavailable.</strong>
            <span>No placeholder destinations are being shown. Please try again shortly.</span>
          </section>
        ) : result.links.length === 0 ? (
          <section className={styles.loadState}>
            <strong>No public links have been published yet.</strong>
          </section>
        ) : (
          <section className={styles.directory} aria-label="Michael's official links">
            {result.links.map((link) => <CreatorLinkRow key={link.key} link={link} />)}
          </section>
        )}

        <footer className={styles.note}>
          <span aria-hidden="true">M</span>
          <p>Only destinations published through Maiks.yt are listed here.</p>
        </footer>
      </div>
    </main>
  );
};

export default LinksPage;
