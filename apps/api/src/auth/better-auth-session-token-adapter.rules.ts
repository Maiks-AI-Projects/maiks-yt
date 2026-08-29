import type { Where } from "better-auth/types";

import type { AuthDataCipher } from "./auth-sensitive-field-crypto.service.js";
import type { AuthSessionTokenHasher } from "./auth-session-token-hash.service.js";

export type SessionTokenWherePlans = {
  hashed: Where[];
  legacy: Where[];
};

const isAndWhere = (condition: Where): boolean =>
  condition.connector === undefined || condition.connector === "AND";

const hashTokenValue = (
  condition: Where,
  hasher: AuthSessionTokenHasher
): string | string[] | null => {
  const operator = condition.operator ?? "eq";

  if (operator === "eq" && typeof condition.value === "string") {
    return hasher.hash(condition.value);
  }

  if (
    operator === "in"
    && Array.isArray(condition.value)
    && condition.value.every((value): value is string => typeof value === "string")
  ) {
    return condition.value.map((value) => hasher.hash(value));
  }

  return null;
};

export const createSessionTokenWherePlans = (
  model: string,
  where: Where[] | undefined,
  hasher: AuthSessionTokenHasher | null
): SessionTokenWherePlans | null => {
  if (model !== "session" || !where || !hasher || !where.every(isAndWhere)) {
    return null;
  }

  const tokenConditions = where.filter((condition) => condition.field === "token");

  if (tokenConditions.length !== 1) {
    return null;
  }

  const tokenCondition = tokenConditions[0];
  const hashedValue = tokenCondition ? hashTokenValue(tokenCondition, hasher) : null;

  if (hashedValue === null) {
    return null;
  }

  return {
    hashed: where.map((condition) => condition === tokenCondition
      ? {
        ...condition,
        field: "tokenHash",
        value: hashedValue
      }
      : condition),
    legacy: [
      ...where,
      {
        field: "tokenHash",
        value: null,
        operator: "eq",
        connector: "AND"
      }
    ]
  };
};

export const protectSessionWrite = <T extends Record<string, unknown>>(
  model: string,
  data: T,
  cipher: AuthDataCipher | null,
  hasher: AuthSessionTokenHasher | null
): T => {
  if (model !== "session" || !hasher || !cipher) {
    return data;
  }

  const next: Record<string, unknown> = { ...data };
  delete next.tokenHash;

  if (typeof next.token === "string") {
    next.tokenHash = hasher.hash(next.token);
    next.token = cipher.encrypt({
      model: "session",
      field: "token",
      plaintext: next.token
    });
  }

  return next as T;
};

export const revealSessionToken = <T>(
  model: string,
  row: T,
  cipher: AuthDataCipher | null
): T => {
  if (
    model !== "session"
    || !row
    || typeof row !== "object"
    || Array.isArray(row)
  ) {
    return row;
  }

  const next = { ...row } as Record<string, unknown>;

  if (cipher && typeof next.token === "string") {
    next.token = cipher.decrypt({
      model: "session",
      field: "token",
      storedValue: next.token
    });
  }

  delete next.tokenHash;
  return next as T;
};

export const mergeSessionRows = <T>(hashedRows: T[], legacyRows: T[]): T[] => {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const row of [...hashedRows, ...legacyRows]) {
    const identity = row && typeof row === "object" && !Array.isArray(row)
      ? String((row as Record<string, unknown>).id ?? (row as Record<string, unknown>).token ?? "")
      : "";

    if (identity && seen.has(identity)) {
      continue;
    }

    if (identity) {
      seen.add(identity);
    }

    merged.push(row);
  }

  return merged;
};

export const applyFindManyWindow = <T>(
  rows: T[],
  input: {
    sortBy?: { field: string; direction: "asc" | "desc" } | undefined;
    offset?: number | undefined;
    limit?: number | undefined;
  }
): T[] => {
  const sorted = input.sortBy
    ? [...rows].sort((left, right) => {
      const leftValue = left && typeof left === "object"
        ? (left as Record<string, unknown>)[input.sortBy!.field]
        : undefined;
      const rightValue = right && typeof right === "object"
        ? (right as Record<string, unknown>)[input.sortBy!.field]
        : undefined;
      const leftComparable = leftValue instanceof Date ? leftValue.getTime() : leftValue;
      const rightComparable = rightValue instanceof Date ? rightValue.getTime() : rightValue;
      const comparison = leftComparable === rightComparable
        ? 0
        : leftComparable === undefined || leftComparable === null
          ? -1
          : rightComparable === undefined || rightComparable === null
            ? 1
            : leftComparable < rightComparable
              ? -1
              : 1;

      return input.sortBy!.direction === "asc" ? comparison : -comparison;
    })
    : rows;
  const offset = input.offset ?? 0;
  const end = input.limit === undefined ? undefined : offset + input.limit;

  return sorted.slice(offset, end);
};
