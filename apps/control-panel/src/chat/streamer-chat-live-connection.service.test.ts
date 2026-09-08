import { describe, expect, it } from "vitest";

import {
  getStreamerChatReconnectDelayMs,
  getStreamerChatReconnectMessage,
  isStreamerChatAccessDeniedClose
} from "./streamer-chat-live-connection.service.js";

describe("streamer chat live connection policy", () => {
  it("backs off reconnects without unbounded delay", () => {
    expect(getStreamerChatReconnectDelayMs(0)).toBe(1_000);
    expect(getStreamerChatReconnectDelayMs(1)).toBe(2_000);
    expect(getStreamerChatReconnectDelayMs(4)).toBe(16_000);
    expect(getStreamerChatReconnectDelayMs(12)).toBe(30_000);
  });

  it("does not retry access-denied socket closes", () => {
    expect(isStreamerChatAccessDeniedClose({
      code: 1008,
      reason: "control_panel_access_denied"
    })).toBe(true);
    expect(isStreamerChatAccessDeniedClose({
      code: 1006,
      reason: "network reset"
    })).toBe(false);
  });

  it("keeps retry copy compact for the chat top bar", () => {
    expect(getStreamerChatReconnectMessage(2_000)).toBe("Streamer chat live feed reconnecting in 2s.");
  });
});
