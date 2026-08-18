import type { DatabasePool } from "@maiks-yt/database";

import type { MusicPlayHistoryRecord } from "./music.types.js";

export type QueryExecutor = Pick<DatabasePool, "execute">;

export const toIso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export const toIsoOrNull = (value: Date | string | null | undefined): string | null =>
  value ? toIso(value) : null;

export const optionalText = (value: string | null | undefined): string | null =>
  value?.trim() || null;

export const parseStringArray = (value: unknown): readonly string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  }

  return [];
};

export const parseSafetySnapshot = (value: unknown): MusicPlayHistoryRecord["safetyTagsSnapshot"] => {
  const parsed = typeof value === "string"
    ? (() => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return null;
      }
    })()
    : value;

  if (typeof parsed !== "object" || parsed === null) {
    return {
      safetyTags: [],
      explicitContent: false,
      instrumental: false
    };
  }

  const record = parsed as {
    safetyTags?: unknown;
    explicitContent?: unknown;
    instrumental?: unknown;
  };

  return {
    safetyTags: parseStringArray(record.safetyTags),
    explicitContent: record.explicitContent === true,
    instrumental: record.instrumental === true
  };
};

export const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object"
  && error !== null
  && "code" in error
  && error.code === "ER_DUP_ENTRY";

export const bool = (value: boolean | number | null | undefined): boolean => value === true || value === 1;

export const mapRows = <TRow, TOut>(rows: unknown, mapper: (row: TRow) => TOut): readonly TOut[] =>
  Array.isArray(rows) ? (rows as TRow[]).map(mapper) : [];
