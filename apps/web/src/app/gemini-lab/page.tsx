import styles from "./gemini-lab.module.css";
import { labThemes } from "./lab-data";

const GeminiLabIndexPage = (): React.ReactNode => (
  <main
    className={styles.shell}
    style={{
      "--lab-bg": "#f5f7fb",
      "--lab-fg": "#141920",
      "--lab-muted": "#5a6570",
      "--lab-panel": "#ffffff",
      "--lab-accent": "#2f6fed"
    } as React.CSSProperties}
  >
    <div className={styles.inner}>
      <nav className={styles.nav}>
        <strong>Gemini Layout Lab</strong>
        <a className={styles.pill} href="/">Back to web home</a>
      </nav>
      <section className={styles.hero}>
        <div>
          <h1>Safe pages for layout experiments</h1>
          <p>
            These pages use fake data and isolated styling so layout work can happen without touching auth,
            payments, database logic, deployment config, or real user data.
          </p>
        </div>
        <aside className={styles.panel}>
          <h2>Rules</h2>
          <p className={styles.muted}>Only edit files inside apps/web/src/app/gemini-lab for visual drafts.</p>
          <p className={styles.muted}>Keep pages static, reviewable, and easy to delete.</p>
        </aside>
      </section>
      <section className={styles.grid}>
        {labThemes.map((theme) => (
          <a
            className={styles.panel}
            href={`/gemini-lab/${theme.slug}`}
            key={theme.slug}
            style={{
              "--lab-accent": theme.tokens.accent
            } as React.CSSProperties}
          >
            <h2>{theme.title}</h2>
            <p className={styles.muted}>{theme.subtitle}</p>
          </a>
        ))}
      </section>
    </div>
  </main>
);

export default GeminiLabIndexPage;
