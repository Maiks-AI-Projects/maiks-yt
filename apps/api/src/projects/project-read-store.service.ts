import type { DatabasePool } from "@maiks-yt/database";
import type {
  MilestoneStatus,
  ProjectCategory,
  ProjectItemKind,
  ProjectItemLinkRelationship,
  ProjectItemStatus,
  ProjectReadItemLinkSource,
  ProjectReadItemSource,
  ProjectReadMilestoneSource,
  ProjectReadModelSource,
  ProjectReadUpdateSource,
  ProjectStatus,
  ProjectUpdateStatus,
  ProjectType
} from "@maiks-yt/domain/projects";

import type { ProjectReadRepository } from "./project-read.types.js";

type ProjectRow = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  type: ProjectType;
  category: ProjectCategory;
  status: ProjectStatus;
  isPublic: number | boolean;
  updatedAt: Date | string;
};

type MilestoneRow = {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: MilestoneStatus;
  sortOrder: number;
};

type ItemRow = {
  id: string;
  projectId: string;
  parentItemId?: string | null;
  title: string;
  description?: string | null;
  kind: ProjectItemKind;
  status: ProjectItemStatus;
  quantity: number;
  estimatedMinorAmount?: number | null;
  currencyCode?: string | null;
  sortOrder: number;
};

type ItemLinkRow = {
  id: string;
  projectItemId: string;
  provider: string;
  url: string;
  label: string;
  relationship: ProjectItemLinkRelationship;
  lastSeenMinorAmount?: number | null;
  currencyCode?: string | null;
};

type UpdateRow = {
  id: string;
  projectId: string;
  title: string;
  summary?: string | null;
  body: string;
  status: ProjectUpdateStatus;
  isVisible: number | boolean;
  publishedAt?: Date | string | null;
  isPinned: number | boolean;
  sortOrder: number;
};

const projectSelect = `
  SELECT
    id,
    slug,
    title,
    summary,
    type,
    category,
    status,
    is_public AS isPublic,
    updated_at AS updatedAt
  FROM projects
`;

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const firstRow = <Row>(rows: unknown): Row | null =>
  Array.isArray(rows) && rows.length > 0 ? rows[0] as Row : null;

const mapMilestone = (row: MilestoneRow): ProjectReadMilestoneSource => ({
  id: row.id,
  title: row.title,
  ...(row.description ? { description: row.description } : {}),
  status: row.status,
  sortOrder: row.sortOrder
});

const mapItem = (
  row: ItemRow,
  links: readonly ProjectReadItemLinkSource[]
): ProjectReadItemSource => ({
  id: row.id,
  ...(row.parentItemId ? { parentItemId: row.parentItemId } : {}),
  title: row.title,
  ...(row.description ? { description: row.description } : {}),
  kind: row.kind,
  status: row.status,
  quantity: row.quantity,
  estimatedMinorAmount: row.estimatedMinorAmount ?? null,
  currencyCode: row.currencyCode ?? null,
  sortOrder: row.sortOrder,
  links
});

const mapItemLink = (row: ItemLinkRow): ProjectReadItemLinkSource => ({
  id: row.id,
  provider: row.provider,
  url: row.url,
  label: row.label,
  relationship: row.relationship,
  lastSeenMinorAmount: row.lastSeenMinorAmount ?? null,
  currencyCode: row.currencyCode ?? null
});

const mapUpdate = (row: UpdateRow): ProjectReadUpdateSource => ({
  id: row.id,
  title: row.title,
  ...(row.summary ? { summary: row.summary } : {}),
  body: row.body,
  status: row.status,
  isVisible: Boolean(row.isVisible),
  ...(row.publishedAt ? { publishedAt: toIsoString(row.publishedAt) } : {}),
  isPinned: Boolean(row.isPinned),
  sortOrder: row.sortOrder
});

const mapProject = (
  row: ProjectRow,
  milestones: readonly ProjectReadMilestoneSource[],
  items: readonly ProjectReadItemSource[],
  updates: readonly ProjectReadUpdateSource[]
): ProjectReadModelSource => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  summary: row.summary ?? null,
  type: row.type,
  category: row.category,
  status: row.status,
  isPublic: Boolean(row.isPublic),
  updatedAt: toIsoString(row.updatedAt),
  milestones,
  items,
  updates
});

const loadMilestonesByProjectId = async (
  pool: Pick<DatabasePool, "execute">,
  projectIds: readonly string[]
): Promise<Map<string, ProjectReadMilestoneSource[]>> => {
  if (projectIds.length === 0) {
    return new Map();
  }

  const [rows] = await pool.execute(
    `
      SELECT
        id,
        project_id AS projectId,
        title,
        description,
        status,
        sort_order AS sortOrder
      FROM project_milestones
      WHERE project_id IN (${projectIds.map(() => "?").join(", ")})
      ORDER BY sort_order, title
    `,
    [...projectIds]
  );
  const groupedMilestones = new Map<string, ProjectReadMilestoneSource[]>();

  if (!Array.isArray(rows)) {
    return groupedMilestones;
  }

  for (const row of rows as MilestoneRow[]) {
    const milestones = groupedMilestones.get(row.projectId) ?? [];
    milestones.push(mapMilestone(row));
    groupedMilestones.set(row.projectId, milestones);
  }

  return groupedMilestones;
};

const loadItemsByProjectId = async (
  pool: Pick<DatabasePool, "execute">,
  projectIds: readonly string[]
): Promise<Map<string, ProjectReadItemSource[]>> => {
  if (projectIds.length === 0) {
    return new Map();
  }

  const [rows] = await pool.execute(
    `
      SELECT
        id,
        project_id AS projectId,
        parent_item_id AS parentItemId,
        title,
        description,
        kind,
        status,
        quantity,
        estimated_minor_amount AS estimatedMinorAmount,
        currency_code AS currencyCode,
        sort_order AS sortOrder
      FROM project_items
      WHERE project_id IN (${projectIds.map(() => "?").join(", ")})
      ORDER BY sort_order, title
    `,
    [...projectIds]
  );
  const groupedItems = new Map<string, ProjectReadItemSource[]>();

  if (!Array.isArray(rows)) {
    return groupedItems;
  }

  const itemRows = rows as ItemRow[];
  const itemLinksByItemId = await loadItemLinksByItemId(pool, itemRows.map((row) => row.id));

  for (const row of itemRows) {
    const items = groupedItems.get(row.projectId) ?? [];
    items.push(mapItem(row, itemLinksByItemId.get(row.id) ?? []));
    groupedItems.set(row.projectId, items);
  }

  return groupedItems;
};

const loadItemLinksByItemId = async (
  pool: Pick<DatabasePool, "execute">,
  itemIds: readonly string[]
): Promise<Map<string, ProjectReadItemLinkSource[]>> => {
  if (itemIds.length === 0) {
    return new Map();
  }

  const [rows] = await pool.execute(
    `
      SELECT
        id,
        project_item_id AS projectItemId,
        provider,
        url,
        label,
        relationship,
        last_seen_minor_amount AS lastSeenMinorAmount,
        currency_code AS currencyCode
      FROM project_item_links
      WHERE project_item_id IN (${itemIds.map(() => "?").join(", ")})
      ORDER BY relationship, label
    `,
    [...itemIds]
  );
  const groupedLinks = new Map<string, ProjectReadItemLinkSource[]>();

  if (!Array.isArray(rows)) {
    return groupedLinks;
  }

  for (const row of rows as ItemLinkRow[]) {
    const links = groupedLinks.get(row.projectItemId) ?? [];
    links.push(mapItemLink(row));
    groupedLinks.set(row.projectItemId, links);
  }

  return groupedLinks;
};

const loadUpdatesByProjectId = async (
  pool: Pick<DatabasePool, "execute">,
  projectIds: readonly string[]
): Promise<Map<string, ProjectReadUpdateSource[]>> => {
  if (projectIds.length === 0) {
    return new Map();
  }

  const [rows] = await pool.execute(
    `
      SELECT
        id,
        project_id AS projectId,
        title,
        summary,
        body,
        status,
        is_visible AS isVisible,
        published_at AS publishedAt,
        is_pinned AS isPinned,
        sort_order AS sortOrder
      FROM project_updates
      WHERE project_id IN (${projectIds.map(() => "?").join(", ")})
      ORDER BY is_pinned DESC, sort_order, published_at DESC, title
    `,
    [...projectIds]
  );
  const groupedUpdates = new Map<string, ProjectReadUpdateSource[]>();

  if (!Array.isArray(rows)) {
    return groupedUpdates;
  }

  for (const row of rows as UpdateRow[]) {
    const updates = groupedUpdates.get(row.projectId) ?? [];
    updates.push(mapUpdate(row));
    groupedUpdates.set(row.projectId, updates);
  }

  return groupedUpdates;
};

const hydrateProjects = async (
  pool: Pick<DatabasePool, "execute">,
  rows: readonly ProjectRow[]
): Promise<readonly ProjectReadModelSource[]> => {
  const projectIds = rows.map((row) => row.id);
  const milestonesByProjectId = await loadMilestonesByProjectId(pool, projectIds);
  const itemsByProjectId = await loadItemsByProjectId(pool, projectIds);
  const updatesByProjectId = await loadUpdatesByProjectId(pool, projectIds);

  return rows.map((row) => mapProject(
    row,
    milestonesByProjectId.get(row.id) ?? [],
    itemsByProjectId.get(row.id) ?? [],
    updatesByProjectId.get(row.id) ?? []
  ));
};

export const createProjectReadRepository = (
  pool: DatabasePool
): ProjectReadRepository => ({
  async listProjects() {
    const [rows] = await pool.execute(
      `
        ${projectSelect}
        WHERE is_public = 1
          AND status IN ('planning', 'active', 'completed')
      `
    );

    return Array.isArray(rows)
      ? hydrateProjects(pool, rows as ProjectRow[])
      : [];
  },

  async findProjectBySlug(slug) {
    const [rows] = await pool.execute(
      `
        ${projectSelect}
        WHERE slug = ?
          AND is_public = 1
          AND status IN ('planning', 'active', 'completed')
        LIMIT 1
      `,
      [slug]
    );
    const row = firstRow<ProjectRow>(rows);

    if (!row) {
      return null;
    }

    const projects = await hydrateProjects(pool, [row]);

    return projects[0] ?? null;
  },

  async listAllProjects() {
    const [rows] = await pool.execute(
      `
        ${projectSelect}
        ORDER BY updated_at DESC, title
      `
    );

    return Array.isArray(rows)
      ? hydrateProjects(pool, rows as ProjectRow[])
      : [];
  },

  async findAnyProjectById(id) {
    const [rows] = await pool.execute(
      `
        ${projectSelect}
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );
    const row = firstRow<ProjectRow>(rows);

    if (!row) {
      return null;
    }

    const projects = await hydrateProjects(pool, [row]);

    return projects[0] ?? null;
  }
});
