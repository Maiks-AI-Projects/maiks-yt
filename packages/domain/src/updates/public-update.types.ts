export const publicUpdateKinds = ["post", "stream-recap", "announcement"] as const;

export type PublicUpdateKind = typeof publicUpdateKinds[number];
export type PublicUpdateStatus = "draft" | "published";
export type PublicUpdateVisibility = "hidden" | "public";

export type PublicUpdateSource = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  kind: PublicUpdateKind;
  status: PublicUpdateStatus;
  visibility: PublicUpdateVisibility;
  publishedAt: string | null;
  isPinned: boolean;
  isExample: boolean;
  updatedAt: string;
};

export type PublicUpdateSummary = Pick<
  PublicUpdateSource,
  "slug" | "title" | "summary" | "kind" | "isPinned" | "updatedAt"
> & {
  publishedAt: string;
};

export type PublicUpdateDetail = PublicUpdateSummary & {
  body: string;
};

export type PublicUpdateAdminPreview = PublicUpdateDetail & Pick<
  PublicUpdateSource,
  "id" | "isExample"
>;
