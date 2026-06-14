export type PublicUpdateKind = "blog" | "project" | "stream";

export type PublicUpdate = {
  slug: string;
  title: string;
  summary: string;
  kind: PublicUpdateKind;
  publishedAt: string;
};

export const publicUpdates: readonly PublicUpdate[] = [
  {
    slug: "maiks-yt-v2-foundation",
    title: "Maiks.yt V2 foundation started",
    summary: "The new TypeScript platform is being rebuilt around overlays, accounts, project tracking, and transparent community tools.",
    kind: "project",
    publishedAt: "2026-06-14T00:00:00.000Z"
  }
];

export const getPublicUpdateUrl = (update: PublicUpdate): string => {
  return `/updates/${update.slug}`;
};
