import type { BetterAuthOptions } from "better-auth";
import type { DBAdapter, DBTransactionAdapter, Where } from "better-auth/types";
import { describe, expect, it, vi } from "vitest";

import {
  createAuthDataCipher,
  isKnownAuthDataEnvelope
} from "../../src/auth/auth-sensitive-field-crypto.service.js";
import { createAuthVerificationIdentifierHasher } from "../../src/auth/auth-verification-identifier-hash.service.js";
import { withProtectedAuthSensitiveFields } from "../../src/auth/better-auth-sensitive-field-adapter.service.js";

const hasher = createAuthVerificationIdentifierHasher(Buffer.from("f".repeat(32), "utf8"));
const cipher = createAuthDataCipher(Buffer.from("g".repeat(32), "utf8"));

const encryptVerification = (identifier: string, value: string) => ({
  identifier: cipher.encrypt({ model: "verification", field: "identifier", plaintext: identifier }),
  identifierHash: hasher.hash(identifier),
  value: cipher.encrypt({ model: "verification", field: "value", plaintext: value })
});

const hasCondition = (where: Where[], field: string, value: unknown): boolean =>
  where.some((condition) => condition.field === field && condition.value === value);

const createBaseAdapter = () => {
  const calls = {
    create: vi.fn(),
    findOne: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    consumeOne: vi.fn()
  };
  const transactionAdapter: DBTransactionAdapter<BetterAuthOptions> = {
    id: "fake-verification-transaction",
    create: calls.create.mockImplementation(async ({ data }) => ({ id: "verification-1", ...data })),
    findOne: calls.findOne.mockResolvedValue(null),
    findMany: calls.findMany.mockResolvedValue([]),
    count: calls.count.mockResolvedValue(0),
    update: calls.update.mockResolvedValue(null),
    updateMany: calls.updateMany.mockResolvedValue(0),
    delete: calls.delete.mockResolvedValue(undefined),
    deleteMany: calls.deleteMany.mockResolvedValue(0),
    consumeOne: calls.consumeOne.mockResolvedValue(null)
  };
  const adapter: DBAdapter<BetterAuthOptions> = {
    ...transactionAdapter,
    id: "fake-verification-adapter",
    transaction: async (callback) => callback(transactionAdapter)
  };
  const wrapped = withProtectedAuthSensitiveFields(() => adapter, {
    cipher,
    sessionTokenHasher: null,
    verificationIdentifierHasher: hasher
  })({} as BetterAuthOptions);

  return { calls, wrapped };
};

describe("Better Auth verification protection adapter", () => {
  it("writes encrypted identifier/value fields plus an identifier hash", async () => {
    const { calls, wrapped } = createBaseAdapter();
    const created = await wrapped.create<Record<string, unknown>>({
      model: "verification",
      data: {
        identifier: "oauth-state-identifier",
        identifierHash: "untrusted-input",
        value: "oauth-state-value"
      }
    });
    const written = calls.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;

    expect(isKnownAuthDataEnvelope(String(written.identifier))).toBe(true);
    expect(isKnownAuthDataEnvelope(String(written.value))).toBe(true);
    expect(written.identifierHash).toBe(hasher.hash("oauth-state-identifier"));
    expect(created).toEqual({
      id: "verification-1",
      identifier: "oauth-state-identifier",
      value: "oauth-state-value"
    });
  });

  it("finds protected rows by hash and reveals both protected fields", async () => {
    const { calls, wrapped } = createBaseAdapter();
    calls.findOne.mockImplementation(async ({ where }) => hasCondition(
      where,
      "identifierHash",
      hasher.hash("oauth-state-identifier")
    ) ? {
      id: "verification-1",
      ...encryptVerification("oauth-state-identifier", "oauth-state-value")
    } : null);

    const found = await wrapped.findOne<Record<string, unknown>>({
      model: "verification",
      where: [{ field: "identifier", value: "oauth-state-identifier" }]
    });

    expect(calls.findOne).toHaveBeenCalledTimes(1);
    expect(found).toEqual({
      id: "verification-1",
      identifier: "oauth-state-identifier",
      value: "oauth-state-value"
    });
  });

  it("falls back to plaintext legacy rows only when identifier_hash is null", async () => {
    const { calls, wrapped } = createBaseAdapter();
    calls.findOne.mockImplementation(async ({ where }) => hasCondition(where, "identifierHash", null)
      ? {
        id: "legacy-verification",
        identifier: "legacy-identifier",
        identifierHash: null,
        value: "legacy-value"
      }
      : null);

    const found = await wrapped.findOne<Record<string, unknown>>({
      model: "verification",
      where: [{ field: "identifier", value: "legacy-identifier" }]
    });

    expect(calls.findOne).toHaveBeenCalledTimes(2);
    expect(calls.findOne.mock.calls[1]?.[0]?.where).toContainEqual({
      field: "identifierHash",
      value: null,
      operator: "eq",
      connector: "AND"
    });
    expect(found).toEqual({
      id: "legacy-verification",
      identifier: "legacy-identifier",
      value: "legacy-value"
    });
  });

  it("protects updates and routes consume/delete operations across both storage shapes", async () => {
    const { calls, wrapped } = createBaseAdapter();
    calls.update.mockImplementation(async ({ where, update }) => hasCondition(
      where,
      "identifierHash",
      hasher.hash("oauth-state-identifier")
    ) ? {
      id: "verification-1",
      ...encryptVerification("oauth-state-identifier", "old-value"),
      ...update
    } : null);
    calls.consumeOne.mockImplementation(async ({ where }) => hasCondition(
      where,
      "identifierHash",
      hasher.hash("oauth-state-identifier")
    ) ? {
      id: "verification-1",
      ...encryptVerification("oauth-state-identifier", "new-value")
    } : null);

    const updated = await wrapped.update<Record<string, unknown>>({
      model: "verification",
      where: [{ field: "identifier", value: "oauth-state-identifier" }],
      update: { value: "new-value" }
    });
    const consumed = await wrapped.consumeOne<Record<string, unknown>>({
      model: "verification",
      where: [{ field: "identifier", value: "oauth-state-identifier" }]
    });
    await wrapped.delete({
      model: "verification",
      where: [{ field: "identifier", value: "oauth-state-identifier" }]
    });

    const writtenUpdate = calls.update.mock.calls[0]?.[0]?.update as Record<string, unknown>;
    expect(isKnownAuthDataEnvelope(String(writtenUpdate.value))).toBe(true);
    expect(updated).toMatchObject({ value: "new-value" });
    expect(consumed).toMatchObject({
      identifier: "oauth-state-identifier",
      value: "new-value"
    });
    expect(calls.delete).toHaveBeenCalledTimes(2);
  });
});
