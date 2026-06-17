import {
  buildPublicProjectDetail,
  buildPublicProjectSummaryList
} from "@maiks-yt/domain/projects";

import type {
  ProjectDetailResult,
  ProjectListResult,
  ProjectReadRepository
} from "./project-read.types.js";

export class ProjectReadService {
  public constructor(private readonly repository: ProjectReadRepository) {}

  public async listProjects(): Promise<ProjectListResult> {
    const projects = await this.repository.listProjects();

    return {
      ok: true,
      projects: buildPublicProjectSummaryList(projects)
    };
  }

  public async getProject(slug: string): Promise<ProjectDetailResult> {
    const project = await this.repository.findProjectBySlug(slug);
    const publicProject = project ? buildPublicProjectDetail(project) : null;

    if (!publicProject) {
      return {
        ok: false,
        reason: "project_not_found"
      };
    }

    return {
      ok: true,
      project: publicProject
    };
  }
}
