import { describe, expect, it } from "vitest";

import {
  AuthVerificationIdentifierHashConfigurationError,
  createAuthVerificationIdentifierHasher,
  createAuthVerificationIdentifierHasherFromBase64Key,
  createAuthVerificationIdentifierHasherFromEnvironment
} from "../../src/auth/auth-verification-identifier-hash.service.js";

const key = Buffer.from("f".repeat(32), "utf8");
const base64Key = key.toString("base64");

describe("auth verification identifier hashing", () => {
  it("uses the versioned HMAC-SHA-256 contract", () => {
    const hasher = createAuthVerificationIdentifierHasher(key);

    expect(hasher.hash("oauth-state-identifier")).toBe(
      "d75f8bca668ef95d9a5186215fb1fa66638d32c834fc2c969959d0ab803d3566"
    );
    expect(hasher.hash("different-identifier")).not.toBe(
      hasher.hash("oauth-state-identifier")
    );
  });

  it("accepts only canonical base64 keys that decode to 32 bytes", () => {
    expect(createAuthVerificationIdentifierHasherFromBase64Key(base64Key).hash("identifier"))
      .toHaveLength(64);
    expect(() => createAuthVerificationIdentifierHasherFromBase64Key("not base64"))
      .toThrow(AuthVerificationIdentifierHashConfigurationError);
    expect(() => createAuthVerificationIdentifierHasherFromBase64Key(
      Buffer.alloc(31).toString("base64")
    )).toThrow("exactly 32 bytes");
  });

  it("requires the key in production and permits no hasher outside production", () => {
    expect(createAuthVerificationIdentifierHasherFromEnvironment({ NODE_ENV: "test" })).toBeNull();
    expect(() => createAuthVerificationIdentifierHasherFromEnvironment({ NODE_ENV: "production" }))
      .toThrow("AUTH_VERIFICATION_IDENTIFIER_HASH_KEY_V1 is required in production");
    expect(createAuthVerificationIdentifierHasherFromEnvironment({
      NODE_ENV: "production",
      AUTH_VERIFICATION_IDENTIFIER_HASH_KEY_V1: base64Key
    })?.hash("identifier")).toHaveLength(64);
  });
});
