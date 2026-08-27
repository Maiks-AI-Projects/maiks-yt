import type { Metadata } from "next";

import { contextEntries } from "./context-entry-data";
import styles from "./context.module.css";

export const metadata: Metadata = {
  title: "Stream context",
  description: "Short explanations for recurring references heard on Michael's streams."
};

const ContextPage = (): React.ReactNode => (
  <main className={styles.page}>
    <header className={styles.intro}>
      <p className={styles.eyebrow}>Stream context</p>
      <h1>Things that may need an explanation.</h1>
      <p>
        Short background for recurring names, phrases, plans, and references heard on stream. Bot
        commands can link directly to an entry without interrupting the conversation with the full
        story.
      </p>
    </header>

    <section className={styles.index} aria-labelledby="context-index-heading">
      <header className={styles.indexHeading}>
        <h2 id="context-index-heading">Context index</h2>
        <p>Entries are kept alphabetical. Direct links use the entry name after the # symbol.</p>
      </header>

      <ol className={styles.entryList}>
        {contextEntries.map((entry, index) => (
          <li className={styles.entry} id={entry.id} key={entry.id}>
            <span className={styles.entryNumber} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <a className={styles.entryTitle} href={`#${entry.id}`}>
              {entry.title}
            </a>
            <div className={styles.entryContent}>
              <p>{entry.description}</p>
              {entry.relatedLinks ? (
                <nav className={styles.relatedLinks} aria-label={`Related to ${entry.title}`}>
                  {entry.relatedLinks.map((link) => (
                    <a href={link.href} key={link.href}>{link.label} &rarr;</a>
                  ))}
                </nav>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  </main>
);

export default ContextPage;
