import type { ProjectCategory, ProjectReadModelSource, ProjectStatus, ProjectType } from "@maiks-yt/domain/projects";
import type { Dispatch, FormEvent, SetStateAction } from "react";

import { formatProjectLabel } from "../../projects/project-read-data";
import {
  getProjectPublicHref,
  isPublicRouteVisible,
  projectCategories,
  projectStatuses,
  projectTypes,
  type LoadState,
  type ProjectFormState
} from "./project-admin-client.service";
import { ProjectAdminPublicPreview } from "./project-admin-preview";

export const ProjectAdminHeader = ({ message }: { message: string }): React.ReactNode => (
  <header className="project-admin-header">
    <p className="eyebrow">Owner Admin</p>
    <h1>Project Content</h1>
    <p aria-live="polite">{message}</p>
  </header>
);

export const ProjectAdminLoadStatePanel = ({
  loadState,
  message,
  onRetry
}: {
  loadState: Exclude<LoadState, "ready">;
  message: string;
  onRetry: () => void;
}): React.ReactNode => (
  <section className={`project-admin-state ${loadState}`}>
    <h2>{loadState === "loading" ? "Loading" : loadState === "signed-out" ? "Sign In Required" : loadState === "forbidden" ? "Forbidden" : "Unavailable"}</h2>
    <p>{message}</p>
    {loadState !== "loading" ? (
      <button type="button" className="secondary-action" onClick={onRetry}>
        Retry
      </button>
    ) : null}
  </section>
);

type ProjectSidebarProps = {
  projects: readonly ProjectReadModelSource[];
  selectedProjectId: string;
  onNewProject: () => void;
  onSelectProject: (projectId: string) => void;
};

export const ProjectSidebar = ({
  projects,
  selectedProjectId,
  onNewProject,
  onSelectProject
}: ProjectSidebarProps): React.ReactNode => (
  <aside className="project-admin-sidebar" aria-label="Projects">
    <div className="project-admin-sidebar-heading">
      <h2>Projects</h2>
      <button type="button" className="secondary-action" onClick={onNewProject}>
        New
      </button>
    </div>
    {projects.length === 0 ? (
      <p>No projects yet.</p>
    ) : (
      <div className="project-admin-selector">
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            className={project.id === selectedProjectId ? "selected" : ""}
            onClick={() => onSelectProject(project.id)}
          >
            <strong>{project.title}</strong>
            <span>{project.isPublic ? "Public" : "Private"} / {formatProjectLabel(project.status)}</span>
          </button>
        ))}
      </div>
    )}
  </aside>
);

type VisibilityPanelProps = {
  selectedProject: ProjectReadModelSource | null;
  busyAction: string | null;
  onArchiveProject: () => void;
  onSaveVisibility: (isPublic: boolean) => void;
};

export const VisibilityPanel = ({
  selectedProject,
  busyAction,
  onArchiveProject,
  onSaveVisibility
}: VisibilityPanelProps): React.ReactNode => (
  <section className="project-admin-panel visibility-panel">
    <div>
      <h2>Visibility</h2>
      <p>
        {selectedProject
          ? selectedProject.isPublic
            ? "This project is public on the website."
            : "This project is private and only visible here."
          : "New projects can be created as private drafts before publishing."}
      </p>
    </div>
    {selectedProject ? (
      <div className="project-admin-actions">
        {isPublicRouteVisible(selectedProject) ? (
          <a className="button-link secondary-action" href={getProjectPublicHref(selectedProject)}>
            Open Public Page
          </a>
        ) : null}
        <button type="button" className="secondary-action" onClick={() => onSaveVisibility(false)} disabled={busyAction !== null || !selectedProject.isPublic}>
          Make Private
        </button>
        <button type="button" className="secondary-action" onClick={onArchiveProject} disabled={busyAction !== null || (!selectedProject.isPublic && selectedProject.status === "mothballed")}>
          Archive
        </button>
        <button type="button" onClick={() => onSaveVisibility(true)} disabled={busyAction !== null || selectedProject.isPublic}>
          Publish
        </button>
      </div>
    ) : null}
  </section>
);

type ProjectBasicsFormProps = {
  selectedProject: ProjectReadModelSource | null;
  projectForm: ProjectFormState;
  busyAction: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  setProjectForm: Dispatch<SetStateAction<ProjectFormState>>;
};

export const ProjectBasicsForm = ({
  selectedProject,
  projectForm,
  busyAction,
  onSubmit,
  setProjectForm
}: ProjectBasicsFormProps): React.ReactNode => (
  <form className="project-admin-panel project-admin-form" onSubmit={onSubmit}>
    <div className="project-admin-panel-heading">
      <h2>{selectedProject ? "Project Basics" : "Create Project"}</h2>
      <button type="submit" disabled={busyAction !== null}>
        {busyAction ? "Saving..." : selectedProject ? "Save Project" : "Create Project"}
      </button>
    </div>
    <label>
      Slug
      <input value={projectForm.slug} onChange={(event) => setProjectForm((current) => ({ ...current, slug: event.target.value }))} required pattern="[a-z0-9][a-z0-9-]{0,190}" />
    </label>
    <label>
      Title
      <input value={projectForm.title} onChange={(event) => setProjectForm((current) => ({ ...current, title: event.target.value }))} required maxLength={191} />
    </label>
    <label>
      Summary
      <textarea value={projectForm.summary} onChange={(event) => setProjectForm((current) => ({ ...current, summary: event.target.value }))} maxLength={2000} rows={4} />
    </label>
    <div className="project-admin-form-grid">
      <label>
        Type
        <select value={projectForm.type} onChange={(event) => setProjectForm((current) => ({ ...current, type: event.target.value as ProjectType }))}>
          {projectTypes.map((type) => <option key={type} value={type}>{formatProjectLabel(type)}</option>)}
        </select>
      </label>
      <label>
        Category
        <select value={projectForm.category} onChange={(event) => setProjectForm((current) => ({ ...current, category: event.target.value as ProjectCategory }))}>
          {projectCategories.map((category) => <option key={category} value={category}>{formatProjectLabel(category)}</option>)}
        </select>
      </label>
      <label>
        Status
        <select value={projectForm.status} onChange={(event) => setProjectForm((current) => ({ ...current, status: event.target.value as ProjectStatus }))}>
          {projectStatuses.map((status) => <option key={status} value={status}>{formatProjectLabel(status)}</option>)}
        </select>
      </label>
      <label className="project-admin-checkbox">
        <input type="checkbox" checked={projectForm.isPublic} onChange={(event) => setProjectForm((current) => ({ ...current, isPublic: event.target.checked }))} />
        Public after save
      </label>
    </div>
  </form>
);

type PublicPreviewPanelProps = {
  isPublished: boolean;
  previewSource: ProjectReadModelSource | null;
  publicPreview: ReturnType<typeof import("@maiks-yt/domain/projects").buildProjectAdminPublicPreview> | null;
};

export const PublicPreviewPanel = ({
  isPublished,
  previewSource,
  publicPreview
}: PublicPreviewPanelProps): React.ReactNode => (
  <section className="project-admin-panel">
    <div className="project-admin-panel-heading">
      <h2>Public Preview</h2>
      <span className="project-admin-preview-state">
        {isPublished ? "Currently published" : "Not published"}
      </span>
    </div>
    <p>
      {isPublished
        ? "This preview includes unsaved basic field edits; the public page keeps showing the last saved public version."
        : "This preview shows the public page shape before publishing; public routes still hide this project."}
    </p>
    {!previewSource ? (
      <p className="project-muted">Add a slug and title to preview the public page shape.</p>
    ) : publicPreview?.ok ? (
      <ProjectAdminPublicPreview
        isPublished={isPublished}
        project={publicPreview.project}
      />
    ) : (
      <section className="link-admin-warning">
        <h3>Preview Unavailable</h3>
        <p>Public project pages only show planning, active, or completed projects. Change the status to preview the public page shape.</p>
      </section>
    )}
  </section>
);

export const DeferredProjectAdminNote = (): React.ReactNode => (
  <section className="project-admin-panel project-admin-note">
    <h2>Deferred</h2>
    <p>AI drafting, support actions, funding progress, provider links, ledgers, and wishlist integrations stay outside this manual content slice.</p>
  </section>
);
