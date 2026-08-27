import { describe, expect, it } from "vitest";

import { classifyBackupHealthDatabaseFailure } from "./backup-health.service.js";

describe("classifyBackupHealthDatabaseFailure", () => {
  it.each([
    ["ETIMEDOUT", "timeout"],
    ["ER_ACCESS_DENIED_ERROR", "authentication"],
    ["ECONNREFUSED", "network"],
    ["ER_BAD_FIELD_ERROR", "query"],
    ["SOMETHING_ELSE", "unknown"]
  ] as const)("maps %s to %s", (code, expected) => {
    expect(classifyBackupHealthDatabaseFailure({
      code,
      message: "sensitive driver detail that must not be returned"
    })).toBe(expected);
  });

  it("fails closed for non-driver errors", () => {
    expect(classifyBackupHealthDatabaseFailure(new Error("sensitive"))).toBe("unknown");
    expect(classifyBackupHealthDatabaseFailure(null)).toBe("unknown");
  });
});
