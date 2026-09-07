import type {
  PublicUpdateAdminInput,
  PublicUpdateAdminUpdateInput,
  PublicUpdateAdminPreview,
  PublicUpdateSource
} from "@maiks-yt/domain/updates";

import type { PublicUpdateAdminRevision } from "./public-update-admin-revision.service.js";

export type PublicUpdateAdminActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

export type PublicUpdateAdminListResult =
  | { ok: true; updates: readonly PublicUpdateSource[] }
  | { ok: false; reason: "public_update_admin_user_unlinked" | "public_update_admin_forbidden" };

export type PublicUpdateAdminMutationResult =
  | { ok: true; update: PublicUpdateSource }
  | {
    ok: false;
    reason:
      | "public_update_admin_user_unlinked"
      | "public_update_admin_forbidden"
      | "public_update_not_found"
      | "public_update_invalid_input"
      | "public_update_slug_conflict"
      | "public_update_example_immutable"
      | "public_update_preview_stale"
      | "public_update_must_be_draft";
  };

export type PublicUpdateAdminPreviewResult =
  | { ok: true; revision: PublicUpdateAdminRevision; update: PublicUpdateAdminPreview }
  | {
    ok: false;
    reason:
      | "public_update_admin_user_unlinked"
      | "public_update_admin_forbidden"
      | "public_update_not_found"
      | "public_update_invalid_input";
  };

export interface PublicUpdateAdminRepository {
  resolveActor(authUserId: string): Promise<PublicUpdateAdminActor | null>;
  listUpdates(): Promise<readonly PublicUpdateSource[]>;
  getUpdate(id: string): Promise<PublicUpdateSource | null>;
  createUpdate(input: PublicUpdateAdminInput & {
    actorUserId: string;
  }): Promise<PublicUpdateSource | "slug-conflict">;
  updateUpdate(id: string, input: PublicUpdateAdminUpdateInput & {
    actorUserId: string;
  }): Promise<PublicUpdateSource | "not-found" | "slug-conflict">;
  publishUpdate(
    id: string,
    actorUserId: string,
    expectedUpdate: PublicUpdateSource
  ): Promise<PublicUpdateSource | "not-found" | "revision-conflict" | "state-conflict">;
  unpublishUpdate(id: string, actorUserId: string): Promise<PublicUpdateSource | "not-found">;
}
