import { createCipheriv, createDecipheriv, randomBytes, type CipherGCMTypes } from "node:crypto";

const envelopeFamilyPrefix = "maiks-auth-data:";
const envelopeV1Prefix = `${envelopeFamilyPrefix}v1:`;
const algorithm: CipherGCMTypes = "aes-256-gcm";
const keyBytes = 32;
const nonceBytes = 12;
const tagBytes = 16;

export type AuthSensitiveFieldName = "accessToken" | "refreshToken" | "idToken" | "token";

export type AuthDataCipher = {
  encrypt: (input: {
    model: string;
    field: AuthSensitiveFieldName;
    plaintext: string;
  }) => string;
  decrypt: (input: {
    model: string;
    field: AuthSensitiveFieldName;
    storedValue: string;
  }) => string;
};

export class AuthDataEncryptionConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthDataEncryptionConfigurationError";
  }
}

export class AuthDataEnvelopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthDataEnvelopeError";
  }
}

const strictBase64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const strictBase64UrlPattern = /^[A-Za-z0-9_-]+$/u;

const isStrictBase64 = (value: string): boolean =>
  value.length > 0
  && value.length % 4 === 0
  && strictBase64Pattern.test(value);

const decodeStrictBase64Key = (value: string): Buffer => {
  const normalized = value.trim();

  if (!isStrictBase64(normalized)) {
    throw new AuthDataEncryptionConfigurationError(
      "AUTH_DATA_ENCRYPTION_KEY_V1 must be strict base64."
    );
  }

  const decoded = Buffer.from(normalized, "base64");

  if (decoded.length !== keyBytes || decoded.toString("base64") !== normalized) {
    throw new AuthDataEncryptionConfigurationError(
      "AUTH_DATA_ENCRYPTION_KEY_V1 must decode to exactly 32 bytes."
    );
  }

  return decoded;
};

const decodeStrictBase64Url = (value: string, label: string): Buffer => {
  if (!strictBase64UrlPattern.test(value)) {
    throw new AuthDataEnvelopeError(`Invalid auth data envelope ${label}.`);
  }

  const decoded = Buffer.from(value, "base64url");

  if (decoded.length === 0 || decoded.toString("base64url") !== value) {
    throw new AuthDataEnvelopeError(`Invalid auth data envelope ${label}.`);
  }

  return decoded;
};

const aadFor = (model: string, field: AuthSensitiveFieldName): Buffer =>
  Buffer.from(`maiks-yt:auth-data:v1:${model}:${field}`, "utf8");

export const isAuthDataEnvelope = (value: string): boolean =>
  value.startsWith(envelopeFamilyPrefix);

export const isKnownAuthDataEnvelope = (value: string): boolean =>
  value.startsWith(envelopeV1Prefix);

export const createAuthDataCipher = (key: Buffer): AuthDataCipher => {
  if (key.length !== keyBytes) {
    throw new AuthDataEncryptionConfigurationError("Auth data encryption key must be 32 bytes.");
  }

  const encrypt: AuthDataCipher["encrypt"] = ({ model, field, plaintext }) => {
    if (isKnownAuthDataEnvelope(plaintext)) {
      parseEnvelopeV1(plaintext);
      return plaintext;
    }

    if (isAuthDataEnvelope(plaintext)) {
      throw new AuthDataEnvelopeError("Unknown auth data envelope version.");
    }

    const nonce = randomBytes(nonceBytes);
    const cipher = createCipheriv(algorithm, key, nonce);
    cipher.setAAD(aadFor(model, field));
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();

    return `${envelopeV1Prefix}${nonce.toString("base64url")}.${ciphertext.toString("base64url")}.${tag.toString("base64url")}`;
  };

  const decrypt: AuthDataCipher["decrypt"] = ({ model, field, storedValue }) => {
    if (!isAuthDataEnvelope(storedValue)) {
      return storedValue;
    }

    const { nonce, ciphertext, tag } = parseEnvelopeV1(storedValue);
    const decipher = createDecipheriv(algorithm, key, nonce);
    decipher.setAAD(aadFor(model, field));
    decipher.setAuthTag(tag);

    try {
      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]).toString("utf8");
    } catch {
      throw new AuthDataEnvelopeError("Auth data envelope could not be decrypted.");
    }
  };

  return { encrypt, decrypt };
};

export const createAuthDataCipherFromBase64Key = (value: string): AuthDataCipher =>
  createAuthDataCipher(decodeStrictBase64Key(value));

export const createAuthDataCipherFromEnvironment = (
  environment: NodeJS.ProcessEnv = process.env
): AuthDataCipher | null => {
  const rawKey = environment.AUTH_DATA_ENCRYPTION_KEY_V1;

  if (!rawKey) {
    if (environment.NODE_ENV === "production") {
      throw new AuthDataEncryptionConfigurationError(
        "AUTH_DATA_ENCRYPTION_KEY_V1 is required in production."
      );
    }

    return null;
  }

  return createAuthDataCipherFromBase64Key(rawKey);
};

type AuthAccountSensitiveFields = Partial<Record<AuthSensitiveFieldName, unknown>>;

const sensitiveAccountTokenFields: AuthSensitiveFieldName[] = [
  "accessToken",
  "refreshToken",
  "idToken"
];

const parseEnvelopeV1 = (value: string): {
  nonce: Buffer;
  ciphertext: Buffer;
  tag: Buffer;
} => {
  if (!value.startsWith(envelopeV1Prefix)) {
    throw new AuthDataEnvelopeError("Unknown auth data envelope version.");
  }

  const parts = value.slice(envelopeV1Prefix.length).split(".");

  if (parts.length !== 3) {
    throw new AuthDataEnvelopeError("Malformed auth data envelope.");
  }

  const [noncePart, ciphertextPart, tagPart] = parts;

  if (!noncePart || ciphertextPart === undefined || !tagPart) {
    throw new AuthDataEnvelopeError("Malformed auth data envelope.");
  }

  const nonce = decodeStrictBase64Url(noncePart, "nonce");
  const ciphertext = ciphertextPart === ""
    ? Buffer.alloc(0)
    : decodeStrictBase64Url(ciphertextPart, "ciphertext");
  const tag = decodeStrictBase64Url(tagPart, "tag");

  if (nonce.length !== nonceBytes || tag.length !== tagBytes) {
    throw new AuthDataEnvelopeError("Malformed auth data envelope.");
  }

  return { nonce, ciphertext, tag };
};

export const encryptAuthAccountSensitiveFields = <T extends AuthAccountSensitiveFields>(
  account: T,
  cipher: AuthDataCipher | null,
  model = "account"
): T => {
  if (!cipher) {
    return account;
  }

  let next: T | null = null;

  for (const field of sensitiveAccountTokenFields) {
    const value = account[field];

    if (value === null || value === undefined || typeof value !== "string") {
      continue;
    }

    const encrypted = cipher.encrypt({ model, field, plaintext: value });

    if (encrypted !== value) {
      next ??= { ...account };
      next[field] = encrypted as T[typeof field];
    }
  }

  return next ?? account;
};

export const decryptAuthAccountSensitiveFields = <T extends AuthAccountSensitiveFields>(
  account: T,
  cipher: AuthDataCipher | null,
  model = "account"
): T => {
  if (!cipher) {
    return account;
  }

  let next: T | null = null;

  for (const field of sensitiveAccountTokenFields) {
    const value = account[field];

    if (value === null || value === undefined || typeof value !== "string") {
      continue;
    }

    const decrypted = cipher.decrypt({ model, field, storedValue: value });

    if (decrypted !== value) {
      next ??= { ...account };
      next[field] = decrypted as T[typeof field];
    }
  }

  return next ?? account;
};
