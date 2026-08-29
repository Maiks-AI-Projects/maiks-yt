import type { BetterAuthOptions } from "better-auth";
import type { DBAdapter, DBAdapterInstance, DBTransactionAdapter } from "better-auth/types";

import {
  decryptAuthAccountSensitiveFields,
  encryptAuthAccountSensitiveFields,
  type AuthDataCipher
} from "./auth-sensitive-field-crypto.service.js";
import type { AuthSessionTokenHasher } from "./auth-session-token-hash.service.js";
import {
  applyFindManyWindow,
  createSessionTokenWherePlans,
  mergeSessionRows,
  protectSessionWrite,
  revealSessionToken
} from "./better-auth-session-token-adapter.rules.js";

const accountModelName = "account";

const isAccountModel = (model: string): boolean => model === accountModelName;

const encryptWrite = <T extends Record<string, unknown>>(
  model: string,
  data: T,
  cipher: AuthDataCipher | null,
  sessionTokenHasher: AuthSessionTokenHasher | null
): T => protectSessionWrite(
  model,
  isAccountModel(model)
    ? encryptAuthAccountSensitiveFields(data, cipher, accountModelName)
    : data,
  cipher,
  sessionTokenHasher
);

const decryptRead = <T>(
  model: string,
  data: T,
  cipher: AuthDataCipher | null,
  sessionTokenHasher: AuthSessionTokenHasher | null
): T => {
  const decrypted = isAccountModel(model) && data && typeof data === "object" && !Array.isArray(data)
    ? decryptAuthAccountSensitiveFields(data as T & Record<string, unknown>, cipher, accountModelName)
    : data;

  return revealSessionToken(model, decrypted, sessionTokenHasher ? cipher : null);
};

const queryFindMany = async <T>(
  adapter: DBTransactionAdapter<BetterAuthOptions> | DBAdapter<BetterAuthOptions>,
  input: Parameters<typeof adapter.findMany<T>>[0],
  sessionTokenHasher: AuthSessionTokenHasher | null
): Promise<T[]> => {
  const plans = createSessionTokenWherePlans(input.model, input.where, sessionTokenHasher);

  if (!plans) {
    return await adapter.findMany<T>(input);
  }

  const query = {
    ...input,
    limit: undefined,
    offset: undefined
  };
  const [hashedRows, legacyRows] = await Promise.all([
    adapter.findMany<T>({ ...query, where: plans.hashed }),
    adapter.findMany<T>({ ...query, where: plans.legacy })
  ]);

  return applyFindManyWindow(mergeSessionRows(hashedRows, legacyRows), input);
};

const decryptMany = <T>(
  model: string,
  rows: T[],
  cipher: AuthDataCipher | null,
  sessionTokenHasher: AuthSessionTokenHasher | null
): T[] => isAccountModel(model)
  ? rows.map((row) => decryptRead(model, row, cipher, sessionTokenHasher))
  : rows.map((row) => revealSessionToken(model, row, sessionTokenHasher ? cipher : null));

const wrapAdapter = <TAdapter extends DBTransactionAdapter<BetterAuthOptions> | DBAdapter<BetterAuthOptions>>(
  adapter: TAdapter,
  cipher: AuthDataCipher | null,
  sessionTokenHasher: AuthSessionTokenHasher | null
): TAdapter => {
  const wrapped = {
    ...adapter,
    async create<T extends Record<string, unknown>, R = T>(input: {
      model: string;
      data: Omit<T, "id">;
      select?: string[] | undefined;
      forceAllowId?: boolean | undefined;
    }): Promise<R> {
      const result = await adapter.create<T, R>({
        ...input,
        data: encryptWrite(input.model, input.data, cipher, sessionTokenHasher) as Omit<T, "id">
      });

      return decryptRead(input.model, result, cipher, sessionTokenHasher);
    },
    async findOne<T>(input: {
      model: string;
      where: Parameters<typeof adapter.findOne<T>>[0]["where"];
      select?: string[] | undefined;
      join?: Parameters<typeof adapter.findOne<T>>[0]["join"];
    }): Promise<T | null> {
      const plans = createSessionTokenWherePlans(input.model, input.where, sessionTokenHasher);
      const result = plans
        ? await adapter.findOne<T>({ ...input, where: plans.hashed })
          ?? await adapter.findOne<T>({ ...input, where: plans.legacy })
        : await adapter.findOne<T>(input);
      return result ? decryptRead(input.model, result, cipher, sessionTokenHasher) : null;
    },
    async findMany<T>(input: Parameters<typeof adapter.findMany<T>>[0]): Promise<T[]> {
      const result = await queryFindMany<T>(adapter, input, sessionTokenHasher);
      return decryptMany(input.model, result, cipher, sessionTokenHasher);
    },
    async count(input: Parameters<typeof adapter.count>[0]): Promise<number> {
      const plans = createSessionTokenWherePlans(input.model, input.where, sessionTokenHasher);

      if (!plans) {
        return await adapter.count(input);
      }

      const [hashedCount, legacyCount] = await Promise.all([
        adapter.count({ ...input, where: plans.hashed }),
        adapter.count({ ...input, where: plans.legacy })
      ]);

      return Number(hashedCount) + Number(legacyCount);
    },
    async update<T>(input: {
      model: string;
      where: Parameters<typeof adapter.update<T>>[0]["where"];
      update: Record<string, unknown>;
    }): Promise<T | null> {
      const plans = createSessionTokenWherePlans(input.model, input.where, sessionTokenHasher);
      const update = encryptWrite(input.model, input.update, cipher, sessionTokenHasher);
      const result = plans
        ? await adapter.update<T>({ ...input, where: plans.hashed, update })
          ?? await adapter.update<T>({ ...input, where: plans.legacy, update })
        : await adapter.update<T>({ ...input, update });

      return result ? decryptRead(input.model, result, cipher, sessionTokenHasher) : null;
    },
    async updateMany(input: Parameters<typeof adapter.updateMany>[0]): Promise<number> {
      const plans = createSessionTokenWherePlans(input.model, input.where, sessionTokenHasher);
      const update = encryptWrite(input.model, input.update, cipher, sessionTokenHasher);

      if (!plans) {
        return await adapter.updateMany({ ...input, update });
      }

      const hashedCount = await adapter.updateMany({ ...input, where: plans.hashed, update });
      const legacyCount = await adapter.updateMany({ ...input, where: plans.legacy, update });
      return Number(hashedCount) + Number(legacyCount);
    },
    async delete<T>(input: Parameters<typeof adapter.delete<T>>[0]): Promise<void> {
      const plans = createSessionTokenWherePlans(input.model, input.where, sessionTokenHasher);

      if (!plans) {
        await adapter.delete(input);
        return;
      }

      await adapter.delete({ ...input, where: plans.hashed });
      await adapter.delete({ ...input, where: plans.legacy });
    },
    async deleteMany(input: Parameters<typeof adapter.deleteMany>[0]): Promise<number> {
      const plans = createSessionTokenWherePlans(input.model, input.where, sessionTokenHasher);

      if (!plans) {
        return await adapter.deleteMany(input);
      }

      const hashedCount = await adapter.deleteMany({ ...input, where: plans.hashed });
      const legacyCount = await adapter.deleteMany({ ...input, where: plans.legacy });
      return Number(hashedCount) + Number(legacyCount);
    },
    async consumeOne<T>(input: Parameters<typeof adapter.consumeOne<T>>[0]): Promise<T | null> {
      const plans = createSessionTokenWherePlans(input.model, input.where, sessionTokenHasher);
      const result = plans
        ? await adapter.consumeOne<T>({ ...input, where: plans.hashed })
          ?? await adapter.consumeOne<T>({ ...input, where: plans.legacy })
        : await adapter.consumeOne<T>(input);
      return result ? decryptRead(input.model, result, cipher, sessionTokenHasher) : null;
    }
  };

  if ("transaction" in adapter) {
    return {
      ...wrapped,
      async transaction<R>(callback: (trx: DBTransactionAdapter<BetterAuthOptions>) => Promise<R>): Promise<R> {
        return await adapter.transaction(async (trx) => callback(wrapAdapter(trx, cipher, sessionTokenHasher)));
      }
    } as TAdapter;
  }

  return wrapped as TAdapter;
};

export const withEncryptedAuthAccountTokens = (
  adapterFactory: DBAdapterInstance<BetterAuthOptions>,
  cipher: AuthDataCipher
): DBAdapterInstance<BetterAuthOptions> => (options) =>
  wrapAdapter(adapterFactory(options), cipher, null);

export const withProtectedAuthSensitiveFields = (
  adapterFactory: DBAdapterInstance<BetterAuthOptions>,
  protection: {
    cipher: AuthDataCipher | null;
    sessionTokenHasher: AuthSessionTokenHasher | null;
  }
): DBAdapterInstance<BetterAuthOptions> => (options) =>
  wrapAdapter(adapterFactory(options), protection.cipher, protection.sessionTokenHasher);
