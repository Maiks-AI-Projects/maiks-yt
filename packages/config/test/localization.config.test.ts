import { describe, expect, it } from "vitest";

import {
  createCurrencyFormatter,
  defaultLocale,
  resolveLocale
} from "../src/localization.config.js";

describe("localization config", () => {
  it("uses English as the fallback locale", () => {
    expect(resolveLocale(undefined)).toBe(defaultLocale);
    expect(resolveLocale("fr")).toBe(defaultLocale);
  });

  it("accepts Dutch without changing the default language", () => {
    expect(resolveLocale("NL")).toBe("nl");
    expect(createCurrencyFormatter("nl", "EUR").format(12.5)).toContain("12,50");
  });
});
