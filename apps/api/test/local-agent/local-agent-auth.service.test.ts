import { describe, expect, it } from "vitest";

import {
  readBearerCredential,
  validateLocalAgentCredential
} from "../../src/local-agent/local-agent-auth.service.js";

describe("local-agent credential validation", () => {
  it("accepts only an exact dedicated bearer credential", () => {
    const token = "agent_012345678901234567890123456789012345";
    expect(readBearerCredential(`Bearer ${token}`)).toBe(token);
    expect(validateLocalAgentCredential(token, token)).toBe(true);
    expect(validateLocalAgentCredential(token, `${token}x`)).toBe(false);
    expect(validateLocalAgentCredential(null, token)).toBe(false);
  });

  it("rejects missing, short, and whitespace-bearing bearer values", () => {
    expect(readBearerCredential(undefined)).toBeNull();
    expect(readBearerCredential("Basic abc")).toBeNull();
    expect(readBearerCredential("Bearer short")).toBeNull();
    expect(readBearerCredential(`Bearer ${"x".repeat(32)} value`)).toBeNull();
  });
});
