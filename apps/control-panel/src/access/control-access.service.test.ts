import { describe, expect, it } from "vitest";

import {
  getControlAccessRetryDelay
} from "./control-access.service.js";

describe("control access recovery", () => {
  it("caps transient retry delay at thirty seconds", () => {
    expect(getControlAccessRetryDelay(0)).toBe(2_000);
    expect(getControlAccessRetryDelay(2)).toBe(10_000);
    expect(getControlAccessRetryDelay(99)).toBe(30_000);
  });
});
