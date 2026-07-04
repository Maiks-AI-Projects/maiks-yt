import { randomUUID } from "node:crypto";

import type { OverlayLiveMessage } from "@maiks-yt/events";
import { overlaySceneSlotIds } from "@maiks-yt/themes";
import type { FastifyInstance } from "fastify";

import type { OverlayLiveSocket } from "./index.js";
import {
  overlayAiMutedRequestSchema,
  overlayCenterSettingsRequestSchema,
  overlayChatOrderRequestSchema,
  overlayChatVisibilityRequestSchema,
  overlayEmergencyCleanModeRequestSchema,
  overlayGoalStateSchema,
  overlayPresentationStateRequestSchema,
  overlaySceneListRequestSchema,
  overlaySceneSaveRequestSchema,
  overlaySponsorVisibilityRequestSchema,
  overlayStateRequestSchema,
  overlayStatusRequestSchema,
  overlayTopBarEnabledRequestSchema,
  type OverlayRouteDependencies
} from "./overlay-route-validation.service.js";
import { registerOverlayTestRoutes } from "./overlay-test.route.js";

export const registerOverlayRoutes = (
  server: FastifyInstance,
  dependencies: OverlayRouteDependencies
): void => {
  const {
    overlayRuntime,
    requireStreamerChatModerationPermission,
    validateUrlAccessToken
  } = dependencies;

  registerOverlayTestRoutes(server, dependencies);

  server.get("/overlay/state", async (request, reply) => {
    const parsedRequest = overlayStateRequestSchema.safeParse(request.query);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const tokenValidation = await validateUrlAccessToken({
      token: parsedRequest.data.accessToken,
      surface: "overlay",
      scope: "overlay:connect"
    });

    if (!tokenValidation.valid) {
      reply.code(403);
      return {
        ok: false,
        reason: tokenValidation.reason ?? "overlay_access_denied"
      };
    }

    return {
      ok: true,
      snapshot: overlayRuntime.createSnapshotFromRequestedState(parsedRequest.data)
    };
  });

  server.get("/overlay/status", async (request, reply) => {
    const parsedRequest = overlayStatusRequestSchema.safeParse(request.query);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const tokenValidation = await validateUrlAccessToken({
      token: parsedRequest.data.accessToken,
      surface: "control-panel",
      scope: "control:open"
    });

    if (!tokenValidation.valid) {
      reply.code(403);
      return {
        ok: false,
        reason: tokenValidation.reason ?? "control_panel_access_denied"
      };
    }

    return {
      ok: true,
      ...overlayRuntime.getStatus(),
      checkedAt: new Date().toISOString()
    };
  });

  server.post("/overlay/goal", async (request, reply) => {
    const parsedRequest = overlayGoalStateSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const tokenValidation = await validateUrlAccessToken({
      token: parsedRequest.data.accessToken,
      surface: "control-panel",
      scope: "control:open"
    });

    if (!tokenValidation.valid) {
      reply.code(403);
      return {
        ok: false,
        reason: tokenValidation.reason ?? "control_panel_access_denied"
      };
    }

    const activeGoal = overlayRuntime.setActiveGoal({
      enabled: parsedRequest.data.enabled,
      label: parsedRequest.data.label,
      currentAmount: parsedRequest.data.currentAmount,
      targetAmount: parsedRequest.data.targetAmount,
      currencyCode: parsedRequest.data.currencyCode
    });

    return {
      ok: true,
      activeGoal,
      activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
    };
  });

  server.post("/overlay/presentation-state", async (request, reply) => {
    const parsedRequest = overlayPresentationStateRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const tokenValidation = await validateUrlAccessToken({
      token: parsedRequest.data.accessToken,
      surface: "control-panel",
      scope: "control:open"
    });

    if (!tokenValidation.valid) {
      reply.code(403);
      return {
        ok: false,
        reason: tokenValidation.reason ?? "control_panel_access_denied"
      };
    }

    const presentationState = overlayRuntime.setPresentationState({
      scene: parsedRequest.data.scene,
      layout: parsedRequest.data.layout,
      theme: parsedRequest.data.theme
    });

    if (!presentationState) {
      reply.code(400);
      return {
        ok: false,
        reason: "unknown_scene"
      };
    }

    return {
      ok: true,
      presentationState,
      activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
    };
  });

  server.get("/overlay/scenes", async (request, reply) => {
    const parsedRequest = overlaySceneListRequestSchema.safeParse(request.query);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const tokenValidation = await validateUrlAccessToken({
      token: parsedRequest.data.accessToken,
      surface: "control-panel",
      scope: "control:open"
    });

    if (!tokenValidation.valid) {
      reply.code(403);
      return {
        ok: false,
        reason: tokenValidation.reason ?? "control_panel_access_denied"
      };
    }

    return {
      ok: true,
      scenes: overlayRuntime.listScenes()
    };
  });

  server.post("/overlay/scenes/save", async (request, reply) => {
    const parsedRequest = overlaySceneSaveRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const tokenValidation = await validateUrlAccessToken({
      token: parsedRequest.data.accessToken,
      surface: "control-panel",
      scope: "control:open"
    });

    if (!tokenValidation.valid) {
      reply.code(403);
      return {
        ok: false,
        reason: tokenValidation.reason ?? "control_panel_access_denied"
      };
    }

    const { scene } = parsedRequest.data;
    const missingSlot = overlaySceneSlotIds.find((slotId) => !scene.slots[slotId]);

    if (missingSlot) {
      reply.code(400);
      return {
        ok: false,
        reason: "scene_slot_missing",
        slotId: missingSlot
      };
    }

    const overflowingSlot = overlaySceneSlotIds.find((slotId) => {
      const slot = scene.slots[slotId];

      return slot.x + slot.width > scene.canvas.width || slot.y + slot.height > scene.canvas.height;
    });

    if (overflowingSlot) {
      reply.code(400);
      return {
        ok: false,
        reason: "scene_slot_outside_canvas",
        slotId: overflowingSlot
      };
    }

    const savedScene = overlayRuntime.saveScene(scene);

    return {
      ok: true,
      scene: savedScene,
      activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
    };
  });

  server.post("/overlay/center/settings", async (request, reply) => {
    const parsedRequest = overlayCenterSettingsRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const tokenValidation = await validateUrlAccessToken({
      token: parsedRequest.data.accessToken,
      surface: "control-panel",
      scope: "control:open"
    });

    if (!tokenValidation.valid) {
      reply.code(403);
      return {
        ok: false,
        reason: tokenValidation.reason ?? "control_panel_access_denied"
      };
    }

    const centerSettings = overlayRuntime.setCenterSettings({
      enabled: parsedRequest.data.enabled,
      timing: {
        onscreenMs: parsedRequest.data.onscreenMs,
        fadeOutMs: parsedRequest.data.fadeOutMs,
        restMs: parsedRequest.data.restMs
      }
    });

    return {
      ok: true,
      ...centerSettings,
      activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
    };
  });

  server.post("/overlay/top-bar/enabled", async (request, reply) => {
    const parsedRequest = overlayTopBarEnabledRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const tokenValidation = await validateUrlAccessToken({
      token: parsedRequest.data.accessToken,
      surface: "control-panel",
      scope: "control:open"
    });

    if (!tokenValidation.valid) {
      reply.code(403);
      return {
        ok: false,
        reason: tokenValidation.reason ?? "control_panel_access_denied"
      };
    }

    const topBarEnabled = overlayRuntime.setTopBarEnabled(parsedRequest.data.enabled);

    return {
      ok: true,
      topBarEnabled,
      activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
    };
  });

  server.post("/overlay/emergency-clean-mode", async (request, reply) => {
    const parsedRequest = overlayEmergencyCleanModeRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const tokenValidation = await validateUrlAccessToken({
      token: parsedRequest.data.accessToken,
      surface: "control-panel",
      scope: "control:open"
    });

    if (!tokenValidation.valid) {
      reply.code(403);
      return {
        ok: false,
        reason: tokenValidation.reason ?? "control_panel_access_denied"
      };
    }

    const accessDeniedReason = await requireStreamerChatModerationPermission(
      request,
      parsedRequest.data.accessToken,
      "emergency_clear"
    );

    if (!accessDeniedReason.ok) {
      reply.code(accessDeniedReason.statusCode);
      return {
        ok: false,
        reason: accessDeniedReason.reason
      };
    }

    const emergencyCleanModeEnabled = overlayRuntime.setEmergencyCleanModeEnabled(parsedRequest.data.enabled);

    return {
      ok: true,
      emergencyCleanModeEnabled,
      activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
    };
  });

  server.post("/overlay/chat/visibility", async (request, reply) => {
    const parsedRequest = overlayChatVisibilityRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const tokenValidation = await validateUrlAccessToken({
      token: parsedRequest.data.accessToken,
      surface: "control-panel",
      scope: "control:open"
    });

    if (!tokenValidation.valid) {
      reply.code(403);
      return {
        ok: false,
        reason: tokenValidation.reason ?? "control_panel_access_denied"
      };
    }

    const chatVisible = overlayRuntime.setChatVisible(parsedRequest.data.visible);

    return {
      ok: true,
      chatVisible,
      activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
    };
  });

  server.post("/overlay/chat/order", async (request, reply) => {
    const parsedRequest = overlayChatOrderRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const tokenValidation = await validateUrlAccessToken({
      token: parsedRequest.data.accessToken,
      surface: "control-panel",
      scope: "control:open"
    });

    if (!tokenValidation.valid) {
      reply.code(403);
      return {
        ok: false,
        reason: tokenValidation.reason ?? "control_panel_access_denied"
      };
    }

    const chatNewestOnTop = overlayRuntime.setChatNewestOnTop(parsedRequest.data.newestOnTop);

    return {
      ok: true,
      chatNewestOnTop,
      activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
    };
  });

  server.post("/overlay/sponsor/visibility", async (request, reply) => {
    const parsedRequest = overlaySponsorVisibilityRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const tokenValidation = await validateUrlAccessToken({
      token: parsedRequest.data.accessToken,
      surface: "control-panel",
      scope: "control:open"
    });

    if (!tokenValidation.valid) {
      reply.code(403);
      return {
        ok: false,
        reason: tokenValidation.reason ?? "control_panel_access_denied"
      };
    }

    const sponsorVisible = overlayRuntime.setSponsorVisible(parsedRequest.data.visible);

    return {
      ok: true,
      sponsorVisible,
      activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
    };
  });

  server.post("/overlay/ai/muted", async (request, reply) => {
    const parsedRequest = overlayAiMutedRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const tokenValidation = await validateUrlAccessToken({
      token: parsedRequest.data.accessToken,
      surface: "control-panel",
      scope: "control:open"
    });

    if (!tokenValidation.valid) {
      reply.code(403);
      return {
        ok: false,
        reason: tokenValidation.reason ?? "control_panel_access_denied"
      };
    }

    const aiMuted = overlayRuntime.setAiMuted(parsedRequest.data.muted);

    return {
      ok: true,
      aiMuted,
      activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
    };
  });

  server.get("/overlay/live", { websocket: true }, async (socket: OverlayLiveSocket, request) => {
    const parsedRequest = overlayStateRequestSchema.safeParse(request.query);

    if (!parsedRequest.success) {
      socket.close(1008, "invalid_request");
      return;
    }

    const tokenValidation = await validateUrlAccessToken({
      token: parsedRequest.data.accessToken,
      surface: "overlay",
      scope: "overlay:connect"
    });

    if (!tokenValidation.valid) {
      socket.close(1008, tokenValidation.reason ?? "overlay_access_denied");
      return;
    }

    const connectionId = randomUUID();
    const snapshot = overlayRuntime.openLiveConnection(connectionId, parsedRequest.data, socket);

    const sendMessage = (message: OverlayLiveMessage): void => {
      socket.send(JSON.stringify(message));
    };
    const sendHeartbeat = (): void => {
      sendMessage({
        type: "overlay.connection.heartbeat",
        payload: {
          id: randomUUID(),
          sentAt: new Date().toISOString()
        }
      });
    };

    server.log.info({ connectionId, scene: snapshot.scene, layout: snapshot.layout }, "Overlay live connection opened.");
    sendMessage({
      type: "overlay.state.snapshot",
      payload: snapshot
    });
    const heartbeatInterval = setInterval(sendHeartbeat, 10_000);

    socket.on("close", () => {
      clearInterval(heartbeatInterval);
      overlayRuntime.closeLiveConnection(connectionId);
      server.log.info({ connectionId }, "Overlay live connection closed.");
    });
  });
};
