import { describe, expect, it } from "vitest";

import {
  AuthSessionTokenHashConfigurationError,
  createAuthSessionTokenHasher,
  createAuthSessionTokenHasherFromBase64Key,
  createAuthSessionTokenHasherFromEnvironment
} from "../../src/auth/auth-session-token-hash.service.js";

const key = Buffer.from("c".repeat(32), "utf8");
const base64Key = key.toString("base64");

describe("auth session token hashing", () => {
  it("uses the versioned HMAC-SHA-256 contract", () => {
    const hasher = createAuthSessionTokenHasher(key);

    expect(hasher.hash("existing-session-token")).toBe(
      "78492ae2407fa105edfe6977de5b534a3c51f422f5a64e52dc32b7f3d013e039"
    );
    expect(hasher.hash("different-session-token")).not.toBe(
      hasher.hash("existing-session-token")
    );
  });

  it("accepts only canonical base64 keys that decode to 32 bytes", () => {
    expect(createAuthSessionTokenHasherFromBase64Key(base64Key).hash("token")).toHaveLength(64);
    expect(() => createAuthSessionTokenHasherFromBase64Key("not base64"))
      .toThrow(AuthSessionTokenHashConfigurationError);
    expect(() => createAuthSessionTokenHasherFromBase64Key(Buffer.alloc(31).toString("base64")))
      .toThrow("exactly 32 bytes");
  });

  it("requires the key in production and permits no hasher in development", () => {
    expect(createAuthSessionTokenHasherFromEnvironment({ NODE_ENV: "development" })).toBeNull();
    expect(() => createAuthSessionTokenHasherFromEnvironment({ NODE_ENV: "production" }))
      .toThrow("AUTH_SESSION_TOKEN_HASH_KEY_V1 is required in production");
    expect(createAuthSessionTokenHasherFromEnvironment({
      NODE_ENV: "production",
      AUTH_SESSION_TOKEN_HASH_KEY_V1: base64Key
    })?.hash("token")).toHaveLength(64);
  });
});
