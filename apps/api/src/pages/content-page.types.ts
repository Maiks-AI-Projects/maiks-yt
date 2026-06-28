import type {
  ContentPageAdminInput,
  ContentPageAdminUpdateInput,
  ContentPageSource,
  PublicContentPage
} from "@maiks-yt/domain/pages";

export type ContentPageAdminActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type ContentPageCreateInput = ContentPageAdminInput;
export type ContentPageUpdateInput = ContentPageAdminUpdateInput;

export type ContentPageAdminListResult =
  | {
    ok: true;
    pages: readonly ContentPageSource[];
  }
  | {
    ok: false;
    reason: "content_page_admin_user_unlinked" | "content_page_admin_forbidden";
  };

export type ContentPageAdminMutationResult =
  | {
    ok: true;
    page: ContentPageSource;
  }
  | {
    ok: false;
    reason:
      | "content_page_admin_user_unlinked"
      | "content_page_admin_forbidden"
      | "content_page_not_found"
      | "content_page_invalid_input"
      | "content_page_reserved_path"
      | "content_page_path_conflict";
  };

export type ContentPagePreviewResult =
  | {
    ok: true;
    page: ContentPageSource;
  }
  | {
    ok: false;
    reason:
      | "content_page_admin_user_unlinked"
      | "content_page_admin_forbidden"
      | "content_page_not_found";
  };

export type PublicContentPageResult =
  | {
    ok: true;
    page: PublicContentPage;
  }
  | {
    ok: false;
    reason: "content_page_not_found" | "content_page_ambiguous";
  };

export interface ContentPageRepository {
  resolveActor(authUserId: string): Promise<ContentPageAdminActor | null>;
  listPages(): Promise<readonly ContentPageSource[]>;
  getPage(id: string): Promise<ContentPageSource | null>;
  createPage(input: ContentPageCreateInput & {
    normalizedPath: string;
    actorUserId: string;
  }): Promise<ContentPageSource>;
  updatePage(id: string, input: ContentPageUpdateInput & {
    normalizedPath?: string;
    actorUserId: string;
  }): Promise<ContentPageSource | "not-found" | "path-conflict">;
  publishPage(id: string, actorUserId: string): Promise<ContentPageSource | "not-found">;
  unpublishPage(id: string, actorUserId: string): Promise<ContentPageSource | "not-found">;
  findPublicPagesByPath(normalizedPath: string): Promise<readonly ContentPageSource[]>;
}
