import type { BetterAuthOptions } from "better-auth";
import type { DBAdapter, DBTransactionAdapter } from "better-auth/types";
import { describe, expect, it, vi } from "vitest";

import { createAuthDataCipherFromBase64Key, isKnownAuthDataEnvelope } from "../../src/auth/auth-sensitive-field-crypto.service.js";
import { withEncryptedAuthAccountTokens } from "../../src/auth/better-auth-sensitive-field-adapter.service.js";

const keyV1 = Buffer.from("b".repeat(32), "utf8").toString("base64");
const cipher = createAuthDataCipherFromBase64Key(keyV1);

const createBaseAdapter = () => {
  const calls = {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findOne: vi.fn(),
    findMany: vi.fn(),
    consumeOne: vi.fn()
  };

  const transactionAdapter: DBTransactionAdapter<BetterAuthOptions> = {
    id: "fake-transaction",
    create: calls.create.mockImplementation(async ({ data }) => ({ id: "row-1", ...data })),
    findOne: calls.findOne.mockImplementation(async ({ model }) => model === "account"
      ? {
        id: "account-1",
        accessToken: cipher.encrypt({
          model: "account",
          field: "accessToken",
          plaintext: "read-access-token"
        }),
        scope: "read:user"
      }
      : {
        id: "session-1",
        token: "maiks-auth-data:v2:session-token"
      }),
    findMany: calls.findMany.mockImplementation(async ({ model }) => model === "account"
      ? [{
        id: "account-1",
        refreshToken: cipher.encrypt({
          model: "account",
          field: "refreshToken",
          plaintext: "read-refresh-token"
        })
      }]
      : [{
        id: "user-1",
        accessToken: "ordinary-user-field"
      }]),
    count: async () => 0,
    update: calls.update.mockImplementation(async ({ update }) => ({ id: "account-1", ...update })),
    updateMany: calls.updateMany.mockResolvedValue(3),
    delete: async () => undefined,
    deleteMany: async () => 0,
    consumeOne: calls.consumeOne.mockResolvedValue(null)
  };

  const adapter: DBAdapter<BetterAuthOptions> = {
    ...transactionAdapter,
    id: "fake-adapter",
    transaction: async (callback) => callback(transactionAdapter)
  };

  return { adapter, calls };
};

describe("encrypted Better Auth account token adapter", () => {
  it("encrypts account token fields on create and decrypts the returned account", async () => {
    const { adapter, calls } = createBaseAdapter();
    const wrapped = withEncryptedAuthAccountTokens(() => adapter, cipher)({} as BetterAuthOptions);

    const created = await wrapped.create<Record<string, unknown>>({
      model: "account",
      data: {
        accessToken: "write-access-token",
        refreshToken: null,
        idToken: "write-id-token",
        scope: "read:user",
        password: "credential-password"
      }
    });
    const written = calls.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;

    expect(isKnownAuthDataEnvelope(String(written.accessToken))).toBe(true);
    expect(written.accessToken).not.toBe("write-access-token");
    expect(written.refreshToken).toBeNull();
    expect(isKnownAuthDataEnvelope(String(written.idToken))).toBe(true);
    expect(written.scope).toBe("read:user");
    expect(written.password).toBe("credential-password");
    expect(created.accessToken).toBe("write-access-token");
    expect(created.idToken).toBe("write-id-token");
  });

  it("encrypts account updates and updateMany without changing where clauses", async () => {
    const { adapter, calls } = createBaseAdapter();
    const wrapped = withEncryptedAuthAccountTokens(() => adapter, cipher)({} as BetterAuthOptions);
    const where = [{ field: "id", value: "account-1" }];

    const updated = await wrapped.update<Record<string, unknown>>({
      model: "account",
      where,
      update: {
        accessToken: "updated-access-token",
        accountId: "provider-subject",
        providerId: "github"
      }
    });
    await wrapped.updateMany({
      model: "account",
      where,
      update: {
        refreshToken: "updated-refresh-token",
        scope: "read:user"
      }
    });

    expect(calls.update.mock.calls[0]?.[0]?.where).toBe(where);
    expect(isKnownAuthDataEnvelope(String(calls.update.mock.calls[0]?.[0]?.update.accessToken))).toBe(true);
    expect(calls.update.mock.calls[0]?.[0]?.update.accountId).toBe("provider-subject");
    expect(calls.update.mock.calls[0]?.[0]?.update.providerId).toBe("github");
    expect(updated?.accessToken).toBe("updated-access-token");
    expect(calls.updateMany.mock.calls[0]?.[0]?.where).toBe(where);
    expect(isKnownAuthDataEnvelope(String(calls.updateMany.mock.calls[0]?.[0]?.update.refreshToken))).toBe(true);
    expect(calls.updateMany.mock.calls[0]?.[0]?.update.scope).toBe("read:user");
  });

  it("decrypts account reads while leaving other models unchanged", async () => {
    const { adapter } = createBaseAdapter();
    const wrapped = withEncryptedAuthAccountTokens(() => adapter, cipher)({} as BetterAuthOptions);

    await expect(wrapped.findOne<Record<string, unknown>>({
      model: "account",
      where: [{ field: "id", value: "account-1" }]
    })).resolves.toMatchObject({
      accessToken: "read-access-token",
      scope: "read:user"
    });
    await expect(wrapped.findMany<Record<string, unknown>>({
      model: "account",
      where: [{ field: "userId", value: "user-1" }]
    })).resolves.toEqual([{
      id: "account-1",
      refreshToken: "read-refresh-token"
    }]);
    await expect(wrapped.findMany<Record<string, unknown>>({
      model: "user",
      where: [{ field: "id", value: "user-1" }]
    })).resolves.toEqual([{
      id: "user-1",
      accessToken: "ordinary-user-field"
    }]);
  });

  it("wraps transaction adapters so account token writes remain protected", async () => {
    const { adapter, calls } = createBaseAdapter();
    const wrapped = withEncryptedAuthAccountTokens(() => adapter, cipher)({} as BetterAuthOptions);

    await wrapped.transaction(async (trx) => {
      await trx.create<Record<string, unknown>>({
        model: "account",
        data: {
          accessToken: "transaction-access-token"
        }
      });
    });

    expect(isKnownAuthDataEnvelope(String(calls.create.mock.calls[0]?.[0]?.data.accessToken))).toBe(true);
    expect(calls.create.mock.calls[0]?.[0]?.data.accessToken).not.toBe("transaction-access-token");
  });

  it("keeps session adapter behavior unchanged", async () => {
    const { adapter, calls } = createBaseAdapter();
    const wrapped = withEncryptedAuthAccountTokens(() => adapter, cipher)({} as BetterAuthOptions);

    const created = await wrapped.create<Record<string, unknown>>({
      model: "session",
      data: {
        token: "maiks-auth-data:v2:session-token",
        userId: "user-1"
      }
    });
    const found = await wrapped.findOne<Record<string, unknown>>({
      model: "session",
      where: [{ field: "token", value: "maiks-auth-data:v2:session-token" }]
    });

    expect(calls.create.mock.calls[0]?.[0]?.data.token).toBe("maiks-auth-data:v2:session-token");
    expect(created.token).toBe("maiks-auth-data:v2:session-token");
    expect(found?.token).toBe("maiks-auth-data:v2:session-token");
  });
});
