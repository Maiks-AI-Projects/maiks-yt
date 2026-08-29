import type { BetterAuthOptions } from "better-auth";
import type { DBAdapter, DBAdapterInstance, DBTransactionAdapter } from "better-auth/types";

import {
  decryptAuthAccountSensitiveFields,
  encryptAuthAccountSensitiveFields,
  type AuthDataCipher
} from "./auth-sensitive-field-crypto.service.js";

const accountModelName = "account";

const isAccountModel = (model: string): boolean => model === accountModelName;

const encryptWrite = <T extends Record<string, unknown>>(
  model: string,
  data: T,
  cipher: AuthDataCipher
): T => isAccountModel(model)
  ? encryptAuthAccountSensitiveFields(data, cipher, accountModelName)
  : data;

const decryptRead = <T>(
  model: string,
  data: T,
  cipher: AuthDataCipher
): T => {
  if (!isAccountModel(model) || !data || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }

  return decryptAuthAccountSensitiveFields(data as T & Record<string, unknown>, cipher, accountModelName);
};

const decryptMany = <T>(
  model: string,
  rows: T[],
  cipher: AuthDataCipher
): T[] => isAccountModel(model)
  ? rows.map((row) => decryptRead(model, row, cipher))
  : rows;

const wrapAdapter = <TAdapter extends DBTransactionAdapter<BetterAuthOptions> | DBAdapter<BetterAuthOptions>>(
  adapter: TAdapter,
  cipher: AuthDataCipher
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
        data: encryptWrite(input.model, input.data, cipher) as Omit<T, "id">
      });

      return decryptRead(input.model, result, cipher);
    },
    async findOne<T>(input: {
      model: string;
      where: Parameters<typeof adapter.findOne<T>>[0]["where"];
      select?: string[] | undefined;
      join?: Parameters<typeof adapter.findOne<T>>[0]["join"];
    }): Promise<T | null> {
      const result = await adapter.findOne<T>(input);
      return result ? decryptRead(input.model, result, cipher) : null;
    },
    async findMany<T>(input: Parameters<typeof adapter.findMany<T>>[0]): Promise<T[]> {
      const result = await adapter.findMany<T>(input);
      return decryptMany(input.model, result, cipher);
    },
    async update<T>(input: {
      model: string;
      where: Parameters<typeof adapter.update<T>>[0]["where"];
      update: Record<string, unknown>;
    }): Promise<T | null> {
      const result = await adapter.update<T>({
        ...input,
        update: encryptWrite(input.model, input.update, cipher)
      });

      return result ? decryptRead(input.model, result, cipher) : null;
    },
    async updateMany(input: Parameters<typeof adapter.updateMany>[0]): Promise<number> {
      return await adapter.updateMany({
        ...input,
        update: encryptWrite(input.model, input.update, cipher)
      });
    },
    async consumeOne<T>(input: Parameters<typeof adapter.consumeOne<T>>[0]): Promise<T | null> {
      const result = await adapter.consumeOne<T>(input);
      return result ? decryptRead(input.model, result, cipher) : null;
    }
  };

  if ("transaction" in adapter) {
    return {
      ...wrapped,
      async transaction<R>(callback: (trx: DBTransactionAdapter<BetterAuthOptions>) => Promise<R>): Promise<R> {
        return await adapter.transaction(async (trx) => callback(wrapAdapter(trx, cipher)));
      }
    } as TAdapter;
  }

  return wrapped as TAdapter;
};

export const withEncryptedAuthAccountTokens = (
  adapterFactory: DBAdapterInstance<BetterAuthOptions>,
  cipher: AuthDataCipher
): DBAdapterInstance<BetterAuthOptions> => (options) =>
  wrapAdapter(adapterFactory(options), cipher);
