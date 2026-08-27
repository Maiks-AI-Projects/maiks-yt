import type { StreamerChatMessage } from "@maiks-yt/events";
import { describe, expect, it } from "vitest";

import {
  applyStreamerChatMessage,
  applyStreamerChatSnapshot,
  createEmptyStreamerChatState,
  parseStreamerChatLiveMessage
} from "./streamer-chat-state.service.js";

const message = (id: string): StreamerChatMessage => ({
  authorKind: "human",
  authorName: id,
  createdAt: "2026-08-27T20:00:00.000Z",
  id,
  message: id,
  source: "twitch",
  visibleOnOverlayByDefault: false
});

describe("streamer chat versioned state", () => {
  it("rejects malformed and old-contract live frames before they can suppress recovery", () => {
    expect(parseStreamerChatLiveMessage({
      type: "streamer-chat.snapshot",
      payload: { messages: [], sentAt: "2026-08-27T20:00:00.000Z" }
    })).toBeNull();
    expect(parseStreamerChatLiveMessage({
      type: "streamer-chat.message.received",
      payload: { id: "incomplete" },
      revision: 1,
      sessionId: "api-session"
    })).toBeNull();
  });

  it("accepts a complete versioned live frame", () => {
    expect(parseStreamerChatLiveMessage({
      type: "streamer-chat.message.received",
      payload: message("valid"),
      revision: 1,
      sessionId: "api-session"
    })).toMatchObject({ type: "streamer-chat.message.received", revision: 1 });
  });

  it("ignores a stale HTTP or WebSocket snapshot after a newer live message", () => {
    const initial = applyStreamerChatSnapshot(createEmptyStreamerChatState(), {
      messages: [message("initial")],
      revision: 2,
      sessionId: "api-session"
    });
    const live = applyStreamerChatMessage(initial, {
      message: message("live"),
      revision: 3,
      sessionId: "api-session"
    });

    expect(applyStreamerChatSnapshot(live, {
      messages: [message("initial")],
      revision: 2,
      sessionId: "api-session"
    })).toBe(live);
    expect(live.messages.map(({ id }) => id)).toEqual(["live", "initial"]);
  });

  it("accepts a newer authoritative snapshot so moderation removals stay removed", () => {
    const current = applyStreamerChatMessage(createEmptyStreamerChatState(), {
      message: message("removed"),
      revision: 3,
      sessionId: "api-session"
    });
    const moderated = applyStreamerChatSnapshot(current, {
      messages: [message("kept")],
      revision: 4,
      sessionId: "api-session"
    });

    expect(moderated.messages.map(({ id }) => id)).toEqual(["kept"]);
  });

  it("accepts a lower revision after an API process restart changes the session", () => {
    const oldSession = applyStreamerChatSnapshot(createEmptyStreamerChatState(), {
      messages: [message("old")],
      revision: 50,
      sessionId: "old-session"
    });
    const restarted = applyStreamerChatSnapshot(oldSession, {
      messages: [message("new")],
      revision: 0,
      sessionId: "new-session"
    });

    expect(restarted).toMatchObject({ revision: 0, sessionId: "new-session" });
    expect(restarted.messages.map(({ id }) => id)).toEqual(["new"]);
  });
});
