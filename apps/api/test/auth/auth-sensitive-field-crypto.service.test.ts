import { describe, expect, it } from "vitest";

import {
  AuthDataEncryptionConfigurationError,
  AuthDataEnvelopeError,
  createAuthDataCipherFromBase64Key,
  createAuthDataCipherFromEnvironment,
  decryptAuthAccountSensitiveFields,
  encryptAuthAccountSensitiveFields,
  isKnownAuthDataEnvelope
} from "../../src/auth/auth-sensitive-field-crypto.service.js";

const keyV1 = Buffer.from("a".repeat(32), "utf8").toString("base64");

describe("auth sensitive field crypto", () => {
  it("encrypts and decrypts a versioned envelope with account-field AAD", () => {
    const cipher = createAuthDataCipherFromBase64Key(keyV1);
    const encrypted = cipher.encrypt({
      model: "account",
      field: "accessToken",
      plaintext: "provider-access-token"
    });

    expect(encrypted).not.toBe("provider-access-token");
    expect(isKnownAuthDataEnvelope(encrypted)).toBe(true);
    expect(cipher.decrypt({
      model: "account",
      field: "accessToken",
      storedValue: encrypted
    })).toBe("provider-access-token");
  });

  it("rejects field movement through authenticated AAD", () => {
    const cipher = createAuthDataCipherFromBase64Key(keyV1);
    const encrypted = cipher.encrypt({
      model: "account",
      field: "accessToken",
      plaintext: "provider-access-token"
    });

    expect(() => cipher.decrypt({
      model: "account",
      field: "refreshToken",
      storedValue: encrypted
    })).toThrow(AuthDataEnvelopeError);
  });

  it("rejects tampered envelopes", () => {
    const cipher = createAuthDataCipherFromBase64Key(keyV1);
    const encrypted = cipher.encrypt({
      model: "account",
      field: "idToken",
      plaintext: "provider-id-token"
    });
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("A") ? "B" : "A"}`;

    expect(() => cipher.decrypt({
      model: "account",
      field: "idToken",
      storedValue: tampered
    })).toThrow(AuthDataEnvelopeError);
  });

  it("fails closed for unknown and malformed encrypted envelopes", () => {
    const cipher = createAuthDataCipherFromBase64Key(keyV1);

    expect(() => cipher.decrypt({
      model: "account",
      field: "accessToken",
      storedValue: "maiks-auth-data:v2:opaque"
    })).toThrow(AuthDataEnvelopeError);
    expect(() => cipher.decrypt({
      model: "account",
      field: "accessToken",
      storedValue: "maiks-auth-data:v1:not-an-envelope"
    })).toThrow(AuthDataEnvelopeError);
  });

  it("keeps staged plaintext compatibility for non-envelope values", () => {
    const cipher = createAuthDataCipherFromBase64Key(keyV1);

    expect(cipher.decrypt({
      model: "account",
      field: "accessToken",
      storedValue: "legacy-provider-access-token"
    })).toBe("legacy-provider-access-token");
  });

  it("preserves null and undefined sensitive fields", () => {
    const cipher = createAuthDataCipherFromBase64Key(keyV1);
    const account = {
      accessToken: null,
      refreshToken: undefined,
      idToken: "provider-id-token"
    };
    const encrypted = encryptAuthAccountSensitiveFields(account, cipher);
    const decrypted = decryptAuthAccountSensitiveFields(encrypted, cipher);

    expect(encrypted.accessToken).toBeNull();
    expect(encrypted.refreshToken).toBeUndefined();
    expect(isKnownAuthDataEnvelope(encrypted.idToken)).toBe(true);
    expect(decrypted).toEqual(account);
  });

  it("does not double encrypt known envelopes", () => {
    const cipher = createAuthDataCipherFromBase64Key(keyV1);
    const encrypted = cipher.encrypt({
      model: "account",
      field: "refreshToken",
      plaintext: "provider-refresh-token"
    });

    expect(cipher.encrypt({
      model: "account",
      field: "refreshToken",
      plaintext: encrypted
    })).toBe(encrypted);
  });

  it("round-trips an empty token value without producing an invalid envelope", () => {
    const cipher = createAuthDataCipherFromBase64Key(keyV1);
    const encrypted = cipher.encrypt({
      model: "account",
      field: "accessToken",
      plaintext: ""
    });

    expect(isKnownAuthDataEnvelope(encrypted)).toBe(true);
    expect(cipher.decrypt({
      model: "account",
      field: "accessToken",
      storedValue: encrypted
    })).toBe("");
  });

  it("strictly requires a canonical 32-byte base64 production key", () => {
    expect(() => createAuthDataCipherFromBase64Key(Buffer.from("short").toString("base64")))
      .toThrow(AuthDataEncryptionConfigurationError);
    expect(() => createAuthDataCipherFromBase64Key("not base64"))
      .toThrow(AuthDataEncryptionConfigurationError);
    expect(() => createAuthDataCipherFromEnvironment({ NODE_ENV: "production" }))
      .toThrow(AuthDataEncryptionConfigurationError);
    expect(createAuthDataCipherFromEnvironment({ NODE_ENV: "test" })).toBeNull();
  });
});
