import type { Metadata } from "next";

import styles from "./progress.module.css";
import { platformRoadmap, publicRoadmap } from "./progress-roadmap-data";
import { ProgressRoadmapSection } from "./progress-roadmap-section";

export const metadata: Metadata = {
  title: "Build progress",
  description: "What is being built, what already works, and what comes next for Maiks.yt."
};

const aboutPages = [
  ["Who I am now", "A mostly text-led introduction to Michael, the streams, and why this platform exists.", "/about", "First draft"],
  ["Medical history", "General health context, the effect on streaming, and the approved temporary MRI image.", "/about/health", "First draft"],
  ["Full history", "A long vertical timeline with birth, completed birthdays, privacy-trimmed residence records, and the first streaming event.", "/about/history", "Timeline scaffold"]
] as const;

const ProgressPage = (): React.ReactNode => (
  <main className={styles.page}>
    <header className={styles.intro}>
      <p className={styles.eyebrow}>Work in progress</p>
      <h1>Building Maiks.yt, in public.</h1>
      <p>
        This is the working map for the production website. It separates what is usable now from
        what is being designed and what is still waiting, so unfinished pages never need to pretend
        they are complete.
      </p>
    </header>

    <section className={styles.current} aria-labelledby="progress-current-title">
      <div className={styles.sectionHeading}>
        <p className={styles.eyebrow}>Right now</p>
        <h2 id="progress-current-title">Public pages connected to real data</h2>
      </div>
      <div className={styles.currentBody}>
        <p>
          The schedule, project pages, and game library now use the existing backend instead of
          visual fixtures. Empty pages stay honest, and published records or linked plans will
          appear automatically as Michael adds them.
        </p>
        <div className={styles.activeMarker}>
          <span aria-hidden="true" />
          Production page-by-page pass in progress
        </div>
      </div>
    </section>

    <section className={styles.aboutPlan} id="about" aria-labelledby="progress-about-title">
      <div className={styles.sectionHeading}>
        <p className={styles.eyebrow}>Now available</p>
        <h2 id="progress-about-title">The first About structure is in place</h2>
      </div>
      <ol className={styles.plannedList}>
        {aboutPages.map(([title, description, href, status], index) => (
          <li key={title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h3><a href={href}>{title}</a></h3>
              <p>{description}</p>
            </div>
            <strong>{status}</strong>
          </li>
        ))}
      </ol>
    </section>

    <ProgressRoadmapSection
      description="These are the pages and experiences visitors may eventually use. Working destinations open normally; unfinished destinations open a focused plan that uses this same roadmap data."
      eyebrow="Public roadmap"
      id="public-roadmap-title"
      items={publicRoadmap}
      title="What people will see and use"
    />

    <ProgressRoadmapSection
      description="The backend work is grouped by purpose rather than exposing every table, endpoint, migration, or internal admin screen."
      eyebrow="Platform roadmap"
      id="platform-roadmap-title"
      items={platformRoadmap}
      title="The systems underneath the website"
    />

    <section className={styles.note} aria-labelledby="progress-note-title">
      <p className={styles.eyebrow}>A useful promise</p>
      <h2 id="progress-note-title">An unfinished page should still explain itself.</h2>
      <p>
        Planned destinations now keep their final URL and show a compact description of what will
        be built there. Each one links back to the matching item in this full progress map.
      </p>
    </section>
  </main>
);

export default ProgressPage;
