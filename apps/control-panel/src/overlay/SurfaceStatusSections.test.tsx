import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { shouldRenderUnsupportedProductOverlayControls } from "./SurfaceStatus.rules.js";
import {
  GoalWidgetSettings,
  SurfaceStatusControls
} from "./SurfaceStatusSections.js";
import { defaultGoalDraft } from "./SurfaceStatus.types.js";

const readyOverlayPresence = {
  status: "ready" as const,
  activeOverlayConnections: 2,
  checkedAt: "2026-08-28T20:00:00.000Z",
  emergencyCleanModeEnabled: false,
  chatVisible: true,
  chatNewestOnTop: false,
  sponsorVisible: true,
  aiMuted: false,
  topBarEnabled: true,
  centerEnabled: true,
  centerDefaultTiming: {
    onscreenMs: 4_000,
    fadeOutMs: 700,
    restMs: 1_500
  },
  presentationState: {
    scene: "default",
    layout: "standard" as const,
    theme: "default" as const
  },
  activeGoal: null
};

const noopAsync = vi.fn(async () => undefined);
const noopSync = vi.fn();

describe("production-safe overlay controls", () => {
  it("uses the Vite production environment to omit unsupported product controls", () => {
    expect(shouldRenderUnsupportedProductOverlayControls({ PROD: true })).toBe(false);
    expect(shouldRenderUnsupportedProductOverlayControls({ PROD: false })).toBe(true);
  });

  it("omits Sponsor controls while preserving production-safe status controls", () => {
    const markup = renderToStaticMarkup(
      <SurfaceStatusControls
        chatNewestOnTop={false}
        chatVisible={true}
        emergencyCleanModeEnabled={false}
        overlayActive={true}
        overlayPresence={readyOverlayPresence}
        panelMode="creator"
        sponsorVisible={true}
        topBarEnabled={true}
        unsupportedProductControlsEnabled={false}
        updateChatOrder={noopAsync}
        updateChatVisibility={noopAsync}
        updateEmergencyCleanMode={noopAsync}
        updateSponsorVisibility={noopAsync}
        updateTopBarEnabled={noopAsync}
      />
    );

    expect(markup).toContain("Control panel");
    expect(markup).toContain("Overlay");
    expect(markup).toContain("Emergency clean");
    expect(markup).toContain("Top bar on");
    expect(markup).toContain("Chat on");
    expect(markup).toContain("Newest bottom");
    expect(markup).not.toContain("Sponsor on");
    expect(markup).not.toContain("Sponsor off");
  });

  it("omits the fundraising Goal editor in production mode", () => {
    const markup = renderToStaticMarkup(
      <GoalWidgetSettings
        activeGoal={null}
        goalDraft={defaultGoalDraft()}
        saveActiveGoal={noopAsync}
        setGoalDraft={noopSync}
        unsupportedProductControlsEnabled={false}
        updateGoalDraft={noopSync}
      />
    );

    expect(markup).toBe("");
  });

  it("preserves the non-production harness controls for local overlay testing", () => {
    const statusMarkup = renderToStaticMarkup(
      <SurfaceStatusControls
        chatNewestOnTop={false}
        chatVisible={true}
        emergencyCleanModeEnabled={false}
        overlayActive={true}
        overlayPresence={readyOverlayPresence}
        panelMode="creator"
        sponsorVisible={true}
        topBarEnabled={true}
        unsupportedProductControlsEnabled={true}
        updateChatOrder={noopAsync}
        updateChatVisibility={noopAsync}
        updateEmergencyCleanMode={noopAsync}
        updateSponsorVisibility={noopAsync}
        updateTopBarEnabled={noopAsync}
      />
    );
    const goalMarkup = renderToStaticMarkup(
      <GoalWidgetSettings
        activeGoal={null}
        goalDraft={defaultGoalDraft()}
        saveActiveGoal={noopAsync}
        setGoalDraft={noopSync}
        unsupportedProductControlsEnabled={true}
        updateGoalDraft={noopSync}
      />
    );

    expect(statusMarkup).toContain("Sponsor on");
    expect(goalMarkup).toContain("Goal widget");
    expect(goalMarkup).toContain("Save goal");
  });
});
