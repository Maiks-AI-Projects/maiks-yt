import { describe, expect, it } from "vitest";

import { getApiPublicBaseUrl } from "../src/api-public-base-url.rules.js";

describe("API public base URL policy", () => {
  it("uses the production API origin when production configuration is absent", () => {
    expect(getApiPublicBaseUrl({ NODE_ENV: "production" })).toBe("https://api.maiks.yt");
  });

  it("keeps localhost outside production", () => {
    expect(getApiPublicBaseUrl({ NODE_ENV: "test" })).toBe("http://localhost:3001");
    expect(getApiPublicBaseUrl({ NODE_ENV: "development" })).toBe("http://localhost:3001");
  });

  it("gives explicit configuration precedence and removes trailing slashes", () => {
    expect(getApiPublicBaseUrl({
      API_PUBLIC_BASE_URL: " https://api-preview.example.test/// ",
      NODE_ENV: "production"
    })).toBe("https://api-preview.example.test");
  });
});
