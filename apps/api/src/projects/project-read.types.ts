import type {
  ProjectReadModelSource,
  PublicProjectDetail,
  PublicProjectSummary
} from "@maiks-yt/domain/projects";

export interface ProjectReadRepository {
  listProjects(): Promise<readonly ProjectReadModelSource[]>;
  findProjectBySlug(slug: string): Promise<ProjectReadModelSource | null>;
}

export type ProjectListResult = {
  ok: true;
  projects: readonly PublicProjectSummary[];
};

export type ProjectDetailResult =
  | {
    ok: true;
    project: PublicProjectDetail;
  }
  | {
    ok: false;
    reason: "project_not_found";
  };
