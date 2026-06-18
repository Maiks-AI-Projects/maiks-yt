import type { DatabasePool } from "@maiks-yt/database";
import type {
  CreatorLinkAvailability,
  CreatorLinkIcon,
  CreatorLinkPurpose,
  CreatorLinkSource
} from "@maiks-yt/domain";

import type { CreatorLinkReadRepository } from "./creator-link-read.types.js";

type CreatorLinkRow = {
  key: string;
  title: string;
  description: string;
  purpose: CreatorLinkPurpose;
  icon: CreatorLinkIcon;
  availability: CreatorLinkAvailability;
  href?: string | null;
  availabilityNote?: string | null;
  isPrimary: number | boolean;
  sortOrder: number;
  isPublished: number | boolean;
};

const mapCreatorLink = (row: CreatorLinkRow): CreatorLinkSource => ({
  key: row.key,
  title: row.title,
  description: row.description,
  purpose: row.purpose,
  icon: row.icon,
  availability: row.availability,
  href: row.href ?? null,
  availabilityNote: row.availabilityNote ?? null,
  isPrimary: Boolean(row.isPrimary),
  sortOrder: row.sortOrder,
  isPublished: Boolean(row.isPublished)
});

export const createCreatorLinkReadRepository = (
  pool: DatabasePool
): CreatorLinkReadRepository => ({
  async listPublishedLinks() {
    const [rows] = await pool.execute(
      `
        SELECT
          \`key\`,
          title,
          description,
          purpose,
          icon,
          availability,
          href,
          availability_note AS availabilityNote,
          is_primary AS isPrimary,
          sort_order AS sortOrder,
          is_published AS isPublished
        FROM creator_links
        WHERE is_published = 1
        ORDER BY sort_order, title, \`key\`
      `
    );

    return Array.isArray(rows)
      ? (rows as CreatorLinkRow[]).map(mapCreatorLink)
      : [];
  }
});
