import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectItemList } from "../project-item-list";
import { getPublicProjectMilestoneKey, getPublicProjectUpdateKey } from "../project-public-keys.rules";
import { formatProjectLabel, getPublicProject } from "../project-read-data";
import styles from "../projects.module.css";

type ProjectPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Project",
  description: "A public Maiks.yt project with milestones, work items, and updates."
};

const formatPublishedDate = (value: string): string =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "Europe/Amsterdam"
  }).format(new Date(value));

const ProjectDetailPage = async ({ params }: ProjectPageProps): Promise<React.ReactNode> => {
  const { slug } = await params;
  const result = await getPublicProject(slug);

  if (result.status === "not-found") {
    notFound();
  }

  if (result.status === "error") {
    return (
      <main className={styles.page}>
        <section className={styles.stateBand} aria-live="polite">
          <p className={styles.eyebrow}>Temporarily unavailable</p>
          <h1>Project could not be loaded.</h1>
          <p>The projects service did not respond. Try returning to the project list.</p>
          <Link className={styles.backLink} href="/projects">Back to projects</Link>
        </section>
      </main>
    );
  }

  const { project } = result;

  return (
    <main className={styles.page}>
      <header className={styles.detailHeader}>
        <Link className={styles.backLink} href="/projects">Back to all projects</Link>
        <div className={styles.detailMeta}>
          <span>{formatProjectLabel(project.category)}</span>
          <span>{formatProjectLabel(project.status)}</span>
        </div>
        <h1>{project.title}</h1>
        <p className={styles.detailSummary}>{project.summary}</p>
        <dl className={styles.detailStats}>
          <div><dt>Type</dt><dd>{formatProjectLabel(project.type)}</dd></div>
          <div><dt>Milestones</dt><dd>{project.milestoneCount}</dd></div>
          <div><dt>Work items</dt><dd>{project.itemCount}</dd></div>
          <div><dt>Updates</dt><dd>{project.updateCount}</dd></div>
        </dl>
      </header>

      <section className={styles.detailSection} aria-labelledby="milestones-title">
        <p className={styles.sectionLabel}>Progress</p>
        <h2 id="milestones-title">Milestones</h2>
        {project.milestones.length === 0 ? (
          <p className={styles.emptyCopy}>No public milestones are available yet.</p>
        ) : (
          <ol className={styles.milestoneList}>
            {project.milestones.map((milestone, index) => (
              <li className={styles.milestone} key={getPublicProjectMilestoneKey(project.slug, milestone, index)}>
                <div className={styles.milestoneHeader}>
                  <strong>{milestone.title}</strong>
                  <span>{formatProjectLabel(milestone.status)}</span>
                </div>
                {milestone.description ? <p>{milestone.description}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={styles.detailSection} aria-labelledby="items-title">
        <p className={styles.sectionLabel}>The work</p>
        <h2 id="items-title">Project items</h2>
        {project.items.length === 0 ? (
          <p className={styles.emptyCopy}>No public work items are available yet.</p>
        ) : (
          <ProjectItemList items={project.items} />
        )}
      </section>

      <section className={styles.detailSection} aria-labelledby="updates-title">
        <p className={styles.sectionLabel}>Public record</p>
        <h2 id="updates-title">Updates</h2>
        {project.updates.length === 0 ? (
          <p className={styles.emptyCopy}>No public updates have been published yet.</p>
        ) : (
          <ol className={styles.updateList}>
            {project.updates.map((update, index) => (
              <li className={styles.update} key={getPublicProjectUpdateKey(project.slug, update, index)}>
                <div className={styles.updateHeader}>
                  <div>
                    {update.isPinned ? <span className={styles.updateBadge}>Pinned update</span> : null}
                    <strong>{update.title}</strong>
                  </div>
                  {update.publishedAt ? (
                    <time dateTime={update.publishedAt}>{formatPublishedDate(update.publishedAt)}</time>
                  ) : null}
                </div>
                {update.summary ? <p>{update.summary}</p> : null}
                <p>{update.body}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
};

export default ProjectDetailPage;
