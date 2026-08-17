import type { ProfileSettings, ProfileSettingsInput } from "./profile-settings.types.js";

export const profileDisplayNameMinLength = 2;
export const profileDisplayNameMaxLength = 40;

export type ProfileSettingsValidationResult =
  | { ok: true; value: ProfileSettings }
  | { ok: false; reason: "invalid_display_name" };

const normalizeDisplayName = (value: string): string => value.trim().replace(/\s+/gu, " ");

export const validateProfileSettings = (input: ProfileSettingsInput): ProfileSettingsValidationResult => {
  if (/[\p{Cc}\p{Cf}]/u.test(input.displayName)) {
    return { ok: false, reason: "invalid_display_name" };
  }

  const displayName = normalizeDisplayName(input.displayName);

  if (
    displayName.length < profileDisplayNameMinLength
    || displayName.length > profileDisplayNameMaxLength
  ) {
    return { ok: false, reason: "invalid_display_name" };
  }

  return {
    ok: true,
    value: {
      displayName
    }
  };
};
