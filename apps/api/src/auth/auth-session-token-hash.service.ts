import { createHmac } from "node:crypto";

const keyBytes = 32;
const hashDomain = "maiks-yt:better-auth:session-token:v1\0";

export type AuthSessionTokenHasher = {
  hash: (token: string) => string;
};

export class AuthSessionTokenHashConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthSessionTokenHashConfigurationError";
  }
}

const strictBase64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

const decodeStrictBase64Key = (value: string): Buffer => {
  const normalized = value.trim();

  if (
    normalized.length === 0
    || normalized.length % 4 !== 0
    || !strictBase64Pattern.test(normalized)
  ) {
    throw new AuthSessionTokenHashConfigurationError(
      "AUTH_SESSION_TOKEN_HASH_KEY_V1 must be strict base64."
    );
  }

  const decoded = Buffer.from(normalized, "base64");

  if (decoded.length !== keyBytes || decoded.toString("base64") !== normalized) {
    throw new AuthSessionTokenHashConfigurationError(
      "AUTH_SESSION_TOKEN_HASH_KEY_V1 must decode to exactly 32 bytes."
    );
  }

  return decoded;
};

export const createAuthSessionTokenHasher = (key: Buffer): AuthSessionTokenHasher => {
  if (key.length !== keyBytes) {
    throw new AuthSessionTokenHashConfigurationError(
      "Auth session token hash key must be 32 bytes."
    );
  }

  return {
    hash: (token) => createHmac("sha256", key)
      .update(hashDomain, "utf8")
      .update(token, "utf8")
      .digest("hex")
  };
};

export const createAuthSessionTokenHasherFromBase64Key = (
  value: string
): AuthSessionTokenHasher => createAuthSessionTokenHasher(decodeStrictBase64Key(value));

export const createAuthSessionTokenHasherFromEnvironment = (
  environment: NodeJS.ProcessEnv = process.env
): AuthSessionTokenHasher | null => {
  const rawKey = environment.AUTH_SESSION_TOKEN_HASH_KEY_V1;

  if (!rawKey) {
    if (environment.NODE_ENV === "production") {
      throw new AuthSessionTokenHashConfigurationError(
        "AUTH_SESSION_TOKEN_HASH_KEY_V1 is required in production."
      );
    }

    return null;
  }

  return createAuthSessionTokenHasherFromBase64Key(rawKey);
};
