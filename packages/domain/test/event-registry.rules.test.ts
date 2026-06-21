import { describe, expect, it } from "vitest";

import {
  canSourceEmitEventKind,
  eventKinds,
  eventRegistry,
  eventSourcePlatforms,
  getEventRegistryEntry,
  isEventKind,
  isEventSourcePlatform,
  listEventKindsForSource,
  listOverlayEligibleEventKindsForSource
} from "../src/events/index.js";

describe("event registry source capabilities", () => {
  it("defines the platform and event kind foundation for the dev console", () => {
    expect(eventSourcePlatforms).toEqual([
      "twitch",
      "youtube",
      "discord",
      "website",
      "test/system"
    ]);
    expect(eventKinds).toContain("chat");
    expect(eventKinds).toContain("website.signup");
    expect(eventKinds).toContain("twitch.bits");
    expect(eventKinds).toContain("youtube.super-chat");
    expect(eventKinds).toContain("discord.boost");
    expect(eventKinds).toContain("simulated.support-money");
    expect(eventRegistry).toHaveLength(eventKinds.length);
  });

  it("rejects impossible provider and platform combinations", () => {
    expect(canSourceEmitEventKind("twitch", "twitch.bits")).toBe(true);
    expect(canSourceEmitEventKind("discord", "twitch.bits")).toBe(false);
    expect(canSourceEmitEventKind("youtube", "twitch.bits")).toBe(false);
    expect(canSourceEmitEventKind("discord", "discord.boost")).toBe(true);
    expect(canSourceEmitEventKind("website", "website.project-update-published")).toBe(true);
  });

  it("only lists source-capable events for each platform", () => {
    const discordEvents = listEventKindsForSource("discord");
    const websiteEvents = listEventKindsForSource("website");

    expect(discordEvents).toEqual([
      "discord.message",
      "discord.join",
      "discord.role",
      "discord.boost"
    ]);
    expect(discordEvents).not.toContain("twitch.follow");
    expect(discordEvents).not.toContain("youtube.super-chat");
    expect(websiteEvents).toContain("website.profile-image-update");
    expect(websiteEvents).toContain("simulated.support-money");
  });

  it("allows test/system to simulate every registered event kind", () => {
    expect(listEventKindsForSource("test/system")).toEqual([...eventKinds]);
  });

  it("marks money and simulated support events without enabling real money behavior", () => {
    expect(getEventRegistryEntry("twitch.bits").safety).toMatchObject({
      moneyGated: true,
      providerGated: true,
      simulatedOnly: false
    });
    expect(getEventRegistryEntry("simulated.support-money").safety).toMatchObject({
      moneyGated: true,
      simulatedOnly: true
    });
  });

  it("keeps privacy and account-sensitive events internal-only", () => {
    expect(getEventRegistryEntry("website.account-security-change").safety).toMatchObject({
      internalOnly: true,
      overlayEligible: false
    });
    expect(getEventRegistryEntry("website.provider-token-change").safety).toMatchObject({
      internalOnly: true,
      overlayEligible: false
    });
    expect(listOverlayEligibleEventKindsForSource("website")).not.toContain("website.account-security-change");
  });

  it("validates known source platforms and event kinds", () => {
    expect(isEventSourcePlatform("twitch")).toBe(true);
    expect(isEventSourcePlatform("site")).toBe(false);
    expect(isEventKind("website.free-tts-request")).toBe(true);
    expect(isEventKind("youtube.bits")).toBe(false);
  });
});
