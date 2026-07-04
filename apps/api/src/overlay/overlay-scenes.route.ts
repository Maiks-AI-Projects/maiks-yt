import { overlaySceneSlotIds } from "@maiks-yt/themes";
import type { FastifyInstance } from "fastify";

import {
  overlayPresentationStateRequestSchema,
  overlaySceneListRequestSchema,
  overlaySceneSaveRequestSchema,
  type OverlayRouteDependencies
} from "./overlay-route-validation.service.js";

export const registerOverlaySceneRoutes = (
  server: FastifyInstance,
  dependencies: Pick<OverlayRouteDependencies, "overlayRuntime" | "validateUrlAccessToken">
): void => {
  const { overlayRuntime, validateUrlAccessToken } = dependencies;

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
};
