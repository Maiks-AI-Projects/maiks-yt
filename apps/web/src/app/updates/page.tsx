import { createDateFormatter, defaultLocale } from "@maiks-yt/config";
import {
  formatPublicUpdateKind,
  getPublicUpdates,
  getPublicUpdateUrl
} from "./public-update-data";
import styles from "./updates.module.css";

export const dynamic = "force-dynamic";

const dateFormatter = createDateFormatter(defaultLocale);

const UpdatesPage = async (): Promise<React.ReactNode> => {
  const result = await getPublicUpdates();

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Posts, recaps, and announcements</p>
        <h1>Context that does not disappear down a timeline.</h1>
        <p>
          Longer notes about streams, projects, and changes around Maiks.yt. Early example
          records are labelled clearly while this part of the site is being built.
        </p>
      </header>

      <section className={styles.updateSection} aria-labelledby="latest-updates-heading">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionLabel}>Public record</p>
            <h2 id="latest-updates-heading">Latest updates</h2>
          </div>
          <p>
            Announcements, ordinary posts, and stream recaps share one public archive and
            one RSS feed.
          </p>
        </div>

        {result.status === "error" ? (
          <div className={styles.inlineState}>
            <h3>Updates are temporarily unavailable.</h3>
            <p>The website could not reach the updates service. Nothing has been substituted.</p>
          </div>
        ) : result.updates.length === 0 ? (
          <div className={styles.inlineState}>
            <h3>No public updates yet.</h3>
            <p>Published posts, recaps, and announcements will appear here.</p>
          </div>
        ) : (
          <div className={styles.updateList}>
            {result.updates.map((update, index) => (
              <article className={styles.updateRow} key={update.id}>
                <span className={styles.number} aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className={styles.updateTitle}>
                  <p className={styles.kind}>{formatPublicUpdateKind(update.kind)}</p>
                  <h3>
                    <a href={getPublicUpdateUrl(update)}>{update.title}</a>
                  </h3>
                </div>
                <p className={styles.updateSummary}>{update.summary}</p>
                <div className={styles.updateMeta}>
                  <time dateTime={update.publishedAt}>
                    {dateFormatter.format(new Date(update.publishedAt))}
                  </time>
                  {update.isPinned ? <span className={styles.pinned}>Pinned</span> : null}
                  {update.isExample ? <span className={styles.example}>Example</span> : null}
                </div>
              </article>
            ))}
          </div>
        )}

        <a className={styles.rssLink} href="/feed.xml">Follow through RSS</a>
      </section>
    </main>
  );
};

export default UpdatesPage;
