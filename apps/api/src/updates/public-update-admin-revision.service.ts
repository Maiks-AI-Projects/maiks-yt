import { createHash } from "node:crypto";

import type { PublicUpdateSource } from "@maiks-yt/domain/updates";

declare const publicUpdateAdminRevisionBrand: unique symbol;

export type PublicUpdateAdminRevision = string & {
  readonly [publicUpdateAdminRevisionBrand]: true;
};

export const publicUpdateAdminRevisionPattern = /^[a-f0-9]{64}$/;

export const isPublicUpdateAdminRevision = (
  value: unknown
): value is PublicUpdateAdminRevision =>
  typeof value === "string" && publicUpdateAdminRevisionPattern.test(value);

export const createPublicUpdateAdminRevision = (
  update: PublicUpdateSource
): PublicUpdateAdminRevision => {
  const canonicalSnapshot = JSON.stringify([
    "public-update-admin-revision-v1",
    ["id", update.id],
    ["slug", update.slug],
    ["title", update.title],
    ["summary", update.summary],
    ["body", update.body],
    ["kind", update.kind],
    ["status", update.status],
    ["visibility", update.visibility],
    ["publishedAt", update.publishedAt],
    ["isPinned", update.isPinned],
    ["isExample", update.isExample],
    ["updatedAt", update.updatedAt]
  ]);

  return createHash("sha256")
    .update(canonicalSnapshot, "utf8")
    .digest("hex") as PublicUpdateAdminRevision;
};
