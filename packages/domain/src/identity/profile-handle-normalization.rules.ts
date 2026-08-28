import type { ProfileHandleNormalizationResult } from "./profile-handle.types.js";

export const profileHandleMinLength = 3;
export const profileHandleMaxLength = 32;

export const reservedProfileHandles = [
  "account",
  "admin",
  "api",
  "auth",
  "games",
  "image",
  "images",
  "maiks",
  "me",
  "new",
  "privacy",
  "profiles",
  "projects",
  "schedule",
  "search",
  "settings",
  "support",
  "tools",
  "updates"
] as const;

export const assignableReservedProfileHandles = ["maiks"] as const;

const reservedProfileHandleSet = new Set<string>(reservedProfileHandles);
const assignableReservedProfileHandleSet = new Set<string>(assignableReservedProfileHandles);
const asciiWhitespacePattern = /^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g;
const canonicalProfileHandlePattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

type ReservedHandleOptions = {
  allowedReservedHandles?: readonly string[];
};

const trimAsciiWhitespace = (value: string): string => value.replace(asciiWhitespacePattern, "");

const lowercaseAscii = (value: string): string =>
  value.replace(/[A-Z]/g, (character) => character.toLowerCase());

export const isReservedProfileHandle = (handle: string): boolean => reservedProfileHandleSet.has(handle);

export const isAssignableReservedProfileHandle = (handle: string): boolean =>
  assignableReservedProfileHandleSet.has(handle);

export const isCanonicalProfileHandle = (handle: string): boolean =>
  handle.length >= profileHandleMinLength
  && handle.length <= profileHandleMaxLength
  && canonicalProfileHandlePattern.test(handle)
  && !handle.includes("--");

const allowsReservedHandle = (handle: string, options: ReservedHandleOptions | undefined): boolean =>
  isAssignableReservedProfileHandle(handle)
  && options?.allowedReservedHandles?.includes(handle) === true;

export const normalizeProfileHandleInput = (
  input: string,
  options?: ReservedHandleOptions
): ProfileHandleNormalizationResult => {
  const trimmed = trimAsciiWhitespace(input);
  const withoutPrefix = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  const handle = lowercaseAscii(withoutPrefix);

  if (!/^[\x00-\x7F]*$/u.test(handle) || /[\x00-\x20\x7F]/u.test(handle)) {
    return { ok: false, reason: "invalid_character" };
  }

  if (!/^[a-z0-9-]*$/u.test(handle)) {
    return { ok: false, reason: "invalid_character" };
  }

  if (handle.length < profileHandleMinLength) {
    return { ok: false, reason: "handle_too_short" };
  }

  if (handle.length > profileHandleMaxLength) {
    return { ok: false, reason: "handle_too_long" };
  }

  if (handle.startsWith("-")) {
    return { ok: false, reason: "leading_hyphen" };
  }

  if (handle.endsWith("-")) {
    return { ok: false, reason: "trailing_hyphen" };
  }

  if (handle.includes("--")) {
    return { ok: false, reason: "consecutive_hyphen" };
  }

  if (isReservedProfileHandle(handle) && !allowsReservedHandle(handle, options)) {
    return { ok: false, reason: "reserved_handle" };
  }

  return { ok: true, handle };
};
