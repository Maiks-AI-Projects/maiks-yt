import styles from "./progress.module.css";
import type { RoadmapItem } from "./progress-roadmap-data";
import { roadmapStatusLabels } from "./roadmap-status-data";

type ProgressRoadmapSectionProps = {
  description: string;
  eyebrow: string;
  id: string;
  items: readonly RoadmapItem[];
  title: string;
};

export const ProgressRoadmapSection = ({
  description,
  eyebrow,
  id,
  items,
  title
}: ProgressRoadmapSectionProps): React.ReactNode => (
  <section className={styles.roadmapSection} aria-labelledby={id}>
    <div className={styles.roadmapHeading}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      <p>{description}</p>
    </div>
    <div className={styles.roadmapList}>
      {items.map((item) => {
        const content = (
          <>
            <div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
            <span className={styles.status} data-status={item.status}>
              {roadmapStatusLabels[item.status]}
            </span>
          </>
        );

        return item.href ? (
          <a href={item.href} id={item.id} key={item.title}>{content}</a>
        ) : (
          <article id={item.id} key={item.title}>{content}</article>
        );
      })}
    </div>
  </section>
);
