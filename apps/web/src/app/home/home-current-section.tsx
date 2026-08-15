import styles from "../home.module.css";

export const HomeCurrentSection = (): React.ReactNode => (
  <section className={styles.band} id="current-signal" aria-labelledby="current-signal-title">
    <div className={styles.bandInner}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Current signal</p>
          <h2 id="current-signal-title">What I'm working on now.</h2>
        </div>
        <p>
          This site is being built in public. Finished work, active work, and uncertain plans are
          labelled differently so progress stays honest.
        </p>
      </div>
      <div className={styles.currentGrid}>
        <article className={styles.projectFeature}>
          <span className={styles.projectIndex}>01</span>
          <div>
            <h3>Building the Maiks.yt platform</h3>
            <p>
              The stream website, control tools, community system, projects, and transparent
              accounting are becoming one shared platform instead of disconnected services.
            </p>
            <a className={styles.inlineLink} href="/projects">Open the projects →</a>
          </div>
        </article>
        <aside className={styles.schedulePanel} aria-labelledby="home-schedule-title">
          <p className={styles.eyebrow}>Up next</p>
          <h3 id="home-schedule-title">No date published yet</h3>
          <p>The next stream will appear here as soon as it is scheduled. No invented countdowns.</p>
          <a className={styles.scheduleLink} href="/schedule">View the schedule</a>
        </aside>
      </div>
    </div>
  </section>
);
