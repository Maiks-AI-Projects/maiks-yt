export const contentPageStatuses = ["draft", "published"] as const;
export type ContentPageStatus = typeof contentPageStatuses[number];

export const contentPageVisibilities = ["hidden", "public"] as const;
export type ContentPageVisibility = typeof contentPageVisibilities[number];

export const contentPageRouteScopes = ["primary"] as const;
export type ContentPageRouteScope = typeof contentPageRouteScopes[number];

export const pageCreatorManageCapability = "page-creator:manage" as const;

export type PageCreatorCapability =
  | "*"
  | typeof pageCreatorManageCapability;

export type ContentPageSource = {
  id: string;
  title: string;
  routeScope: ContentPageRouteScope;
  normalizedPath: string;
  status: ContentPageStatus;
  visibility: ContentPageVisibility;
  seoTitle: string | null;
  seoDescription: string | null;
  body: string;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContentPageAdminInput = {
  title: string;
  path: string;
  seoTitle?: string | null | undefined;
  seoDescription?: string | null | undefined;
  body: string;
};

export type ContentPageAdminUpdateInput = {
  title?: string | undefined;
  path?: string | undefined;
  seoTitle?: string | null | undefined;
  seoDescription?: string | null | undefined;
  body?: string | undefined;
};

export type PublicContentPage = {
  id: string;
  title: string;
  path: string;
  seoTitle: string | null;
  seoDescription: string | null;
  body: string;
  publishedAt: string;
  updatedAt: string;
};

export type ContentPagePathValidationResult =
  | {
    ok: true;
    path: string;
  }
  | {
    ok: false;
    reason: "empty_path" | "path_too_long" | "malformed_path" | "reserved_path";
  };
