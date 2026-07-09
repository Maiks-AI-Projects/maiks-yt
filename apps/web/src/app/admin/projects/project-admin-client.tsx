"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  MilestoneStatus,
  ProjectItemStatus,
  ProjectReadModelSource,
} from "@maiks-yt/domain/projects";
import type { ProjectReadUpdateSource } from "@maiks-yt/domain/projects";
import { buildProjectAdminPublicPreview } from "@maiks-yt/domain/projects";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";
import { ItemsPanel, ManualUpdatesPanel, MilestonesPanel } from "./project-admin-edit-panels";
import {
  DeferredProjectAdminNote,
  ProjectAdminHeader,
  ProjectAdminLoadStatePanel,
  ProjectBasicsForm,
  ProjectSidebar,
  PublicPreviewPanel,
  VisibilityPanel
} from "./project-admin-layout-panels";
import {
  apiBaseUrl,
  defaultItemForm,
  defaultMilestoneForm,
  defaultProjectForm,
  defaultUpdateForm,
  flattenItemOptions,
  getFailureMessage,
  getLoadStateForFailure,
  parseProjectEstimateMinor,
  toAdminUpdatePayload,
  toUpdateForm,
  type AdminProjectsResponse,
  type ItemFormState,
  type LoadState,
  type MilestoneFormState,
  type ProjectFormState,
  type UpdateFormState
} from "./project-admin-client.service";
import {
  buildProjectAdminPreviewSource,
  createEmptyProjectForms,
  createProjectEditForms,
  runProjectAdminMutation
} from "./project-admin-state.service";

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
  const previewSource = useMemo(
    () => buildProjectAdminPreviewSource({
      projectForm,
      selectedProject,
      selectedUpdate,
      updateForm
    }),
    [projectForm, selectedProject, selectedUpdate, updateForm]
  );
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
    setProjectForm(createProjectEditForms(project).projectForm);
    setUpdateForm(createProjectEditForms(project).updateForm);
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
        const nextForms = firstProject ? createProjectEditForms(firstProject) : createEmptyProjectForms();

        setSelectedProjectId(firstProject?.id ?? "");
        setProjectForm(nextForms.projectForm);
        setMilestoneForm(nextForms.milestoneForm);
        setItemForm(nextForms.itemForm);
        setUpdateForm(nextForms.updateForm);
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
  const runMutation = (
    label: string,
    path: string,
    options: {
      method: "POST" | "PATCH";
      body: Record<string, unknown>;
    }
  ): Promise<ProjectReadModelSource | null> =>
    runProjectAdminMutation({
      label,
      path,
      body: options.body,
      method: options.method,
      replaceProject,
      setBusyAction,
      setLoadState,
      setMessage
    });
  const selectProject = (projectId: string): void => {
    const project = projects.find((candidate) => candidate.id === projectId);

    setSelectedProjectId(projectId);
    if (project) {
      const nextForms = createProjectEditForms(project);

      setProjectForm(nextForms.projectForm);
      setMilestoneForm(nextForms.milestoneForm);
      setItemForm(nextForms.itemForm);
      setSelectedUpdateId("");
      setUpdateForm(nextForms.updateForm);
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
  const archiveProject = async (): Promise<void> => {
    if (!selectedProject) {
      setMessage("Choose a project before archiving.");
      return;
    }

    await runMutation("Archiving project", `/admin/projects/${encodeURIComponent(selectedProject.id)}`, {
      method: "PATCH",
      body: {
        isPublic: false,
        status: "mothballed"
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

    const estimatedMinorAmount = parseProjectEstimateMinor(itemForm.estimatedAmountMajor);

    if (Number.isNaN(estimatedMinorAmount)) {
      setMessage("Use a valid item estimate with up to two decimals.");
      return;
    }

    const currencyCode = itemForm.currencyCode.trim().toUpperCase();

    if (estimatedMinorAmount !== null && !/^[A-Z]{3}$/.test(currencyCode)) {
      setMessage("Use a three-letter currency code for item estimates.");
      return;
    }

    const updated = await runMutation("Creating item", `/admin/projects/${encodeURIComponent(selectedProject.id)}/items`, {
      method: "POST",
      body: {
        parentItemId: itemForm.parentItemId || null,
        title: itemForm.title,
        description: itemForm.description.trim() || null,
        kind: itemForm.kind,
        status: itemForm.status,
        quantity: itemForm.quantity,
        estimatedMinorAmount,
        currencyCode: estimatedMinorAmount === null ? null : currencyCode,
        sortOrder: itemForm.sortOrder
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
      <ProjectAdminHeader message={message} />

      {loadState !== "ready" ? (
        <ProjectAdminLoadStatePanel
          loadState={loadState}
          message={message}
          onRetry={() => void loadProjects()}
        />
      ) : null}

      {loadState === "ready" ? (
        <div className="project-admin-layout">
          <ProjectSidebar
            projects={projects}
            selectedProjectId={selectedProjectId}
            onNewProject={() => {
              setSelectedProjectId("");
              setProjectForm(defaultProjectForm);
              setSelectedUpdateId("");
              setUpdateForm(defaultUpdateForm);
            }}
            onSelectProject={selectProject}
          />

          <section className="project-admin-workspace" aria-label="Project editor">
            <VisibilityPanel
              selectedProject={selectedProject}
              busyAction={busyAction}
              onArchiveProject={() => void archiveProject()}
              onSaveVisibility={(isPublic) => void saveVisibility(isPublic)}
            />

            <ProjectBasicsForm
              selectedProject={selectedProject}
              projectForm={projectForm}
              busyAction={busyAction}
              onSubmit={(event) => selectedProject ? void updateProject(event) : void createProject(event)}
              setProjectForm={setProjectForm}
            />

            <PublicPreviewPanel
              isPublished={selectedProject?.isPublic === true}
              previewSource={previewSource}
              publicPreview={publicPreview}
            />

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

            <DeferredProjectAdminNote />
          </section>
        </div>
      ) : null}
    </>
  );
};

export default ProjectAdminClient;
