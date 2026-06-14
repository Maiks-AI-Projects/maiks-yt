import { describe, expect, it } from "vitest";

import {
  isAllowedTelemetryEvent,
  telemetryEventDefinitions
} from "../src/telemetry.config.js";

describe("telemetry config", () => {
  it("rejects events outside the explicit allowlist", () => {
    expect(isAllowedTelemetryEvent("page.view")).toBe(false);
    expect(isAllowedTelemetryEvent("security.token-denied")).toBe(true);
  });

  it("does not allow message content or sensitive profile data", () => {
    for (const definition of Object.values(telemetryEventDefinitions)) {
      expect(definition.containsMessageContent).toBe(false);
      expect(definition.containsSensitiveProfileData).toBe(false);
    }
  });
});
