import { createHmac } from "node:crypto";

const keyBytes = 32;
const hashDomain = "maiks-yt:better-auth:verification-identifier:v1\0";

export type AuthVerificationIdentifierHasher = {
  hash: (identifier: string) => string;
};

export class AuthVerificationIdentifierHashConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthVerificationIdentifierHashConfigurationError";
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
    throw new AuthVerificationIdentifierHashConfigurationError(
      "AUTH_VERIFICATION_IDENTIFIER_HASH_KEY_V1 must be strict base64."
    );
  }

  const decoded = Buffer.from(normalized, "base64");

  if (decoded.length !== keyBytes || decoded.toString("base64") !== normalized) {
    throw new AuthVerificationIdentifierHashConfigurationError(
      "AUTH_VERIFICATION_IDENTIFIER_HASH_KEY_V1 must decode to exactly 32 bytes."
    );
  }

  return decoded;
};

export const createAuthVerificationIdentifierHasher = (
  key: Buffer
): AuthVerificationIdentifierHasher => {
  if (key.length !== keyBytes) {
    throw new AuthVerificationIdentifierHashConfigurationError(
      "Auth verification identifier hash key must be 32 bytes."
    );
  }

  return {
    hash: (identifier) => createHmac("sha256", key)
      .update(hashDomain, "utf8")
      .update(identifier, "utf8")
      .digest("hex")
  };
};

export const createAuthVerificationIdentifierHasherFromBase64Key = (
  value: string
): AuthVerificationIdentifierHasher =>
  createAuthVerificationIdentifierHasher(decodeStrictBase64Key(value));

export const createAuthVerificationIdentifierHasherFromEnvironment = (
  environment: NodeJS.ProcessEnv = process.env
): AuthVerificationIdentifierHasher | null => {
  const rawKey = environment.AUTH_VERIFICATION_IDENTIFIER_HASH_KEY_V1;

  if (!rawKey) {
    if (environment.NODE_ENV === "production") {
      throw new AuthVerificationIdentifierHashConfigurationError(
        "AUTH_VERIFICATION_IDENTIFIER_HASH_KEY_V1 is required in production."
      );
    }

    return null;
  }

  return createAuthVerificationIdentifierHasherFromBase64Key(rawKey);
};
