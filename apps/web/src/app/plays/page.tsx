import type { Metadata } from "next";

import { getCreatorLinks } from "../links/creator-links-data";
import { getMaiksPlaysLinkSlot, type MaiksPlaysLinkSlot } from "./maiksplays-link-data";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MaiksPlays",
  description:
    "A Maiks.yt channel page for the games Michael enjoys that do not fit an existing dedicated channel."
};

type MaiksPlaysPageContentProps = {
  linkSlot: MaiksPlaysLinkSlot;
};

export const MaiksPlaysPageContent = ({
  linkSlot
}: MaiksPlaysPageContentProps): React.ReactNode => (
  <main className={styles.page}>
    <header className={styles.intro}>
      <p className={styles.eyebrow}>MaiksPlays</p>
      <h1>Games that do not need their own channel.</h1>
      <p className={styles.lead}>
        MaiksPlays is where I put games I enjoy when they do not fit one of the dedicated channels.
        It keeps the side projects from turning every other place into one mixed drawer.
      </p>
    </header>

    <section className={styles.section} aria-labelledby="plays-belongs-heading">
      <div>
        <p className={styles.sectionLabel}>What belongs here</p>
        <h2 id="plays-belongs-heading">Good games with no awkward home.</h2>
      </div>
      <div className={styles.copy}>
        <p>
          Some games are worth streaming or recording, but not worth creating a whole separate
          channel around. Those can live here without pretending they are the main thing forever.
        </p>
        <p>
          That makes MaiksPlays useful for one-off runs, smaller series, experiments, and games I
          keep coming back to when they do not match a more specific destination.
        </p>
      </div>
    </section>

    <section className={styles.section} aria-labelledby="plays-dedicated-heading">
      <div>
        <p className={styles.sectionLabel}>Dedicated channels</p>
        <h2 id="plays-dedicated-heading">The specific channels still matter.</h2>
      </div>
      <div className={styles.copy}>
        <p>
          Dedicated channels are still active homes for games or subjects that already have a clear
          place. MaiksPlays is not here to replace them.
        </p>
        <p>
          If a game fits one of those channels, I will keep using the better home for it. If it
          does not, MaiksPlays gives it somewhere honest to land.
        </p>
      </div>
    </section>

    <section className={styles.section} aria-labelledby="plays-routing-heading">
      <div>
        <p className={styles.sectionLabel}>Later routing</p>
        <h2 id="plays-routing-heading">Simulcasting may happen later.</h2>
      </div>
      <div className={styles.copy}>
        <p>
          Later, I may send the same stream to MaiksPlays and the relevant dedicated channel when
          that makes sense. I am not promising that yet.
        </p>
        <p>
          The current connection is not something I trust for multiple outgoing streams. Fiber
          repairs or a second connection may change that, so this note is deliberately short.
        </p>
      </div>
    </section>

    <section className={styles.linksSection} aria-labelledby="plays-links-heading">
      <div>
        <p className={styles.sectionLabel}>Follow</p>
        <h2 id="plays-links-heading">Current MaiksPlays links.</h2>
      </div>
      <div className={styles.copy}>
        {linkSlot.status === "available" ? (
          <ul className={styles.linkList} aria-label="Current MaiksPlays links">
            {linkSlot.links.map((link, index) => (
              <li key={link.href}>
                <div>
                  <p className={styles.linkMeta}>{String(index + 1).padStart(2, "0")}</p>
                  <h3>{link.title}</h3>
                </div>
                <p>{link.description}</p>
                <a href={link.href} rel="noreferrer" target="_blank">Open link</a>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.unavailable} aria-live="polite">
            <strong>MaiksPlays follow links are not available here right now.</strong>
            <p>
              That usually means they are unpublished or the live creator-link list could not be
              read. I will only show destinations the site can verify.
            </p>
          </div>
        )}
      </div>
    </section>
  </main>
);

const MaiksPlaysPage = async (): Promise<React.ReactNode> => {
  const creatorLinks = await getCreatorLinks();
  const linkSlot = getMaiksPlaysLinkSlot(creatorLinks);

  return <MaiksPlaysPageContent linkSlot={linkSlot} />;
};

export default MaiksPlaysPage;
