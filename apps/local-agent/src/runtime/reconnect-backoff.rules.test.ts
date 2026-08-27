import { describe, expect, it } from "vitest";
import { getReconnectDelayMs } from "./reconnect-backoff.rules.js";

describe("getReconnectDelayMs", () => {
  it("applies exponential growth, a cap, and jitter", () => {
    const policy = { baseMs: 1_000, maxMs: 30_000 };
    expect(getReconnectDelayMs(0, policy, () => 0.5)).toBe(500);
    expect(getReconnectDelayMs(3, policy, () => 0.5)).toBe(4_000);
    expect(getReconnectDelayMs(20, policy, () => 1)).toBe(30_000);
  });

  it("never returns a negative delay", () => {
    expect(getReconnectDelayMs(-10, { baseMs: 1_000, maxMs: 30_000 }, () => -1)).toBe(0);
  });
});
