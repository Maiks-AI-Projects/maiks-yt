import { randomUUID } from "node:crypto";

import type { UrlAccessSurface } from "@maiks-yt/domain/security";
import type { OverlayFakeChatMessageReceivedEvent, OverlayLiveMessage, StreamerChatMessage } from "@maiks-yt/events";
import { overlaySceneSlotIds } from "@maiks-yt/themes";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import type { DemoRedeemKey, OverlayLiveSocket, OverlayRuntime } from "./index.js";
import type { StreamerChatModerationAction } from "../streamer-chat/index.js";

const overlaySceneKeySchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,47}$/);
const overlayThemeKeySchema = z.enum(["default", "satisfactory"]);
const overlayStateRequestSchema = z.object({
  accessToken: z.string().min(24),
  scene: overlaySceneKeySchema.default("default"),
  layout: z.enum(["standard", "camera-left", "camera-right", "clean"]).default("standard"),
  theme: overlayThemeKeySchema.default("default"),
  mode: z.enum(["normal", "clean"]).default("normal")
});
const overlayStatusRequestSchema = z.object({
  accessToken: z.string().min(24)
});
const overlayPresentationStateRequestSchema = z.object({
  accessToken: z.string().min(24),
  scene: overlaySceneKeySchema,
  layout: z.enum(["standard", "camera-left", "camera-right", "clean"]),
  theme: overlayThemeKeySchema
});
const overlayTopBarTestRequestSchema = z.object({
  accessToken: z.string().min(24),
  count: z.number().int().min(1).max(6).default(1)
});
const overlayTopBarEnabledRequestSchema = z.object({
  accessToken: z.string().min(24),
  enabled: z.boolean()
});
const overlayEmergencyCleanModeRequestSchema = z.object({
  accessToken: z.string().min(24),
  enabled: z.boolean()
});
const overlayChatVisibilityRequestSchema = z.object({
  accessToken: z.string().min(24),
  visible: z.boolean()
});
const overlayChatOrderRequestSchema = z.object({
  accessToken: z.string().min(24),
  newestOnTop: z.boolean()
});
const overlayFakeChatTestRequestSchema = z.object({
  accessToken: z.string().min(24),
  authorName: z.string().trim().min(1).max(40).default("Test chatter"),
  authorKind: z.enum(["human", "bot", "system"]).default("human"),
  message: z.string().trim().min(1).max(280)
});
const overlaySponsorVisibilityRequestSchema = z.object({
  accessToken: z.string().min(24),
  visible: z.boolean()
});
const overlayAiMutedRequestSchema = z.object({
  accessToken: z.string().min(24),
  muted: z.boolean()
});
const overlayCenterSettingsRequestSchema = z.object({
  accessToken: z.string().min(24),
  enabled: z.boolean(),
  onscreenMs: z.number().int().min(1_000).max(20_000),
  fadeOutMs: z.number().int().min(100).max(5_000),
  restMs: z.number().int().min(0).max(10_000)
});
const overlayNotificationTestRequestSchema = z.object({
  accessToken: z.string().min(24),
  route: z.enum(["top", "center"]),
  afterCenter: z.enum(["top", "none"]).default("top"),
  count: z.number().int().min(1).max(6).default(1)
});
const overlayRedeemTestRequestSchema = z.object({
  accessToken: z.string().min(24),
  redeem: z.enum(["hydrate", "jumpscare", "mime"])
});
const overlayGoalStateSchema = z.object({
  accessToken: z.string().min(24),
  enabled: z.boolean(),
  label: z.string().trim().min(1).max(80),
  currentAmount: z.number().min(0).max(1_000_000),
  targetAmount: z.number().positive().max(1_000_000),
  currencyCode: z.string().trim().regex(/^[A-Z]{3}$/)
}).refine((value) => value.currentAmount <= value.targetAmount, {
  message: "current_amount_cannot_exceed_target",
  path: ["currentAmount"]
});
const overlaySceneListRequestSchema = z.object({
  accessToken: z.string().min(24)
});
const overlaySceneSlotSchema = z.object({
  x: z.number().int().min(0).max(1920),
  y: z.number().int().min(0).max(1080),
  width: z.number().int().min(0).max(1920),
  height: z.number().int().min(0).max(1080),
  visible: z.boolean(),
  lockedAspectRatio: z.number().positive().optional()
});
const overlaySceneSaveRequestSchema = z.object({
  accessToken: z.string().min(24),
  scene: z.object({
    themeKey: overlayThemeKeySchema,
    sceneKey: overlaySceneKeySchema,
    label: z.string().min(1).max(80),
    canvas: z.object({
      width: z.literal(1920),
      height: z.literal(1080)
    }),
    slots: z.record(z.enum(overlaySceneSlotIds), overlaySceneSlotSchema)
  })
});

type UrlAccessTokenValidation = {
  valid: boolean;
  requiresLogin: boolean;
  reason?: string;
};

type ValidateUrlAccessToken = (input: {
  scope: string;
  surface: UrlAccessSurface;
  token: string;
}) => Promise<UrlAccessTokenValidation>;

type RequireStreamerChatModerationPermission = (
  request: FastifyRequest,
  accessToken: string,
  action: StreamerChatModerationAction
) => Promise<{ ok: true } | { ok: false; reason: string; statusCode: 401 | 403 }>;

type FakeLocalModerationRuntime = {
  isAuthorMuted(authorName: string): { authorName: string; mutedUntil: string } | null;
};

export type OverlayRouteDependencies = {
  fakeLocalModerationRuntime: FakeLocalModerationRuntime;
  overlayRuntime: OverlayRuntime;
  recordFakeLocalStreamerChatMessage: (event: OverlayFakeChatMessageReceivedEvent) => StreamerChatMessage | null;
  requireStreamerChatModerationPermission: RequireStreamerChatModerationPermission;
  validateUrlAccessToken: ValidateUrlAccessToken;
};

const createFakeChatMessageEvent = ({
  authorKind,
  authorName,
  message
}: {
  authorKind: OverlayFakeChatMessageReceivedEvent["payload"]["authorKind"];
  authorName: string;
  message: string;
}): OverlayFakeChatMessageReceivedEvent => ({
  type: "overlay.fake-chat.message.received",
  payload: {
    id: randomUUID(),
    authorKind,
    authorName,
    createdAt: new Date().toISOString(),
    message,
    source: "fake-local"
  }
});

export const registerOverlayRoutes = (
  server: FastifyInstance,
  dependencies: OverlayRouteDependencies
): void => {
  const {
    fakeLocalModerationRuntime,
    overlayRuntime,
    recordFakeLocalStreamerChatMessage,
    requireStreamerChatModerationPermission,
    validateUrlAccessToken
  } = dependencies;

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

  server.post("/overlay/chat/test", async (request, reply) => {
    const parsedRequest = overlayFakeChatTestRequestSchema.safeParse(request.body);

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

    const event = createFakeChatMessageEvent(parsedRequest.data);
    const mutedAuthor = fakeLocalModerationRuntime.isAuthorMuted(event.payload.authorName);

    if (mutedAuthor) {
      return {
        ok: true,
        queued: 0,
        reason: "fake_local_author_muted",
        mutedUntil: mutedAuthor.mutedUntil,
        chatVisible: overlayRuntime.getChatVisible(),
        streamerChatMessage: null,
        event: null,
        activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
      };
    }

    const streamerChatMessage = recordFakeLocalStreamerChatMessage(event);

    if (!streamerChatMessage) {
      return {
        ok: true,
        queued: 0,
        reason: "streamer_chat_actor_banned",
        chatVisible: overlayRuntime.getChatVisible(),
        streamerChatMessage: null,
        event: null,
        activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
      };
    }

    overlayRuntime.broadcastMessage(event);

    return {
      ok: true,
      queued: 1,
      chatVisible: overlayRuntime.getChatVisible(),
      streamerChatMessage,
      event,
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

  server.post("/overlay/top-bar/test", async (request, reply) => {
    const parsedRequest = overlayTopBarTestRequestSchema.safeParse(request.body);

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

    for (let index = 0; index < parsedRequest.data.count; index += 1) {
      setTimeout(() => {
        overlayRuntime.broadcastMessage(overlayRuntime.createDemoTopBarNotification(index));
      }, index * 500);
    }

    return {
      ok: true,
      queued: parsedRequest.data.count,
      activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
    };
  });

  server.post("/overlay/notification/test", async (request, reply) => {
    const parsedRequest = overlayNotificationTestRequestSchema.safeParse(request.body);

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

    if (parsedRequest.data.route === "center" && !overlayRuntime.isCenterEnabled()) {
      return {
        ok: true,
        queued: 0,
        route: "center",
        reason: "center_notifications_disabled",
        activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
      };
    }

    const route = parsedRequest.data.route;

    for (let index = 0; index < parsedRequest.data.count; index += 1) {
      setTimeout(() => {
        overlayRuntime.broadcastMessage(overlayRuntime.createDemoRoutedNotification(index, route, parsedRequest.data.afterCenter));
      }, index * 500);
    }

    return {
      ok: true,
      queued: parsedRequest.data.count,
      route,
      activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
    };
  });

  server.post("/overlay/redeem/test", async (request, reply) => {
    const parsedRequest = overlayRedeemTestRequestSchema.safeParse(request.body);

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

    if (!overlayRuntime.isCenterEnabled()) {
      return {
        ok: true,
        queued: 0,
        redeem: parsedRequest.data.redeem,
        reason: "center_notifications_disabled",
        activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
      };
    }

    overlayRuntime.broadcastMessage(overlayRuntime.createRedeemNotification(parsedRequest.data.redeem as DemoRedeemKey));

    return {
      ok: true,
      queued: 1,
      redeem: parsedRequest.data.redeem,
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
