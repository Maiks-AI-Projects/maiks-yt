import type { OverlaySceneDefinition } from "@maiks-yt/events";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { OverlayScenesResponse } from "./overlay-api.types.js";
import type { OverlayPresenceState, OverlayStatusResponse } from "./SurfaceStatus.types.js";

type UseOverlayPresenceResult = {
  overlayPresence: OverlayPresenceState;
  sceneOptions: OverlaySceneDefinition[];
  setOverlayPresence: Dispatch<SetStateAction<OverlayPresenceState>>;
};

export const useOverlayPresence = (apiBaseUrl: string): UseOverlayPresenceResult => {
  const [overlayPresence, setOverlayPresence] = useState<OverlayPresenceState>({ status: "checking" });
  const [sceneOptions, setSceneOptions] = useState<OverlaySceneDefinition[]>([]);

  useEffect(() => {
    let disposed = false;
    const token = window.localStorage.getItem("maiks.yt.control.accessToken");

    const refreshPresence = async (): Promise<void> => {
      if (!token) {
        setOverlayPresence({
          status: "error",
          message: "Control token missing."
        });
        return;
      }

      try {
        const url = new URL("/overlay/status", apiBaseUrl);
        url.searchParams.set("accessToken", token);
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Overlay status failed with ${response.status}`);
        }

        const result = await response.json() as OverlayStatusResponse;

        if (!result.ok) {
          throw new Error(result.reason);
        }

        if (!disposed) {
          setOverlayPresence({
            status: "ready",
            activeOverlayConnections: result.activeOverlayConnections,
            checkedAt: result.checkedAt,
            emergencyCleanModeEnabled: result.emergencyCleanModeEnabled,
            chatVisible: result.chatVisible,
            chatNewestOnTop: result.chatNewestOnTop,
            sponsorVisible: result.sponsorVisible,
            aiMuted: result.aiMuted,
            topBarEnabled: result.topBarEnabled,
            centerEnabled: result.centerEnabled,
            centerDefaultTiming: result.centerDefaultTiming,
            presentationState: result.presentationState,
            activeGoal: result.activeGoal
          });
        }
      } catch (error) {
        if (!disposed) {
          setOverlayPresence({
            status: "error",
            message: error instanceof Error ? error.message : "Overlay status unavailable."
          });
        }
      }
    };

    const loadScenes = async (): Promise<void> => {
      if (!token) {
        return;
      }

      try {
        const url = new URL("/overlay/scenes", apiBaseUrl);
        url.searchParams.set("accessToken", token);
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Overlay scenes failed with ${response.status}`);
        }

        const result = await response.json() as OverlayScenesResponse;

        if (!result.ok) {
          throw new Error(result.reason);
        }

        if (!disposed) {
          setSceneOptions(result.scenes);
        }
      } catch {
        if (!disposed) {
          setSceneOptions([]);
        }
      }
    };

    void refreshPresence();
    void loadScenes();
    const interval = window.setInterval(refreshPresence, 5_000);

    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [apiBaseUrl]);

  return {
    overlayPresence,
    sceneOptions,
    setOverlayPresence
  };
};
