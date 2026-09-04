import type { FastifyInstance } from "fastify";

import {
  overlayAiMutedRequestSchema,
  overlayCenterSettingsRequestSchema,
  overlayChatOrderRequestSchema,
  overlayChatVisibilityRequestSchema,
  overlayEmergencyCleanModeRequestSchema,
  overlayGoalStateSchema,
  overlaySponsorVisibilityRequestSchema,
  overlayStateRequestSchema,
  overlayStatusRequestSchema,
  overlayTopBarEnabledRequestSchema,
  type OverlayRouteDependencies
} from "./overlay-route-validation.service.js";
import { registerOverlayLiveRoute } from "./overlay-live.route.js";
import { registerOverlaySceneRoutes } from "./overlay-scenes.route.js";
import { registerOverlayTestRoutes } from "./overlay-test.route.js";

export const registerOverlayRoutes = (
  server: FastifyInstance,
  dependencies: OverlayRouteDependencies
): void => {
  const {
    overlayRuntime,
    requireStreamerChatModerationPermission,
    requireUrlAccessTokenForRequest,
    setStreamerChatEmergencyClearEnabled,
    validateUrlAccessToken
  } = dependencies;

  const requireControlPanelAccess = async (
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

  registerOverlayLiveRoute(server, dependencies);
  registerOverlaySceneRoutes(server, dependencies);

  if (process.env.NODE_ENV !== "production") {
    registerOverlayTestRoutes(server, dependencies);
  }

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

    const tokenValidation = await requireControlPanelAccess(request, parsedRequest.data.accessToken);

    if (!tokenValidation.ok) {
      return applyControlPanelAccessFailure(reply, tokenValidation);
    }

    return {
      ok: true,
      ...overlayRuntime.getStatus(),
      checkedAt: new Date().toISOString()
    };
  });

  if (process.env.NODE_ENV !== "production") {
    server.post("/overlay/goal", async (request, reply) => {
      const parsedRequest = overlayGoalStateSchema.safeParse(request.body);

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
  }

  server.post("/overlay/center/settings", async (request, reply) => {
    const parsedRequest = overlayCenterSettingsRequestSchema.safeParse(request.body);

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

    const tokenValidation = await requireControlPanelAccess(request, parsedRequest.data.accessToken);

    if (!tokenValidation.ok) {
      return applyControlPanelAccessFailure(reply, tokenValidation);
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

    const tokenValidation = await requireControlPanelAccess(request, parsedRequest.data.accessToken);

    if (!tokenValidation.ok) {
      return applyControlPanelAccessFailure(reply, tokenValidation);
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

    const streamerChatClearState = setStreamerChatEmergencyClearEnabled(parsedRequest.data.enabled);
    const emergencyCleanModeEnabled = overlayRuntime.setEmergencyCleanModeEnabled(parsedRequest.data.enabled);

    return {
      ok: true,
      clearedMessageCount: streamerChatClearState.clearedMessageCount,
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

    const tokenValidation = await requireControlPanelAccess(request, parsedRequest.data.accessToken);

    if (!tokenValidation.ok) {
      return applyControlPanelAccessFailure(reply, tokenValidation);
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

    const tokenValidation = await requireControlPanelAccess(request, parsedRequest.data.accessToken);

    if (!tokenValidation.ok) {
      return applyControlPanelAccessFailure(reply, tokenValidation);
    }

    const chatNewestOnTop = overlayRuntime.setChatNewestOnTop(parsedRequest.data.newestOnTop);

    return {
      ok: true,
      chatNewestOnTop,
      activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
    };
  });

  if (process.env.NODE_ENV !== "production") {
    server.post("/overlay/sponsor/visibility", async (request, reply) => {
      const parsedRequest = overlaySponsorVisibilityRequestSchema.safeParse(request.body);

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

      const sponsorVisible = overlayRuntime.setSponsorVisible(parsedRequest.data.visible);

      return {
        ok: true,
        sponsorVisible,
        activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
      };
    });
  }

  server.post("/overlay/ai/muted", async (request, reply) => {
    const parsedRequest = overlayAiMutedRequestSchema.safeParse(request.body);

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

    const aiMuted = overlayRuntime.setAiMuted(parsedRequest.data.muted);

    return {
      ok: true,
      aiMuted,
      activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
    };
  });

};
