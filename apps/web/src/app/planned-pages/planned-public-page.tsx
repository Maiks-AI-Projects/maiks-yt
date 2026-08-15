import type { Metadata } from "next";

import { roadmapStatusLabels } from "../progress/roadmap-status-data";
import type { PlannedPublicPageDefinition } from "./planned-public-page-data";
import styles from "./planned-public-page.module.css";

export const createPlannedPublicPageMetadata = (
  definition: PlannedPublicPageDefinition
): Metadata => ({
  title: definition.title,
  description: definition.description
});

type PlannedPublicPageProps = {
  compact?: boolean;
  definition: PlannedPublicPageDefinition;
};

export const PlannedPublicPage = ({ compact = false, definition }: PlannedPublicPageProps): React.ReactNode => (
  <main className={`${styles.page} ${compact ? styles.compact : ""}`}>
    <header className={styles.intro}>
      <span className={styles.status}>{roadmapStatusLabels[definition.status]}</span>
      <p className={styles.eyebrow}>{definition.eyebrow}</p>
      <h1>{definition.title}</h1>
      <p>{definition.description}</p>
    </header>

    <section className={styles.plan} aria-labelledby="planned-page-scope-title">
      <div className={styles.sectionHeading}>
        <p className={styles.eyebrow}>Planned here</p>
        <h2 id="planned-page-scope-title">What this page is intended to contain</h2>
      </div>
      <ol className={styles.featureList}>
        {definition.plannedFeatures.map((feature, index) => (
          <li key={feature}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            {feature}
          </li>
        ))}
      </ol>
    </section>

    <section className={styles.current} aria-labelledby="planned-page-current-title">
      <div className={styles.sectionHeading}>
        <p className={styles.eyebrow}>Current state</p>
        <h2 id="planned-page-current-title">Why this is not the finished page yet</h2>
      </div>
      <div className={styles.currentBody}>
        <p>{definition.currentState}</p>
        <a className={styles.progressLink} href={`/progress#${definition.id}`}>
          View this item in the full build progress &rarr;
        </a>
      </div>
    </section>
  </main>
);
