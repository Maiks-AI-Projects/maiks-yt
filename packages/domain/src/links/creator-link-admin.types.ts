import type {
  CreatorLinkAvailability,
  CreatorLinkIcon,
  CreatorLinkPurpose,
  CreatorLinkSource
} from "./creator-link.types.js";

export const creatorLinkAdminManageCapability = "creator-links:manage" as const;

export type CreatorLinkAdminCapability =
  | "*"
  | typeof creatorLinkAdminManageCapability;

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
  href?: string | null;
  availabilityNote?: string | null;
  isPrimary: boolean;
  sortOrder: number;
  isPublished: boolean;
};

export type CreatorLinkAdminUpdateInput = Partial<CreatorLinkAdminInput>;

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
