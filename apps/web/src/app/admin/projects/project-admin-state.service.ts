import type { ProjectReadModelSource, ProjectReadUpdateSource } from "@maiks-yt/domain/projects";

import { createApiHeaders } from "../../dev-auth-token";
import {
  apiBaseUrl,
  getFailureMessage,
  getLoadStateForFailure,
  defaultItemForm,
  defaultMilestoneForm,
  defaultProjectForm,
  defaultUpdateForm,
  toProjectForm,
  type AdminMutationResponse,
  type ItemFormState,
  type LoadState,
  type MilestoneFormState,
  type ProjectFormState,
  type UpdateFormState
} from "./project-admin-client.service";

export const createEmptyProjectForms = (): {
  itemForm: ItemFormState;
  milestoneForm: MilestoneFormState;
  projectForm: ProjectFormState;
  updateForm: UpdateFormState;
} => ({
  itemForm: defaultItemForm,
  milestoneForm: defaultMilestoneForm,
  projectForm: defaultProjectForm,
  updateForm: defaultUpdateForm
});

export const createProjectEditForms = (project: ProjectReadModelSource): {
  itemForm: ItemFormState;
  milestoneForm: MilestoneFormState;
  projectForm: ProjectFormState;
  updateForm: UpdateFormState;
} => ({
  itemForm: {
    ...defaultItemForm,
    sortOrder: project.items.length + 1
  },
  milestoneForm: {
    ...defaultMilestoneForm,
    sortOrder: project.milestones.length + 1
  },
  projectForm: toProjectForm(project),
  updateForm: {
    ...defaultUpdateForm,
    sortOrder: project.updates.length + 1
  }
});

export const buildProjectAdminPreviewSource = ({
  projectForm,
  selectedProject,
  selectedUpdate,
  updateForm
}: {
  projectForm: ProjectFormState;
  selectedProject: ProjectReadModelSource | null;
  selectedUpdate: ProjectReadUpdateSource | null;
  updateForm: UpdateFormState;
}): ProjectReadModelSource | null => {
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

  const formUpdate = updateForm.title.trim() && updateForm.body.trim()
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
};

export const runProjectAdminMutation = async ({
  label,
  path,
  body,
  method,
  replaceProject,
  setBusyAction,
  setLoadState,
  setMessage
}: {
  label: string;
  path: string;
  body?: Record<string, unknown>;
  method: "DELETE" | "POST" | "PATCH";
  replaceProject: (project: ProjectReadModelSource) => void;
  setBusyAction: (action: string | null) => void;
  setLoadState: (updater: (current: LoadState) => LoadState) => void;
  setMessage: (message: string) => void;
}): Promise<ProjectReadModelSource | null> => {
  setBusyAction(label);
  setMessage(`${label}...`);

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers: body
        ? createApiHeaders({
          "Content-Type": "application/json"
        })
        : createApiHeaders(),
      credentials: "include",
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const payload = await parseJson<AdminMutationResponse>(response);

    if (response.ok && payload?.ok) {
      replaceProject(payload.project);
      setLoadState(() => "ready");
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

const parseJson = async <ResponseBody,>(response: Response): Promise<ResponseBody | null> => {
  try {
    return await response.json() as ResponseBody;
  } catch {
    return null;
  }
};
