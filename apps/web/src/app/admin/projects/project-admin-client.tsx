"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  MilestoneStatus,
  ProjectCategory,
  ProjectItemStatus,
  ProjectReadModelSource,
  ProjectReadUpdateSource,
  ProjectStatus,
  ProjectType
} from "@maiks-yt/domain/projects";
import { buildProjectAdminPublicPreview } from "@maiks-yt/domain/projects";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";
import { formatProjectLabel } from "../../projects/project-read-data";
import { ItemsPanel, ManualUpdatesPanel, MilestonesPanel } from "./project-admin-edit-panels";
import { ProjectAdminPublicPreview } from "./project-admin-preview";
import {
  apiBaseUrl,
  defaultItemForm,
  defaultMilestoneForm,
  defaultProjectForm,
  defaultUpdateForm,
  flattenItemOptions,
  getFailureMessage,
  getLoadStateForFailure,
  getProjectPublicHref,
  isPublicRouteVisible,
  projectCategories,
  projectStatuses,
  projectTypes,
  toAdminUpdatePayload,
  toProjectForm,
  toUpdateForm,
  type AdminMutationResponse,
  type AdminProjectsResponse,
  type ItemFormState,
  type LoadState,
  type MilestoneFormState,
  type ProjectFormState,
  type UpdateFormState
} from "./project-admin-client.service";

const ProjectAdminClient = (): React.ReactNode => {
  const [projects, setProjects] = useState<readonly ProjectReadModelSource[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectForm, setProjectForm] = useState<ProjectFormState>(defaultProjectForm);
  const [milestoneForm, setMilestoneForm] = useState<MilestoneFormState>(defaultMilestoneForm);
  const [itemForm, setItemForm] = useState<ItemFormState>(defaultItemForm);
  const [selectedUpdateId, setSelectedUpdateId] = useState<string>("");
  const [updateForm, setUpdateForm] = useState<UpdateFormState>(defaultUpdateForm);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string>("Loading project admin...");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const selectedUpdate = useMemo(
    () => selectedProject?.updates.find((update) => update.id === selectedUpdateId) ?? null,
    [selectedProject, selectedUpdateId]
  );

  const previewSource = useMemo<ProjectReadModelSource | null>(() => {
    if (!selectedProject) {
      if (!projectForm.slug.trim() || !projectForm.title.trim()) {
        return null;
      }

      return {
        id: "new-project-preview",
        slug: projectForm.slug.trim(),
        title: projectForm.title.trim(),
        summary: projectForm.summary.trim() || null,
        type: projectForm.type,
        category: projectForm.category,
        status: projectForm.status,
        isPublic: projectForm.isPublic,
        milestones: [],
        items: [],
        updates: []
      };
    }

    const formUpdate = selectedProject && updateForm.title.trim() && updateForm.body.trim()
      ? {
        id: selectedUpdate?.id ?? "update-preview",
        title: updateForm.title.trim(),
        summary: updateForm.summary.trim() || null,
        body: updateForm.body.trim(),
        status: updateForm.status,
        isVisible: updateForm.isVisible,
        publishedAt: updateForm.publishedAt.trim() || (updateForm.status === "published" ? new Date().toISOString() : null),
        isPinned: updateForm.isPinned,
        sortOrder: updateForm.sortOrder
      } satisfies ProjectReadUpdateSource
      : null;
    const updates = formUpdate
      ? selectedUpdate
        ? selectedProject.updates.map((update) => update.id === selectedUpdate.id ? formUpdate : update)
        : [...selectedProject.updates, formUpdate]
      : selectedProject.updates;

    return {
      ...selectedProject,
      slug: projectForm.slug.trim() || selectedProject.slug,
      title: projectForm.title.trim() || selectedProject.title,
      summary: projectForm.summary.trim() || null,
      type: projectForm.type,
      category: projectForm.category,
      status: projectForm.status,
      isPublic: projectForm.isPublic,
      updates
    };
  }, [projectForm, selectedProject, selectedUpdate, updateForm]);

  const publicPreview = useMemo(
    () => previewSource ? buildProjectAdminPublicPreview(previewSource) : null,
    [previewSource]
  );

  const replaceProject = useCallback((project: ProjectReadModelSource): void => {
    setProjects((current) => {
      const exists = current.some((candidate) => candidate.id === project.id);
      const next = exists
        ? current.map((candidate) => candidate.id === project.id ? project : candidate)
        : [project, ...current];

      return next;
    });
    setSelectedProjectId(project.id);
    setProjectForm(toProjectForm(project));
    setUpdateForm({
      ...defaultUpdateForm,
      sortOrder: project.updates.length + 1
    });
  }, []);

  const parseJson = async <ResponseBody,>(response: Response): Promise<ResponseBody | null> => {
    try {
      return await response.json() as ResponseBody;
    } catch {
      return null;
    }
  };

  const loadProjects = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    setMessage("Loading project admin...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/projects`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<AdminProjectsResponse>(response);

      if (response.ok && payload?.ok) {
        setProjects(payload.projects);
        const firstProject = payload.projects[0] ?? null;
        setSelectedProjectId(firstProject?.id ?? "");
        setProjectForm(firstProject ? toProjectForm(firstProject) : defaultProjectForm);
        setMilestoneForm({
          ...defaultMilestoneForm,
          sortOrder: firstProject ? firstProject.milestones.length + 1 : 1
        });
        setItemForm({
          ...defaultItemForm,
          sortOrder: firstProject ? firstProject.items.length + 1 : 1
        });
        setUpdateForm({
          ...defaultUpdateForm,
          sortOrder: firstProject ? firstProject.updates.length + 1 : 1
        });
        setLoadState("ready");
        setMessage(payload.projects.length === 0 ? "No projects exist yet." : "Project admin loaded.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState(getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Project admin request failed.");
    }
  }, []);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadProjects();
  }, [loadProjects]);

  const runMutation = async (
    label: string,
    path: string,
    options: {
      method: "POST" | "PATCH";
      body: Record<string, unknown>;
    }
  ): Promise<ProjectReadModelSource | null> => {
    setBusyAction(label);
    setMessage(`${label}...`);

    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: options.method,
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        credentials: "include",
        body: JSON.stringify(options.body)
      });
      const payload = await parseJson<AdminMutationResponse>(response);

      if (response.ok && payload?.ok) {
        replaceProject(payload.project);
        setLoadState("ready");
        setMessage(`${label} saved.`);
        return payload.project;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState((current) => current === "ready" ? current : getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
      return null;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${label} failed.`);
      return null;
    } finally {
      setBusyAction(null);
    }
  };

  const selectProject = (projectId: string): void => {
    const project = projects.find((candidate) => candidate.id === projectId);

    setSelectedProjectId(projectId);
    if (project) {
      setProjectForm(toProjectForm(project));
      setMilestoneForm({
        ...defaultMilestoneForm,
        sortOrder: project.milestones.length + 1
      });
      setItemForm({
        ...defaultItemForm,
        sortOrder: project.items.length + 1
      });
      setSelectedUpdateId("");
      setUpdateForm({
        ...defaultUpdateForm,
        sortOrder: project.updates.length + 1
      });
    }
  };

  const createProject = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const created = await runMutation("Creating project", "/admin/projects", {
      method: "POST",
      body: {
        ...projectForm,
        summary: projectForm.summary.trim() || null
      }
    });

    if (created) {
      setMilestoneForm({
        ...defaultMilestoneForm,
        sortOrder: 1
      });
      setItemForm({
        ...defaultItemForm,
        sortOrder: 1
      });
      setSelectedUpdateId("");
      setUpdateForm(defaultUpdateForm);
    }
  };

  const updateProject = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!selectedProject) {
      setMessage("Choose a project before saving changes.");
      return;
    }

    await runMutation("Saving project", `/admin/projects/${encodeURIComponent(selectedProject.id)}`, {
      method: "PATCH",
      body: {
        ...projectForm,
        summary: projectForm.summary.trim() || null
      }
    });
  };

  const saveVisibility = async (isPublic: boolean): Promise<void> => {
    if (!selectedProject) {
      setMessage("Choose a project before changing visibility.");
      return;
    }

    await runMutation(isPublic ? "Publishing project" : "Unpublishing project", `/admin/projects/${encodeURIComponent(selectedProject.id)}`, {
      method: "PATCH",
      body: {
        isPublic
      }
    });
  };

  const createMilestone = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!selectedProject) {
      setMessage("Choose a project before adding a milestone.");
      return;
    }

    const updated = await runMutation("Creating milestone", `/admin/projects/${encodeURIComponent(selectedProject.id)}/milestones`, {
      method: "POST",
      body: {
        ...milestoneForm,
        description: milestoneForm.description.trim() || null
      }
    });

    if (updated) {
      setMilestoneForm({
        ...defaultMilestoneForm,
        sortOrder: updated.milestones.length + 1
      });
    }
  };

  const createItem = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!selectedProject) {
      setMessage("Choose a project before adding an item.");
      return;
    }

    const updated = await runMutation("Creating item", `/admin/projects/${encodeURIComponent(selectedProject.id)}/items`, {
      method: "POST",
      body: {
        ...itemForm,
        parentItemId: itemForm.parentItemId || null,
        description: itemForm.description.trim() || null
      }
    });

    if (updated) {
      setItemForm({
        ...defaultItemForm,
        sortOrder: updated.items.length + 1
      });
    }
  };

  const createUpdate = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!selectedProject) {
      setMessage("Choose a project before adding an update.");
      return;
    }

    const updated = await runMutation("Creating update", `/admin/projects/${encodeURIComponent(selectedProject.id)}/updates`, {
      method: "POST",
      body: toAdminUpdatePayload(updateForm)
    });

    if (updated) {
      setSelectedUpdateId("");
      setUpdateForm({
        ...defaultUpdateForm,
        sortOrder: updated.updates.length + 1
      });
    }
  };

  const updateUpdate = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!selectedProject || !selectedUpdate) {
      setMessage("Choose an update before saving changes.");
      return;
    }

    await runMutation("Saving update", `/admin/projects/${encodeURIComponent(selectedProject.id)}/updates/${encodeURIComponent(selectedUpdate.id)}`, {
      method: "PATCH",
      body: toAdminUpdatePayload(updateForm)
    });
  };

  const editUpdate = (update: ProjectReadUpdateSource): void => {
    setSelectedUpdateId(update.id);
    setUpdateForm(toUpdateForm(update));
  };

  const updateUpdateState = async (
    updateId: string,
    body: Record<string, unknown>
  ): Promise<void> => {
    if (!selectedProject) {
      return;
    }

    await runMutation("Updating project update", `/admin/projects/${encodeURIComponent(selectedProject.id)}/updates/${encodeURIComponent(updateId)}`, {
      method: "PATCH",
      body
    });
  };

  const updateMilestoneStatus = async (
    milestoneId: string,
    status: MilestoneStatus
  ): Promise<void> => {
    if (!selectedProject) {
      return;
    }

    await runMutation("Updating milestone", `/admin/projects/${encodeURIComponent(selectedProject.id)}/milestones/${encodeURIComponent(milestoneId)}`, {
      method: "PATCH",
      body: {
        status
      }
    });
  };

  const updateItemStatus = async (
    itemId: string,
    status: ProjectItemStatus
  ): Promise<void> => {
    if (!selectedProject) {
      return;
    }

    await runMutation("Updating item", `/admin/projects/${encodeURIComponent(selectedProject.id)}/items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      body: {
        status
      }
    });
  };

  const reorderMilestones = async (): Promise<void> => {
    if (!selectedProject) {
      return;
    }

    const orderedIds = selectedProject.milestones
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title))
      .map((milestone) => milestone.id);

    await runMutation("Saving milestone order", `/admin/projects/${encodeURIComponent(selectedProject.id)}/milestones/reorder`, {
      method: "PATCH",
      body: {
        orderedIds
      }
    });
  };

  const reorderItems = async (): Promise<void> => {
    if (!selectedProject) {
      return;
    }

    const orderedIds = selectedProject.items
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title))
      .map((item) => item.id);

    await runMutation("Saving item order", `/admin/projects/${encodeURIComponent(selectedProject.id)}/items/reorder`, {
      method: "PATCH",
      body: {
        orderedIds
      }
    });
  };

  const itemParentOptions = selectedProject ? flattenItemOptions(selectedProject) : [];

  return (
    <>
      <header className="project-admin-header">
        <p className="eyebrow">Owner Admin</p>
        <h1>Project Content</h1>
        <p aria-live="polite">{message}</p>
      </header>

      {loadState !== "ready" ? (
        <section className={`project-admin-state ${loadState}`}>
          <h2>{loadState === "loading" ? "Loading" : loadState === "signed-out" ? "Sign In Required" : loadState === "forbidden" ? "Forbidden" : "Unavailable"}</h2>
          <p>{message}</p>
          {loadState !== "loading" ? (
            <button type="button" className="secondary-action" onClick={() => void loadProjects()}>
              Retry
            </button>
          ) : null}
        </section>
      ) : null}

      {loadState === "ready" ? (
        <div className="project-admin-layout">
          <aside className="project-admin-sidebar" aria-label="Projects">
            <div className="project-admin-sidebar-heading">
              <h2>Projects</h2>
              <button type="button" className="secondary-action" onClick={() => {
                setSelectedProjectId("");
                setProjectForm(defaultProjectForm);
                setSelectedUpdateId("");
                setUpdateForm(defaultUpdateForm);
              }}>
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
                    onClick={() => selectProject(project.id)}
                  >
                    <strong>{project.title}</strong>
                    <span>{project.isPublic ? "Public" : "Private"} / {formatProjectLabel(project.status)}</span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="project-admin-workspace" aria-label="Project editor">
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
                  <button type="button" className="secondary-action" onClick={() => void saveVisibility(false)} disabled={busyAction !== null || !selectedProject.isPublic}>
                    Make Private
                  </button>
                  <button type="button" onClick={() => void saveVisibility(true)} disabled={busyAction !== null || selectedProject.isPublic}>
                    Publish
                  </button>
                </div>
              ) : null}
            </section>

            <form className="project-admin-panel project-admin-form" onSubmit={(event) => selectedProject ? void updateProject(event) : void createProject(event)}>
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

            <section className="project-admin-panel">
              <div className="project-admin-panel-heading">
                <h2>Public Preview</h2>
                <span className="project-admin-preview-state">
                  {selectedProject?.isPublic ? "Currently published" : "Not published"}
                </span>
              </div>
              <p>
                {selectedProject?.isPublic
                  ? "This preview includes unsaved basic field edits; the public page keeps showing the last saved public version."
                  : "This preview shows the public page shape before publishing; public routes still hide this project."}
              </p>
              {!previewSource ? (
                <p className="project-muted">Add a slug and title to preview the public page shape.</p>
              ) : publicPreview?.ok ? (
                <ProjectAdminPublicPreview
                  isPublished={selectedProject?.isPublic === true}
                  project={publicPreview.project}
                />
              ) : (
                <section className="link-admin-warning">
                  <h3>Preview Unavailable</h3>
                  <p>Public project pages only show planning, active, or completed projects. Change the status to preview the public page shape.</p>
                </section>
              )}
            </section>

            {selectedProject ? (
              <>
                <ManualUpdatesPanel
                  busyAction={busyAction}
                  createUpdate={createUpdate}
                  editUpdate={editUpdate}
                  selectedProject={selectedProject}
                  selectedUpdate={selectedUpdate}
                  setSelectedUpdateId={setSelectedUpdateId}
                  setUpdateForm={setUpdateForm}
                  updateForm={updateForm}
                  updateUpdate={updateUpdate}
                  updateUpdateState={updateUpdateState}
                />

                <MilestonesPanel
                  busyAction={busyAction}
                  createMilestone={createMilestone}
                  milestoneForm={milestoneForm}
                  reorderMilestones={reorderMilestones}
                  selectedProject={selectedProject}
                  setMilestoneForm={setMilestoneForm}
                  updateMilestoneStatus={updateMilestoneStatus}
                />

                <ItemsPanel
                  busyAction={busyAction}
                  createItem={createItem}
                  itemForm={itemForm}
                  itemParentOptions={itemParentOptions}
                  reorderItems={reorderItems}
                  selectedProject={selectedProject}
                  setItemForm={setItemForm}
                  updateItemStatus={updateItemStatus}
                />
              </>
            ) : null}

            <section className="project-admin-panel project-admin-note">
              <h2>Deferred</h2>
              <p>AI drafting, support actions, funding progress, provider links, ledgers, and wishlist integrations stay outside this manual content slice.</p>
            </section>
          </section>
        </div>
      ) : null}
    </>
  );
};

export default ProjectAdminClient;
