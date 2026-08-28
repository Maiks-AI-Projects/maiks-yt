import type { PublicProjectDetail, PublicProjectItem } from "@maiks-yt/domain/projects";
import {
  getPublicProjectItemKey,
  getPublicProjectMilestoneKey,
  getPublicProjectUpdateKey
} from "../../projects/project-public-keys.rules";
import { formatProjectLabel } from "../../projects/project-read-data";

const PreviewItemList = ({
  items,
  path = []
}: {
  items: readonly PublicProjectItem[];
  path?: readonly number[];
}): React.ReactNode => (
  <ul className="project-admin-record-list">
    {items.map((item, index) => {
      const itemPath = [...path, index];

      return (
        <li key={getPublicProjectItemKey(item, itemPath)}>
          <div>
            <span>{formatProjectLabel(item.kind)}</span>
            <strong>{item.title}</strong>
            <em>{formatProjectLabel(item.status)}</em>
          </div>
          {item.description ? <p>{item.description}</p> : null}
          {item.quantity > 1 ? <small>Quantity: {item.quantity}</small> : null}
          {item.children.length > 0 ? <PreviewItemList items={item.children} path={itemPath} /> : null}
        </li>
      );
    })}
  </ul>
);

export const ProjectAdminPublicPreview = ({
  isPublished,
  project
}: {
  isPublished: boolean;
  project: PublicProjectDetail;
}): React.ReactNode => (
  <article className="project-admin-preview" aria-label="Public project preview">
    <div className="project-admin-preview-banner">
      <span>{isPublished ? "Published page preview" : "Draft page preview"}</span>
      <span>{formatProjectLabel(project.status)}</span>
    </div>
    <header>
      <p className="eyebrow">{formatProjectLabel(project.category)}</p>
      <h3>{project.title}</h3>
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
    </header>
    <section>
      <h4>Updates</h4>
      {project.updates.length === 0 ? (
        <p className="project-muted">No public updates are available yet.</p>
      ) : (
        <ol className="project-admin-record-list">
          {project.updates.map((update, index) => (
            <li key={getPublicProjectUpdateKey(project.slug, update, index)}>
              <span>{update.isPinned ? "Pinned" : "Update"}</span>
              <strong>{update.title}</strong>
              {update.summary ? <p>{update.summary}</p> : null}
              <p>{update.body}</p>
              {update.publishedAt ? <small>{new Date(update.publishedAt).toLocaleDateString()}</small> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
    <section>
      <h4>Milestones</h4>
      {project.milestones.length === 0 ? (
        <p className="project-muted">No public milestones are available yet.</p>
      ) : (
        <ol className="project-admin-record-list">
          {project.milestones.map((milestone, index) => (
            <li key={getPublicProjectMilestoneKey(project.slug, milestone, index)}>
              <span>{formatProjectLabel(milestone.status)}</span>
              <strong>{milestone.title}</strong>
              {milestone.description ? <p>{milestone.description}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
    <section>
      <h4>Project Items</h4>
      {project.items.length === 0 ? (
        <p className="project-muted">No public project items are available yet.</p>
      ) : (
        <PreviewItemList items={project.items} />
      )}
    </section>
  </article>
);
