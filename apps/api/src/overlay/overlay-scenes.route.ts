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
  dependencies: Pick<OverlayRouteDependencies, "overlayRuntime" | "requireUrlAccessTokenForRequest">
): void => {
  const { overlayRuntime, requireUrlAccessTokenForRequest } = dependencies;
  const requireControlPanelAccess = (
    request: Parameters<typeof requireUrlAccessTokenForRequest>[0],
    accessToken: string
  ) =>
    requireUrlAccessTokenForRequest(request, {
      deniedReason: "control_panel_access_denied",
      token: accessToken,
      surface: "control-panel",
      scope: "control:open",
      userUnlinkedReason: "control_panel_user_unlinked"
    });
  const applyControlPanelAccessFailure = (
    reply: { code: (statusCode: number) => void },
    failure: { statusCode: 401 | 403; reason: string }
  ): { ok: false; reason: string } => {
    reply.code(failure.statusCode);
    return {
      ok: false,
      reason: failure.reason
    };
  };

  server.post("/overlay/presentation-state", async (request, reply) => {
    const parsedRequest = overlayPresentationStateRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const tokenValidation = await requireControlPanelAccess(request, parsedRequest.data.accessToken);

    if (!tokenValidation.ok) {
      return applyControlPanelAccessFailure(reply, tokenValidation);
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

    const tokenValidation = await requireControlPanelAccess(request, parsedRequest.data.accessToken);

    if (!tokenValidation.ok) {
      return applyControlPanelAccessFailure(reply, tokenValidation);
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

    const tokenValidation = await requireControlPanelAccess(request, parsedRequest.data.accessToken);

    if (!tokenValidation.ok) {
      return applyControlPanelAccessFailure(reply, tokenValidation);
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
