import type { PublicProjectItem } from "@maiks-yt/domain/projects";
import { notFound } from "next/navigation";

import {
  formatProjectLabel,
  getPublicProject
} from "../project-read-data";

type ProjectPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

const ProjectItemList = ({
  items
}: {
  items: readonly PublicProjectItem[];
}): React.ReactNode => (
  <ul className="project-item-list">
    {items.map((item) => (
      <li key={item.id}>
        <div className="project-item-row">
          <span>{formatProjectLabel(item.kind)}</span>
          <strong>{item.title}</strong>
          <em>{formatProjectLabel(item.status)}</em>
          {item.description ? <p>{item.description}</p> : null}
          {item.quantity > 1 ? <small>Quantity: {item.quantity}</small> : null}
        </div>
        {item.children.length > 0 ? <ProjectItemList items={item.children} /> : null}
      </li>
    ))}
  </ul>
);

const ProjectDetailPage = async ({ params }: ProjectPageProps): Promise<React.ReactNode> => {
  const { slug } = await params;
  const result = await getPublicProject(slug);

  if (result.status === "not-found") {
    notFound();
  }

  if (result.status === "error") {
    return (
      <main className="projects-page">
        <section className="project-state-card failed" aria-live="polite">
          <a className="inline-action" href="/projects">Back to projects</a>
          <h1>Project temporarily unavailable</h1>
          <p>The public project API did not respond. Try again after the dev services settle.</p>
        </section>
      </main>
    );
  }

  const { project } = result;

  return (
    <main className="project-detail-page">
      <article className="project-detail">
        <a className="inline-action" href="/projects">Back to projects</a>
        <header className="project-detail-header">
          <p className="eyebrow">{formatProjectLabel(project.category)}</p>
          <h1>{project.title}</h1>
          <p>{project.summary}</p>
          <dl className="project-card-stats">
            <div>
              <dt>Status</dt>
              <dd>{formatProjectLabel(project.status)}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{formatProjectLabel(project.type)}</dd>
            </div>
            <div>
              <dt>Items</dt>
              <dd>{project.itemCount}</dd>
            </div>
          </dl>
        </header>

        <section className="project-detail-section">
          <h2>Milestones</h2>
          {project.milestones.length === 0 ? (
            <p className="project-muted">No public milestones are available yet.</p>
          ) : (
            <ol className="project-milestone-list">
              {project.milestones.map((milestone) => (
                <li key={milestone.id}>
                  <span>{formatProjectLabel(milestone.status)}</span>
                  <strong>{milestone.title}</strong>
                  {milestone.description ? <p>{milestone.description}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="project-detail-section">
          <h2>Project Items</h2>
          {project.items.length === 0 ? (
            <p className="project-muted">No public project items are available yet.</p>
          ) : (
            <ProjectItemList items={project.items} />
          )}
        </section>
      </article>
    </main>
  );
};

export default ProjectDetailPage;
