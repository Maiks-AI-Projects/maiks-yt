import {
  formatProjectLabel,
  getPublicProjects
} from "./project-read-data";

export const dynamic = "force-dynamic";

const ProjectsPage = async (): Promise<React.ReactNode> => {
  const result = await getPublicProjects();

  return (
    <main className="projects-page">
      <header className="projects-header">
        <p className="eyebrow">Projects</p>
        <h1>Projects and Milestones</h1>
        <p>Public work plans, stream arcs, and build logs without funding or support actions attached.</p>
      </header>

      {result.status === "error" ? (
        <section className="project-state-card failed" aria-live="polite">
          <h2>Projects are temporarily unavailable</h2>
          <p>The public project API did not respond. Try again after the dev services settle.</p>
        </section>
      ) : result.projects.length === 0 ? (
        <section className="project-state-card empty">
          <h2>No public projects yet</h2>
          <p>Projects will appear here after they are marked public and available.</p>
        </section>
      ) : (
        <section className="project-list" aria-label="Public projects">
          {result.projects.map((project) => (
            <article className="project-card" key={project.slug}>
              <div className="project-card-meta">
                <span>{formatProjectLabel(project.category)}</span>
                <span>{formatProjectLabel(project.status)}</span>
              </div>
              <h2>
                <a href={`/projects/${project.slug}`}>{project.title}</a>
              </h2>
              <p>{project.summary}</p>
              <dl className="project-card-stats">
                <div>
                  <dt>Milestones</dt>
                  <dd>{project.milestoneCount}</dd>
                </div>
                <div>
                  <dt>Items</dt>
                  <dd>{project.itemCount}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{formatProjectLabel(project.type)}</dd>
                </div>
              </dl>
              {project.nextMilestone ? (
                <p className="project-next">
                  Current milestone: <strong>{project.nextMilestone.title}</strong>
                </p>
              ) : null}
            </article>
          ))}
        </section>
      )}
    </main>
  );
};

export default ProjectsPage;
