import type { Metadata } from "next";

import { getPublicProjects } from "./project-read-data";
import { ProjectSummaryRow } from "./project-summary-row";
import styles from "./projects.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Projects and milestones",
  description: "Public Maiks.yt projects, current milestones, work items, and progress updates."
};

const ProjectsPage = async (): Promise<React.ReactNode> => {
  const result = await getPublicProjects();

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Projects and milestones</p>
        <h1>Work in public, one milestone at a time.</h1>
        <p>
          These are the projects currently shaping Maiks.yt, including what is active, what comes
          next, and the work that has already been completed.
        </p>
      </header>

      {result.status === "error" ? (
        <section className={styles.stateBand} aria-live="polite">
          <p className={styles.eyebrow}>Temporarily unavailable</p>
          <h2>Projects could not be loaded.</h2>
          <p>Please try again shortly.</p>
        </section>
      ) : result.projects.length === 0 ? (
        <section className={styles.stateBand}>
          <p className={styles.eyebrow}>Nothing published yet</p>
          <h2>No public projects are available.</h2>
          <p>Projects will appear here after they are published and made visible.</p>
        </section>
      ) : (
        <section className={styles.projectSection} aria-labelledby="project-list-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionLabel}>Current work</p>
              <h2 id="project-list-title">Public projects</h2>
            </div>
            <p>
              Each project keeps its current milestone visible. Open one for its updates, work
              items, references, and the fuller record behind the summary.
            </p>
          </div>
          <div className={styles.projectList}>
            {result.projects.map((project, index) => (
              <ProjectSummaryRow index={index} key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
};

export default ProjectsPage;
