import { describe, expect, it } from "vitest";

import {
  assertTrustedOriginEnvironment,
  getBetterAuthBaseUrl,
  getTrustedOrigins
} from "../../src/auth/better-auth-origin.rules.js";

describe("Better Auth origin policy", () => {
  it("rejects Better Auth's additive trusted-origin environment hook in production", () => {
    expect(() => assertTrustedOriginEnvironment({
      BETTER_AUTH_TRUSTED_ORIGINS: "https://unexpected.example.test",
      NODE_ENV: "production"
    })).toThrowError(
      "BETTER_AUTH_TRUSTED_ORIGINS is not supported in production; use AUTH_TRUSTED_ORIGINS."
    );
  });

  it("does not reject an unset additive origin hook", () => {
    expect(() => assertTrustedOriginEnvironment({ NODE_ENV: "production" })).not.toThrow();
    expect(() => assertTrustedOriginEnvironment({
      BETTER_AUTH_TRUSTED_ORIGINS: "   ",
      NODE_ENV: "production"
    })).not.toThrow();
  });

  it("uses production-only origins when production configuration is absent", () => {
    expect(getTrustedOrigins({ NODE_ENV: "production" })).toEqual([
      "https://maiks.yt",
      "https://www.maiks.yt",
      "https://control.maiks.yt",
      "https://overlay.maiks.yt"
    ]);
  });

  it("keeps local and dev origins outside production", () => {
    expect(getTrustedOrigins({ NODE_ENV: "development" })).toEqual([
      "http://localhost:3000",
      "http://localhost:3002",
      "http://localhost:3003",
      "https://web-dev.maiks.yt",
      "https://overlay-dev.maiks.yt",
      "https://control-dev.maiks.yt"
    ]);
  });

  it("gives explicit trusted origins precedence and removes duplicates", () => {
    expect(getTrustedOrigins({
      AUTH_TRUSTED_ORIGINS: " https://account.example.test,https://control.example.test,https://account.example.test ",
      NODE_ENV: "production"
    })).toEqual([
      "https://account.example.test",
      "https://control.example.test"
    ]);
  });

  it("defaults the Better Auth base URL by environment", () => {
    expect(getBetterAuthBaseUrl({ NODE_ENV: "production" })).toBe("https://api.maiks.yt");
    expect(getBetterAuthBaseUrl({ NODE_ENV: "test" })).toBe("http://localhost:3001");
  });

  it("gives an explicit Better Auth base URL precedence", () => {
    expect(getBetterAuthBaseUrl({
      BETTER_AUTH_URL: " https://auth.example.test ",
      NODE_ENV: "production"
    })).toBe("https://auth.example.test");
  });
});
