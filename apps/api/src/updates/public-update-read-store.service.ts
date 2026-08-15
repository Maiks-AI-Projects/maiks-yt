import type { DatabasePool } from "@maiks-yt/database";
import type { PublicUpdateKind, PublicUpdateSource } from "@maiks-yt/domain/updates";

import type { PublicUpdateReadRepository } from "./public-update-read.types.js";

type PublicUpdateRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  kind: PublicUpdateKind;
  status: "draft" | "published";
  visibility: "hidden" | "public";
  publishedAt: Date | string | null;
  isPinned: boolean | number;
  isExample: boolean | number;
  updatedAt: Date | string;
};

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const mapUpdate = (row: PublicUpdateRow): PublicUpdateSource => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  summary: row.summary,
  body: row.body,
  kind: row.kind,
  status: row.status,
  visibility: row.visibility,
  publishedAt: row.publishedAt ? toIsoString(row.publishedAt) : null,
  isPinned: row.isPinned === true || row.isPinned === 1,
  isExample: row.isExample === true || row.isExample === 1,
  updatedAt: toIsoString(row.updatedAt)
});

const selectFields = `
  id,
  slug,
  title,
  summary,
  body,
  kind,
  status,
  visibility,
  published_at AS publishedAt,
  is_pinned AS isPinned,
  is_example AS isExample,
  updated_at AS updatedAt
`;

export const createPublicUpdateReadRepository = (
  pool: DatabasePool
): PublicUpdateReadRepository => ({
  async listUpdates() {
    const [rows] = await pool.execute(
      `
        SELECT ${selectFields}
        FROM public_updates
        WHERE status = 'published'
          AND visibility = 'public'
        ORDER BY is_pinned DESC, published_at DESC, title ASC
      `
    );

    return Array.isArray(rows)
      ? (rows as PublicUpdateRow[]).map(mapUpdate)
      : [];
  },

  async findUpdateBySlug(slug) {
    const [rows] = await pool.execute(
      `
        SELECT ${selectFields}
        FROM public_updates
        WHERE slug = ?
        LIMIT 1
      `,
      [slug]
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }

    return mapUpdate(rows[0] as PublicUpdateRow);
  }
});
