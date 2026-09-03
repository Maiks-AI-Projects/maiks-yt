import type { DatabasePool } from "@maiks-yt/database";
import {
  resolveTwitchChatCredential,
  type TwitchChatCredential
} from "@maiks-yt/integrations";

import {
  createProviderRuntimeCredentialCipherFromEnvironment,
  protectProviderRuntimeCredentialTokens,
  revealProviderRuntimeCredentialTokens
} from "./provider-runtime-credential-token-crypto.service.js";

const metadataKey = "provider-runtime:twitch-chat:credential:v1";

type PersistedTwitchChatCredential = {
  accessToken: string;
  accessTokenExpiresAt: number | null;
  clientId: string;
  refreshToken: string;
  version: 1;
};

const parsePersistedCredential = (value: unknown): PersistedTwitchChatCredential => {
  if (typeof value !== "string" || value.length === 0 || value.length > 1_024) {
    throw new Error("Stored Twitch chat credential has an invalid envelope.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Stored Twitch chat credential has an invalid envelope.");
  }

  if (
    !parsed
    || typeof parsed !== "object"
    || Array.isArray(parsed)
    || (parsed as { version?: unknown }).version !== 1
    || typeof (parsed as { accessToken?: unknown }).accessToken !== "string"
    || typeof (parsed as { refreshToken?: unknown }).refreshToken !== "string"
    || typeof (parsed as { clientId?: unknown }).clientId !== "string"
    || (
      (parsed as { accessTokenExpiresAt?: unknown }).accessTokenExpiresAt !== null
      && typeof (parsed as { accessTokenExpiresAt?: unknown }).accessTokenExpiresAt !== "number"
    )
  ) {
    throw new Error("Stored Twitch chat credential has an invalid envelope.");
  }

  return parsed as PersistedTwitchChatCredential;
};

export type TwitchChatCredentialStore = {
  loadOrSeed: () => Promise<TwitchChatCredential | null>;
  save: (credential: TwitchChatCredential) => Promise<void>;
};

export const createTwitchChatCredentialStore = (
  pool: Pick<DatabasePool, "execute">,
  environment: NodeJS.ProcessEnv = process.env
): TwitchChatCredentialStore => {
  const environmentCredential = resolveTwitchChatCredential(environment);
  const cipher = createProviderRuntimeCredentialCipherFromEnvironment(environment);

  const save = async (credential: TwitchChatCredential): Promise<void> => {
    const protectedTokens = protectProviderRuntimeCredentialTokens({
      accessToken: credential.accessToken,
      refreshToken: credential.refreshToken
    }, cipher);
    if (!protectedTokens.accessToken || !protectedTokens.refreshToken) {
      throw new Error("Twitch chat credential protection failed.");
    }

    const value = JSON.stringify({
      accessToken: protectedTokens.accessToken,
      accessTokenExpiresAt: credential.accessTokenExpiresAt,
      clientId: credential.clientId,
      refreshToken: protectedTokens.refreshToken,
      version: 1
    } satisfies PersistedTwitchChatCredential);
    if (value.length > 1_024) {
      throw new Error("Protected Twitch chat credential exceeds storage capacity.");
    }

    await pool.execute(
      `INSERT INTO app_metadata (\`key\`, value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [metadataKey, value]
    );
  };

  const loadOrSeed = async (): Promise<TwitchChatCredential | null> => {
    const [rows] = await pool.execute(
      "SELECT value FROM app_metadata WHERE `key` = ? LIMIT 1",
      [metadataKey]
    );
    const row = Array.isArray(rows) ? rows[0] as { value?: unknown } | undefined : undefined;

    if (row?.value !== undefined) {
      const persisted = parsePersistedCredential(row.value);
      if (!environmentCredential || persisted.clientId !== environmentCredential.clientId) {
        throw new Error("Stored Twitch chat credential does not match the configured application.");
      }

      const revealed = revealProviderRuntimeCredentialTokens({
        accessToken: persisted.accessToken,
        refreshToken: persisted.refreshToken
      }, cipher);
      if (!revealed.accessToken || !revealed.refreshToken) {
        throw new Error("Stored Twitch chat credential is incomplete.");
      }

      return {
        accessToken: revealed.accessToken,
        accessTokenExpiresAt: persisted.accessTokenExpiresAt,
        clientId: environmentCredential.clientId,
        clientSecret: environmentCredential.clientSecret,
        refreshToken: revealed.refreshToken
      };
    }

    if (environmentCredential) {
      await save(environmentCredential);
    }
    return environmentCredential;
  };

  return { loadOrSeed, save };
};
