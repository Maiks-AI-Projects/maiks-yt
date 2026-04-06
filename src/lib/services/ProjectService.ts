import { prisma } from '@/lib/prisma';
import { getMaiksYtId } from '@/lib/id';
import { ProjectStatus } from '@prisma/client';

export class ProjectService {
  /**
   * Creates a new project.
   */
  static async createProject(data: {
    name: string;
    description?: string;
    parentId?: string;
  }) {
    const id = getMaiksYtId('proj');
    return prisma.project.create({
      data: {
        id,
        name: data.name,
        description: data.description,
        parentId: data.parentId,
        status: ProjectStatus.ACTIVE,
      },
    });
  }

  /**
   * Updates a project's status.
   */
  static async updateStatus(projectId: string, status: ProjectStatus) {
    return prisma.project.update({
      where: { id: projectId },
      data: { status },
    });
  }

  /**
   * Sets a project as mothballed.
   */
  static async mothballProject(projectId: string) {
    return this.updateStatus(projectId, ProjectStatus.MOTHBALLED);
  }

  /**
   * Gets a project by ID with its children, parts, and actions.
   */
  static async getProject(projectId: string) {
    return prisma.project.findUnique({
      where: { id: projectId },
      include: {
        children: true,
        parts: true,
        actions: true,
        donations: true,
      },
    });
  }

  /**
   * Lists all top-level projects.
   */
  static async listTopLevelProjects() {
    return prisma.project.findMany({
      where: { parentId: null },
      include: {
        children: true,
      },
    });
  }

  /**
   * Handles nesting logic (linking subproject to a parent).
   */
  static async setParentProject(projectId: string, parentId: string | null) {
    return prisma.project.update({
      where: { id: projectId },
      data: { parentId },
    });
  }
}
