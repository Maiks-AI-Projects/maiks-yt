import styles from "../home.module.css";

export const HomeHero = (): React.ReactNode => (
  <section className={styles.hero} aria-labelledby="home-title">
    <div className={styles.heroInner}>
      <p className={styles.eyebrow}>Michael's independent creator platform</p>
      <h1 id="home-title">Maiks.yt</h1>
      <p className={styles.heroCopy}>
        Streams, software projects, community experiments, and the honest work behind all of them,
        kept together in one place I control.
      </p>
      <div className={styles.heroActions}>
        <a className={`${styles.button} ${styles.buttonPrimary}`} href="#current-signal">
          See what's happening <span aria-hidden="true">↓</span>
        </a>
        <a className={`${styles.button} ${styles.buttonSecondary}`} href="/projects">
          Explore the projects
        </a>
      </div>
      <div className={styles.heroStatus} aria-label="Current status">
        <span className={styles.statusItem}>
          <span className={`${styles.statusDot} ${styles.statusWaiting}`} aria-hidden="true" />
          Next stream is being scheduled
        </span>
        <a className={styles.statusItem} href="/progress">
          <span className={`${styles.statusDot} ${styles.statusBuilding}`} aria-hidden="true" />
          Maiks.yt is actively being built
        </a>
      </div>
    </div>
  </section>
);
