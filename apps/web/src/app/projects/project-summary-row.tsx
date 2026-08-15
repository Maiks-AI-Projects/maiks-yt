import type { PublicProjectSummary } from "@maiks-yt/domain/projects";
import Link from "next/link";

import { formatProjectLabel } from "./project-read-data";
import styles from "./projects.module.css";

type ProjectSummaryRowProps = {
  index: number;
  project: PublicProjectSummary;
};

export const ProjectSummaryRow = ({ index, project }: ProjectSummaryRowProps): React.ReactNode => (
  <article className={styles.projectRow} data-status={project.status}>
    <div className={styles.projectSummary}>
      <div className={styles.projectMeta}>
        <span className={styles.projectNumber} aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span>{formatProjectLabel(project.category)}</span>
        <span className={styles.status}>{formatProjectLabel(project.status)}</span>
      </div>
      <h2><Link href={`/projects/${project.slug}`}>{project.title}</Link></h2>
      <p>{project.summary}</p>
    </div>
    <div className={styles.projectProgress}>
      <div className={styles.milestoneSummary}>
        <span>Current milestone</span>
        <strong>{project.nextMilestone?.title ?? "No active milestone"}</strong>
        {project.nextMilestone?.description ? <p>{project.nextMilestone.description}</p> : null}
      </div>
      <dl className={styles.rowStats}>
        <div><dt>Milestones</dt><dd>{project.milestoneCount}</dd></div>
        <div><dt>Work items</dt><dd>{project.itemCount}</dd></div>
        <div><dt>Updates</dt><dd>{project.updateCount}</dd></div>
      </dl>
    </div>
  </article>
);
