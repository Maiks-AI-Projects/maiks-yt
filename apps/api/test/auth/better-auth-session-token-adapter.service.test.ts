import type { BetterAuthOptions } from "better-auth";
import type { DBAdapter, DBTransactionAdapter, Where } from "better-auth/types";
import { describe, expect, it, vi } from "vitest";

import {
  createAuthDataCipher,
  isKnownAuthDataEnvelope
} from "../../src/auth/auth-sensitive-field-crypto.service.js";
import { createAuthSessionTokenHasher } from "../../src/auth/auth-session-token-hash.service.js";
import { withProtectedAuthSensitiveFields } from "../../src/auth/better-auth-sensitive-field-adapter.service.js";

const hasher = createAuthSessionTokenHasher(Buffer.from("d".repeat(32), "utf8"));
const cipher = createAuthDataCipher(Buffer.from("e".repeat(32), "utf8"));
const encryptSessionToken = (token: string): string => cipher.encrypt({
  model: "session",
  field: "token",
  plaintext: token
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
    id: "fake-transaction",
    create: calls.create.mockImplementation(async ({ data }) => ({ id: "session-1", ...data })),
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
    id: "fake-adapter",
    transaction: async (callback) => callback(transactionAdapter)
  };
  const wrapped = withProtectedAuthSensitiveFields(() => adapter, {
    cipher,
    sessionTokenHasher: hasher
  })({} as BetterAuthOptions);

  return { adapter, calls, wrapped };
};

describe("Better Auth session token hash adapter", () => {
  it("writes ciphertext plus a deterministic hash and returns only the original token", async () => {
    const { calls, wrapped } = createBaseAdapter();
    const created = await wrapped.create<Record<string, unknown>>({
      model: "session",
      data: {
        token: "new-session-token",
        tokenHash: "untrusted-input",
        userId: "user-1"
      }
    });
    const written = calls.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;

    expect(isKnownAuthDataEnvelope(String(written.token))).toBe(true);
    expect(written.token).not.toBe("new-session-token");
    expect(written.tokenHash).toBe(hasher.hash("new-session-token"));
    expect(created).toMatchObject({ token: "new-session-token", userId: "user-1" });
    expect(created).not.toHaveProperty("tokenHash");
  });

  it("looks up a session by hash first", async () => {
    const { calls, wrapped } = createBaseAdapter();
    calls.findOne.mockImplementation(async ({ where }) => hasCondition(
      where,
      "tokenHash",
      hasher.hash("existing-session-token")
    )
      ? {
        id: "session-1",
        token: encryptSessionToken("existing-session-token"),
        tokenHash: hasher.hash("existing-session-token")
      }
      : null);

    const found = await wrapped.findOne<Record<string, unknown>>({
      model: "session",
      where: [{ field: "token", value: "existing-session-token" }]
    });

    expect(calls.findOne).toHaveBeenCalledTimes(1);
    expect(calls.findOne.mock.calls[0]?.[0]?.where).toEqual([{
      field: "tokenHash",
      value: hasher.hash("existing-session-token")
    }]);
    expect(found).toEqual({ id: "session-1", token: "existing-session-token" });
  });

  it("falls back only to legacy rows whose hash is null", async () => {
    const { calls, wrapped } = createBaseAdapter();
    calls.findOne.mockImplementation(async ({ where }) => hasCondition(where, "tokenHash", null)
      ? { id: "legacy-session", token: "legacy-token", tokenHash: null }
      : null);

    const found = await wrapped.findOne<Record<string, unknown>>({
      model: "session",
      where: [{ field: "token", value: "legacy-token" }]
    });

    expect(calls.findOne).toHaveBeenCalledTimes(2);
    expect(calls.findOne.mock.calls[1]?.[0]?.where).toContainEqual({
      field: "tokenHash",
      value: null,
      operator: "eq",
      connector: "AND"
    });
    expect(found).toEqual({ id: "legacy-session", token: "legacy-token" });
  });

  it("combines hashed and legacy in-list reads without duplicates or hash leakage", async () => {
    const { calls, wrapped } = createBaseAdapter();
    calls.findMany.mockImplementation(async ({ where }) => hasCondition(where, "tokenHash", null)
      ? [{ id: "legacy-session", token: "legacy-token", tokenHash: null, order: 2 }]
      : [{
        id: "hashed-session",
        token: encryptSessionToken("hashed-token"),
        tokenHash: hasher.hash("hashed-token"),
        order: 1
      }]);

    const found = await wrapped.findMany<Record<string, unknown>>({
      model: "session",
      where: [{ field: "token", value: ["hashed-token", "legacy-token"], operator: "in" }],
      sortBy: { field: "order", direction: "asc" },
      limit: 2
    });

    expect(calls.findMany).toHaveBeenCalledTimes(2);
    expect(found).toEqual([
      { id: "hashed-session", token: "hashed-token", order: 1 },
      { id: "legacy-session", token: "legacy-token", order: 2 }
    ]);
  });

  it("routes updates and deletes across hashed and legacy rows", async () => {
    const { calls, wrapped } = createBaseAdapter();
    calls.update.mockImplementation(async ({ where, update }) => hasCondition(
      where,
      "tokenHash",
      hasher.hash("hashed-token")
    ) ? {
      id: "session-1",
      token: encryptSessionToken("hashed-token"),
      tokenHash: hasher.hash("hashed-token"),
      ...update
    } : null);
    calls.updateMany
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    calls.deleteMany
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    const updated = await wrapped.update<Record<string, unknown>>({
      model: "session",
      where: [{ field: "token", value: "hashed-token" }],
      update: { userAgent: "updated-agent" }
    });
    const updatedCount = await wrapped.updateMany({
      model: "session",
      where: [{ field: "token", value: ["hashed-token", "legacy-token"], operator: "in" }],
      update: { userAgent: "bulk-agent" }
    });
    const deletedCount = await wrapped.deleteMany({
      model: "session",
      where: [{ field: "token", value: ["hashed-token", "legacy-token"], operator: "in" }]
    });
    await wrapped.delete({
      model: "session",
      where: [{ field: "token", value: "hashed-token" }]
    });

    expect(updated).toEqual({ id: "session-1", token: "hashed-token", userAgent: "updated-agent" });
    expect(updatedCount).toBe(2);
    expect(deletedCount).toBe(2);
    expect(calls.delete).toHaveBeenCalledTimes(2);
    expect(calls.delete.mock.calls[1]?.[0]?.where).toContainEqual(expect.objectContaining({
      field: "tokenHash",
      value: null
    }));
  });

  it("leaves unsupported session predicates unchanged", async () => {
    const { calls, wrapped } = createBaseAdapter();
    const where: Where[] = [{ field: "token", value: "partial", operator: "contains" }];

    await wrapped.findOne({ model: "session", where });

    expect(calls.findOne).toHaveBeenCalledTimes(1);
    expect(calls.findOne.mock.calls[0]?.[0]?.where).toBe(where);
  });

  it("decrypts token values when Better Auth lists sessions by user", async () => {
    const { calls, wrapped } = createBaseAdapter();
    calls.findMany.mockResolvedValue([{
      id: "session-1",
      userId: "user-1",
      token: encryptSessionToken("listed-session-token"),
      tokenHash: hasher.hash("listed-session-token")
    }]);

    const sessions = await wrapped.findMany<Record<string, unknown>>({
      model: "session",
      where: [{ field: "userId", value: "user-1" }]
    });

    expect(calls.findMany).toHaveBeenCalledTimes(1);
    expect(sessions).toEqual([{
      id: "session-1",
      userId: "user-1",
      token: "listed-session-token"
    }]);
  });
});
