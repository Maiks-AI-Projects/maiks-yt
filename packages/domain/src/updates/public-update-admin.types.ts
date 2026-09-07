import type { PublicUpdateKind } from "./public-update.types.js";

export const publicUpdateManageCapability = "updates:manage" as const;

export type PublicUpdateAdminCapability =
  | "*"
  | typeof publicUpdateManageCapability;

export type PublicUpdateAdminInput = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  kind: PublicUpdateKind;
  isPinned: boolean;
};

export type PublicUpdateAdminUpdateInput = {
  [Key in keyof PublicUpdateAdminInput]?: PublicUpdateAdminInput[Key] | undefined;
};

export type PublicUpdateAdminValidationResult =
  | {
    ok: true;
    update: PublicUpdateAdminInput;
  }
  | {
    ok: false;
    reason: "public_update_invalid_input";
  };
