import styles from "../home.module.css";

const paths = [
  {
    index: "01 / Watch",
    title: "Streams and schedule",
    description: "Upcoming streams, changes, local times, and the project or game each stream is focused on.",
    action: "View schedule →",
    href: "/schedule"
  },
  {
    index: "02 / Follow",
    title: "Projects and updates",
    description: "Milestones, progress, blockers, and decisions without pretending unfinished work is complete.",
    action: "Browse projects →",
    href: "/projects"
  },
  {
    index: "03 / Join",
    title: "Community and links",
    description: "Find the official channels, participate without forced signup, or create an account for more interaction.",
    action: "Find the community →",
    href: "/links"
  }
] as const;

export const HomePathsSection = (): React.ReactNode => (
  <section className={`${styles.band} ${styles.pathsBand}`} aria-labelledby="home-paths-title">
    <div className={styles.bandInner}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Choose a path</p>
          <h2 id="home-paths-title">Start with what matters to you.</h2>
        </div>
        <p>You do not need an account to watch, read project updates, or understand what is happening.</p>
      </div>
      <div className={styles.pathGrid}>
        {paths.map((path) => (
          <a className={styles.path} href={path.href} key={path.href}>
            <span className={styles.pathNumber}>{path.index}</span>
            <strong>{path.title}</strong>
            <p>{path.description}</p>
            <span className={styles.pathAction}>{path.action}</span>
          </a>
        ))}
      </div>
    </div>
  </section>
);
