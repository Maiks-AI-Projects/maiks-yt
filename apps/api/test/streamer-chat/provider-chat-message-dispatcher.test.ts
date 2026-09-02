import type { TwitchChatProjectedMessage } from "@maiks-yt/integrations";
import { describe, expect, it, vi } from "vitest";

import {
  dispatchOrDeliverProviderChatMessage,
  isProviderChatMessageDispatcherEnabled,
  ProviderChatMessageDispatcher
} from "../../src/streamer-chat/provider-chat-message-dispatcher.service.js";

const twitchMessage = (providerMessageId: string): TwitchChatProjectedMessage => ({
  id: `internal-${providerMessageId}`,
  authorKind: "human",
  authorName: "Viewer",
  channelName: "maiksplays",
  createdAt: "2026-09-02T12:00:00.000Z",
  message: "Hello",
  providerMessageId,
  source: "twitch",
  userId: "viewer-1",
  userName: "viewer",
  visibleOnOverlayByDefault: true
});

describe("ProviderChatMessageDispatcher", () => {
  it("is default-off and enables only for an explicit true flag", () => {
    expect(isProviderChatMessageDispatcherEnabled({})).toBe(false);
    expect(isProviderChatMessageDispatcherEnabled({ PROVIDER_CHAT_MESSAGE_DISPATCHER_ENABLED: "false" })).toBe(false);
    expect(isProviderChatMessageDispatcherEnabled({ PROVIDER_CHAT_MESSAGE_DISPATCHER_ENABLED: " true " })).toBe(true);
  });

  it("isolates subscribers when one throws or rejects", async () => {
    const failures: string[] = [];
    const delivered: string[] = [];
    const dispatcher = new ProviderChatMessageDispatcher({
      onSubscriberError: ({ subscriberId }) => failures.push(subscriberId)
    });

    dispatcher.subscribe("throws", () => {
      throw new Error("subscriber failed");
    });
    dispatcher.subscribe("receives", (event) => {
      delivered.push(event.payload.providerMessageId);
    });
    dispatcher.subscribe("rejects", async () => {
      throw new Error("async subscriber failed");
    });

    expect(dispatcher.publish(twitchMessage("message-1"))).toMatchObject({
      deliveredSubscriberCount: 2,
      duplicate: false,
      eventId: "twitch:message-1"
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(delivered).toEqual(["message-1"]);
    expect(failures).toEqual(["throws", "rejects"]);
  });

  it("keeps delivering when the subscriber error reporter also throws", () => {
    const delivered = vi.fn();
    const dispatcher = new ProviderChatMessageDispatcher({
      onSubscriberError: () => {
        throw new Error("diagnostic failed");
      }
    });
    dispatcher.subscribe("throws", () => {
      throw new Error("subscriber failed");
    });
    dispatcher.subscribe("receives", delivered);

    expect(() => dispatcher.publish(twitchMessage("message-1"))).not.toThrow();
    expect(delivered).toHaveBeenCalledOnce();
  });

  it("delivers a provider message at most once inside the bounded process window", () => {
    const subscriber = vi.fn();
    const dispatcher = new ProviderChatMessageDispatcher();
    dispatcher.subscribe("accepted-chat", subscriber);

    expect(dispatcher.publish(twitchMessage("message-1")).duplicate).toBe(false);
    expect(dispatcher.publish(twitchMessage("message-1")).duplicate).toBe(true);
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it("preserves the direct callback while the feature flag is off", () => {
    const direct = vi.fn();
    const subscriber = vi.fn();
    const dispatcher = new ProviderChatMessageDispatcher();
    dispatcher.subscribe("accepted-chat", subscriber);

    dispatchOrDeliverProviderChatMessage({
      direct,
      dispatcher,
      enabled: false,
      message: twitchMessage("message-1")
    });

    expect(direct).toHaveBeenCalledOnce();
    expect(subscriber).not.toHaveBeenCalled();
  });

  it("uses the dispatcher instead of the direct callback when explicitly enabled", () => {
    const direct = vi.fn();
    const subscriber = vi.fn();
    const dispatcher = new ProviderChatMessageDispatcher();
    dispatcher.subscribe("accepted-chat", subscriber);

    dispatchOrDeliverProviderChatMessage({
      direct,
      dispatcher,
      enabled: true,
      message: twitchMessage("message-1")
    });

    expect(direct).not.toHaveBeenCalled();
    expect(subscriber).toHaveBeenCalledOnce();
  });
});
