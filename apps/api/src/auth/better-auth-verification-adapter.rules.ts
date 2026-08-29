import type { Where } from "better-auth/types";

import type { AuthDataCipher } from "./auth-sensitive-field-crypto.service.js";
import type { AuthVerificationIdentifierHasher } from "./auth-verification-identifier-hash.service.js";

export type VerificationIdentifierWherePlans = {
  hashed: Where[];
  legacy: Where[];
};

const hashIdentifierValue = (
  condition: Where,
  hasher: AuthVerificationIdentifierHasher
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

export const createVerificationIdentifierWherePlans = (
  model: string,
  where: Where[] | undefined,
  hasher: AuthVerificationIdentifierHasher | null
): VerificationIdentifierWherePlans | null => {
  if (
    model !== "verification"
    || !where
    || !hasher
    || !where.every((condition) => condition.connector === undefined || condition.connector === "AND")
  ) {
    return null;
  }

  const identifierConditions = where.filter((condition) => condition.field === "identifier");

  if (identifierConditions.length !== 1) {
    return null;
  }

  const identifierCondition = identifierConditions[0];
  const hashedValue = identifierCondition
    ? hashIdentifierValue(identifierCondition, hasher)
    : null;

  if (hashedValue === null) {
    return null;
  }

  return {
    hashed: where.map((condition) => condition === identifierCondition
      ? { ...condition, field: "identifierHash", value: hashedValue }
      : condition),
    legacy: [
      ...where,
      {
        field: "identifierHash",
        value: null,
        operator: "eq",
        connector: "AND"
      }
    ]
  };
};

export const protectVerificationWrite = <T extends Record<string, unknown>>(
  model: string,
  data: T,
  cipher: AuthDataCipher | null,
  hasher: AuthVerificationIdentifierHasher | null
): T => {
  if (model !== "verification" || !cipher || !hasher) {
    return data;
  }

  const next: Record<string, unknown> = { ...data };
  delete next.identifierHash;

  if (typeof next.identifier === "string") {
    next.identifierHash = hasher.hash(next.identifier);
    next.identifier = cipher.encrypt({
      model: "verification",
      field: "identifier",
      plaintext: next.identifier
    });
  }

  if (typeof next.value === "string") {
    next.value = cipher.encrypt({
      model: "verification",
      field: "value",
      plaintext: next.value
    });
  }

  return next as T;
};

export const revealVerification = <T>(
  model: string,
  row: T,
  cipher: AuthDataCipher | null,
  hasher: AuthVerificationIdentifierHasher | null
): T => {
  if (
    model !== "verification"
    || !row
    || typeof row !== "object"
    || Array.isArray(row)
  ) {
    return row;
  }

  const next = { ...row } as Record<string, unknown>;

  if (cipher && hasher && typeof next.identifier === "string") {
    next.identifier = cipher.decrypt({
      model: "verification",
      field: "identifier",
      storedValue: next.identifier
    });
  }

  if (cipher && hasher && typeof next.value === "string") {
    next.value = cipher.decrypt({
      model: "verification",
      field: "value",
      storedValue: next.value
    });
  }

  delete next.identifierHash;
  return next as T;
};
