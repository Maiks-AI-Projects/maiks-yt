import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import type {
  ProjectReadModelSource
} from "@maiks-yt/domain/projects";

import { createProjectReadRepository } from "./project-read-store.service.js";
import type {
  ProjectAdminActor,
  ProjectAdminItemUpdateInput,
  ProjectAdminMilestoneUpdateInput,
  ProjectAdminProjectUpdateInput,
  ProjectAdminUpdateInput,
  ProjectAdminUpdateUpdateInput,
  ProjectAdminRepository
} from "./project-admin.types.js";

type QueryExecutor = Pick<DatabasePool, "execute">;
type SqlValue = string | number | boolean | null;

const firstRow = <Row>(rows: unknown): Row | null =>
  Array.isArray(rows) && rows.length > 0 ? rows[0] as Row : null;

const resolveActor = async (
  executor: QueryExecutor,
  authUserId: string
): Promise<ProjectAdminActor | null> => {
  const [rows] = await executor.execute(
    `
      SELECT
        users.id AS domainUserId,
        roles.permissions AS rolePermissions
      FROM auth_user_links
      INNER JOIN users ON users.id = auth_user_links.user_id
      LEFT JOIN user_roles ON user_roles.user_id = users.id
      LEFT JOIN roles ON roles.id = user_roles.role_id
      WHERE auth_user_links.auth_user_id = ?
        AND users.deleted_at IS NULL
      ORDER BY roles.key
    `,
    [authUserId]
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const actorRows = rows as Array<{
    domainUserId: string;
    rolePermissions: unknown;
  }>;
  const domainUserId = actorRows[0]?.domainUserId;

  if (!domainUserId) {
    return null;
  }

  return {
    domainUserId,
    rolePermissionValues: actorRows.map((row) => row.rolePermissions)
  };
};

const projectExists = async (
  executor: QueryExecutor,
  projectId: string
): Promise<boolean> => {
  const [rows] = await executor.execute("SELECT id FROM projects WHERE id = ? LIMIT 1", [projectId]);

  return firstRow<{ id: string }>(rows) !== null;
};

const itemExistsInProject = async (
  executor: QueryExecutor,
  projectId: string,
  itemId: string
): Promise<boolean> => {
  const [rows] = await executor.execute(
    "SELECT id FROM project_items WHERE id = ? AND project_id = ? LIMIT 1",
    [itemId, projectId]
  );

  return firstRow<{ id: string }>(rows) !== null;
};

const updateExistsInProject = async (
  executor: QueryExecutor,
  projectId: string,
  updateId: string
): Promise<boolean> => {
  const [rows] = await executor.execute(
    "SELECT id FROM project_updates WHERE id = ? AND project_id = ? LIMIT 1",
    [updateId, projectId]
  );

  return firstRow<{ id: string }>(rows) !== null;
};

const readProject = async (
  pool: DatabasePool,
  projectId: string
): Promise<ProjectReadModelSource | null> => {
  const repository = createProjectReadRepository(pool);

  return await repository.findAnyProjectById(projectId);
};

const assertReadProject = async (
  pool: DatabasePool,
  projectId: string
): Promise<ProjectReadModelSource> => {
  const project = await readProject(pool, projectId);

  if (!project) {
    throw new Error("project_admin_mutation_reread_failed");
  }

  return project;
};

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object"
  && error !== null
  && "code" in error
  && error.code === "ER_DUP_ENTRY";

const updateProjectFields = async (
  pool: DatabasePool,
  id: string,
  input: ProjectAdminProjectUpdateInput
): Promise<"not-found" | "slug-conflict" | ProjectReadModelSource> => {
  const fields: string[] = [];
  const values: SqlValue[] = [];

  if (input.slug !== undefined) {
    fields.push("slug = ?");
    values.push(input.slug);
  }
  if (input.title !== undefined) {
    fields.push("title = ?");
    values.push(input.title.trim());
  }
  if (input.summary !== undefined) {
    fields.push("summary = ?");
    values.push(input.summary?.trim() || null);
  }
  if (input.type !== undefined) {
    fields.push("type = ?");
    values.push(input.type);
  }
  if (input.category !== undefined) {
    fields.push("category = ?");
    values.push(input.category);
  }
  if (input.status !== undefined) {
    fields.push("status = ?");
    values.push(input.status);
  }
  if (input.isPublic !== undefined) {
    fields.push("is_public = ?");
    values.push(input.isPublic);
  }

  if (fields.length === 0) {
    return await assertReadProject(pool, id);
  }

  try {
    const [result] = await pool.execute(
      `UPDATE projects SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ?`,
      [...values, id]
    );

    if (typeof result === "object"
      && result !== null
      && "affectedRows" in result
      && result.affectedRows === 0) {
      return "not-found";
    }
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return "slug-conflict";
    }

    throw error;
  }

  return await assertReadProject(pool, id);
};

const updateMilestoneFields = async (
  pool: DatabasePool,
  projectId: string,
  milestoneId: string,
  input: ProjectAdminMilestoneUpdateInput
): Promise<ProjectReadModelSource | "project-not-found" | "milestone-not-found"> => {
  if (!await projectExists(pool, projectId)) {
    return "project-not-found";
  }

  const fields: string[] = [];
  const values: SqlValue[] = [];

  if (input.title !== undefined) {
    fields.push("title = ?");
    values.push(input.title.trim());
  }
  if (input.description !== undefined) {
    fields.push("description = ?");
    values.push(input.description?.trim() || null);
  }
  if (input.status !== undefined) {
    fields.push("status = ?");
    values.push(input.status);
  }
  if (input.sortOrder !== undefined) {
    fields.push("sort_order = ?");
    values.push(input.sortOrder);
  }

  const [result] = await pool.execute(
    `UPDATE project_milestones SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ? AND project_id = ?`,
    [...values, milestoneId, projectId]
  );

  if (typeof result === "object"
    && result !== null
    && "affectedRows" in result
    && result.affectedRows === 0) {
    return "milestone-not-found";
  }

  return await assertReadProject(pool, projectId);
};

const updateItemFields = async (
  pool: DatabasePool,
  projectId: string,
  itemId: string,
  input: ProjectAdminItemUpdateInput
): Promise<ProjectReadModelSource | "project-not-found" | "item-not-found" | "parent-not-found"> => {
  if (!await projectExists(pool, projectId)) {
    return "project-not-found";
  }

  if (input.parentItemId && !await itemExistsInProject(pool, projectId, input.parentItemId)) {
    return "parent-not-found";
  }

  const fields: string[] = [];
  const values: SqlValue[] = [];

  if (input.parentItemId !== undefined) {
    fields.push("parent_item_id = ?");
    values.push(input.parentItemId || null);
  }
  if (input.title !== undefined) {
    fields.push("title = ?");
    values.push(input.title.trim());
  }
  if (input.description !== undefined) {
    fields.push("description = ?");
    values.push(input.description?.trim() || null);
  }
  if (input.kind !== undefined) {
    fields.push("kind = ?");
    values.push(input.kind);
  }
  if (input.status !== undefined) {
    fields.push("status = ?");
    values.push(input.status);
  }
  if (input.quantity !== undefined) {
    fields.push("quantity = ?");
    values.push(input.quantity);
  }
  if (input.sortOrder !== undefined) {
    fields.push("sort_order = ?");
    values.push(input.sortOrder);
  }

  const [result] = await pool.execute(
    `UPDATE project_items SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ? AND project_id = ?`,
    [...values, itemId, projectId]
  );

  if (typeof result === "object"
    && result !== null
    && "affectedRows" in result
    && result.affectedRows === 0) {
    return "item-not-found";
  }

  return await assertReadProject(pool, projectId);
};

const updateProjectUpdateFields = async (
  pool: DatabasePool,
  projectId: string,
  updateId: string,
  input: ProjectAdminUpdateUpdateInput
): Promise<ProjectReadModelSource | "project-not-found" | "update-not-found"> => {
  if (!await projectExists(pool, projectId)) {
    return "project-not-found";
  }

  if (!await updateExistsInProject(pool, projectId, updateId)) {
    return "update-not-found";
  }

  const fields: string[] = [];
  const values: SqlValue[] = [];

  if (input.title !== undefined) {
    fields.push("title = ?");
    values.push(input.title.trim());
  }
  if (input.summary !== undefined) {
    fields.push("summary = ?");
    values.push(input.summary?.trim() || null);
  }
  if (input.body !== undefined) {
    fields.push("body = ?");
    values.push(input.body.trim());
  }
  if (input.status !== undefined) {
    fields.push("status = ?");
    values.push(input.status);
    if (input.status === "published" && input.publishedAt === undefined) {
      fields.push("published_at = COALESCE(published_at, NOW())");
    }
    if (input.status === "draft" && input.publishedAt === undefined) {
      fields.push("published_at = NULL");
    }
  }
  if (input.isVisible !== undefined) {
    fields.push("is_visible = ?");
    values.push(input.isVisible);
  }
  if (input.publishedAt !== undefined) {
    fields.push("published_at = ?");
    values.push(input.publishedAt ? new Date(input.publishedAt).toISOString().slice(0, 19).replace("T", " ") : null);
  }
  if (input.isPinned !== undefined) {
    fields.push("is_pinned = ?");
    values.push(input.isPinned);
  }
  if (input.sortOrder !== undefined) {
    fields.push("sort_order = ?");
    values.push(input.sortOrder);
  }

  const [result] = await pool.execute(
    `UPDATE project_updates SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ? AND project_id = ?`,
    [...values, updateId, projectId]
  );

  if (typeof result === "object"
    && result !== null
    && "affectedRows" in result
    && result.affectedRows === 0) {
    return "update-not-found";
  }

  return await assertReadProject(pool, projectId);
};

const normalizePublishedAt = (input: ProjectAdminUpdateInput): string | null => {
  if (input.publishedAt) {
    return new Date(input.publishedAt).toISOString().slice(0, 19).replace("T", " ");
  }

  return null;
};

export const createProjectAdminRepository = (
  pool: DatabasePool
): ProjectAdminRepository => ({
  async resolveActor(authUserId) {
    return await resolveActor(pool, authUserId);
  },

  async listProjects() {
    return await createProjectReadRepository(pool).listAllProjects();
  },

  async createProject(input) {
    const id = randomUUID();

    try {
      await pool.execute(
        `
          INSERT INTO projects
            (id, slug, title, summary, type, category, status, is_public, created_by_user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          input.slug,
          input.title.trim(),
          input.summary?.trim() || null,
          input.type,
          input.category,
          input.status,
          input.isPublic,
          input.actorUserId
        ]
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new Error("project_slug_conflict");
      }

      throw error;
    }

    return await assertReadProject(pool, id);
  },

  async updateProject(id, input) {
    return await updateProjectFields(pool, id, input);
  },

  async createMilestone(projectId, input) {
    if (!await projectExists(pool, projectId)) {
      return "project-not-found";
    }

    await pool.execute(
      `
        INSERT INTO project_milestones
          (id, project_id, title, description, status, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        randomUUID(),
        projectId,
        input.title.trim(),
        input.description?.trim() || null,
        input.status,
        input.sortOrder
      ]
    );

    return await assertReadProject(pool, projectId);
  },

  async updateMilestone(projectId, milestoneId, input) {
    return await updateMilestoneFields(pool, projectId, milestoneId, input);
  },

  async reorderMilestones(projectId, input) {
    if (!await projectExists(pool, projectId)) {
      return "project-not-found";
    }

    for (const [index, milestoneId] of input.orderedIds.entries()) {
      const [result] = await pool.execute(
        "UPDATE project_milestones SET sort_order = ?, updated_at = NOW() WHERE id = ? AND project_id = ?",
        [index + 1, milestoneId, projectId]
      );

      if (typeof result === "object"
        && result !== null
        && "affectedRows" in result
        && result.affectedRows === 0) {
        return "milestone-not-found";
      }
    }

    return await assertReadProject(pool, projectId);
  },

  async createItem(projectId, input) {
    if (!await projectExists(pool, projectId)) {
      return "project-not-found";
    }

    if (input.parentItemId && !await itemExistsInProject(pool, projectId, input.parentItemId)) {
      return "parent-not-found";
    }

    await pool.execute(
      `
        INSERT INTO project_items
          (id, project_id, parent_item_id, title, description, kind, status, quantity, estimated_minor_amount, currency_code, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
      `,
      [
        randomUUID(),
        projectId,
        input.parentItemId || null,
        input.title.trim(),
        input.description?.trim() || null,
        input.kind,
        input.status,
        input.quantity,
        input.sortOrder
      ]
    );

    return await assertReadProject(pool, projectId);
  },

  async updateItem(projectId, itemId, input) {
    return await updateItemFields(pool, projectId, itemId, input);
  },

  async reorderItems(projectId, input) {
    if (!await projectExists(pool, projectId)) {
      return "project-not-found";
    }

    for (const [index, itemId] of input.orderedIds.entries()) {
      const [result] = await pool.execute(
        "UPDATE project_items SET sort_order = ?, updated_at = NOW() WHERE id = ? AND project_id = ?",
        [index + 1, itemId, projectId]
      );

      if (typeof result === "object"
        && result !== null
        && "affectedRows" in result
        && result.affectedRows === 0) {
        return "item-not-found";
      }
    }

    return await assertReadProject(pool, projectId);
  },

  async createUpdate(projectId, input) {
    if (!await projectExists(pool, projectId)) {
      return "project-not-found";
    }

    await pool.execute(
      `
        INSERT INTO project_updates
          (id, project_id, title, summary, body, status, is_visible, published_at, is_pinned, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ${input.status === "published" && !input.publishedAt ? "NOW()" : "?"}, ?, ?)
      `,
      [
        randomUUID(),
        projectId,
        input.title.trim(),
        input.summary?.trim() || null,
        input.body.trim(),
        input.status,
        input.isVisible,
        ...(input.status === "published" && !input.publishedAt ? [] : [normalizePublishedAt(input)]),
        input.isPinned,
        input.sortOrder
      ]
    );

    return await assertReadProject(pool, projectId);
  },

  async updateUpdate(projectId, updateId, input) {
    return await updateProjectUpdateFields(pool, projectId, updateId, input);
  }
});
