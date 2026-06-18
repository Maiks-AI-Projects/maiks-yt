import type {
  CreatorLinkAvailability,
  CreatorLinkIcon,
  CreatorLinkPurpose,
  CreatorLinkSource
} from "@maiks-yt/domain";

export type CreatorLinkAdminActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type CreatorLinkAdminInput = {
  key: string;
  title: string;
  description: string;
  purpose: CreatorLinkPurpose;
  icon: CreatorLinkIcon;
  availability: CreatorLinkAvailability;
  href?: string | null | undefined;
  availabilityNote?: string | null | undefined;
  isPrimary: boolean;
  sortOrder: number;
  isPublished: boolean;
};

export type CreatorLinkAdminUpdateInput = {
  key?: string | undefined;
  title?: string | undefined;
  description?: string | undefined;
  purpose?: CreatorLinkPurpose | undefined;
  icon?: CreatorLinkIcon | undefined;
  availability?: CreatorLinkAvailability | undefined;
  href?: string | null | undefined;
  availabilityNote?: string | null | undefined;
  isPrimary?: boolean | undefined;
  sortOrder?: number | undefined;
  isPublished?: boolean | undefined;
};

export type CreatorLinkAdminReorderInput = {
  orderedKeys: readonly string[];
};

export type CreatorLinkAdminListResult =
  | {
    ok: true;
    links: readonly CreatorLinkSource[];
  }
  | {
    ok: false;
    reason: "creator_link_admin_user_unlinked" | "creator_link_admin_forbidden";
  };

export type CreatorLinkAdminMutationResult =
  | {
    ok: true;
    link: CreatorLinkSource;
  }
  | {
    ok: false;
    reason:
      | "creator_link_admin_user_unlinked"
      | "creator_link_admin_forbidden"
      | "creator_link_not_found"
      | "creator_link_key_conflict"
      | "creator_link_admin_invalid_input";
  };

export type CreatorLinkAdminReorderResult =
  | {
    ok: true;
    links: readonly CreatorLinkSource[];
  }
  | {
    ok: false;
    reason:
      | "creator_link_admin_user_unlinked"
      | "creator_link_admin_forbidden"
      | "creator_link_not_found"
      | "creator_link_admin_invalid_input";
  };

export interface CreatorLinkAdminRepository {
  resolveActor(authUserId: string): Promise<CreatorLinkAdminActor | null>;
  listLinks(): Promise<readonly CreatorLinkSource[]>;
  createLink(input: CreatorLinkAdminInput): Promise<CreatorLinkSource>;
  updateLink(key: string, input: CreatorLinkAdminInput): Promise<CreatorLinkSource | "not-found" | "key-conflict">;
  reorderLinks(input: CreatorLinkAdminReorderInput): Promise<readonly CreatorLinkSource[] | "not-found">;
}

export type CreatorLinkAdminWriteResult =
  | CreatorLinkAdminMutationResult
  | CreatorLinkAdminReorderResult;
