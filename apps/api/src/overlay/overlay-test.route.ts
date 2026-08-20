import { randomUUID } from "node:crypto";

import type { OverlayFakeChatMessageReceivedEvent } from "@maiks-yt/events";
import type { FastifyInstance } from "fastify";

import type { DemoRedeemKey } from "./index.js";
import {
  overlayFakeChatTestRequestSchema,
  overlayLiveAudienceTestRequestSchema,
  overlayNotificationTestRequestSchema,
  overlayRedeemTestRequestSchema,
  overlayTopBarTestRequestSchema,
  type OverlayRouteDependencies
} from "./overlay-route-validation.service.js";

const createFakeChatMessageEvent = ({
  authorKind,
  authorName,
  avatarUrl,
  message,
  parts
}: {
  authorKind: OverlayFakeChatMessageReceivedEvent["payload"]["authorKind"];
  authorName: string;
  avatarUrl?: string;
  message: string;
  parts?: OverlayFakeChatMessageReceivedEvent["payload"]["parts"];
}): OverlayFakeChatMessageReceivedEvent => ({
  type: "overlay.fake-chat.message.received",
  payload: {
    id: randomUUID(),
    authorKind,
    authorName,
    ...(avatarUrl ? { avatarUrl } : {}),
    createdAt: new Date().toISOString(),
    message,
    ...(parts ? { parts } : {}),
    source: "fake-local"
  }
});

export const registerOverlayTestRoutes = (
  server: FastifyInstance,
  dependencies: OverlayRouteDependencies
): void => {
  const {
    fakeLocalModerationRuntime,
    overlayRuntime,
    recordFakeLocalStreamerChatMessage,
    validateUrlAccessToken
  } = dependencies;

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

    const event = createFakeChatMessageEvent({
      authorKind: parsedRequest.data.authorKind,
      authorName: parsedRequest.data.authorName,
      ...(parsedRequest.data.avatarUrl ? { avatarUrl: parsedRequest.data.avatarUrl } : {}),
      message: parsedRequest.data.message
    });
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

  server.post("/overlay/live-audience/test", async (request, reply) => {
    const parsedRequest = overlayLiveAudienceTestRequestSchema.safeParse(request.body);

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

    const chatEvent = createFakeChatMessageEvent({
      authorKind: "human",
      authorName: parsedRequest.data.actorName,
      ...(parsedRequest.data.avatarUrl ? { avatarUrl: parsedRequest.data.avatarUrl } : {}),
      message: parsedRequest.data.message,
      ...(parsedRequest.data.parts ? { parts: parsedRequest.data.parts } : {})
    });
    const streamerChatMessage = recordFakeLocalStreamerChatMessage(chatEvent);

    if (!streamerChatMessage) {
      return {
        ok: true,
        queued: 0,
        reason: "streamer_chat_actor_banned",
        streamerChatMessage: null,
        activeOverlayConnections: overlayRuntime.getActiveConnectionCount()
      };
    }

    const topBarEvent = {
      type: "overlay.top-bar-notification.queued" as const,
      payload: {
        id: randomUUID(),
        actorName: parsedRequest.data.actorName,
        actionLabel: parsedRequest.data.actionLabel,
        avatarUrl: parsedRequest.data.avatarUrl ?? "",
        createdAt: new Date().toISOString(),
        kind: parsedRequest.data.kind,
        platform: parsedRequest.data.platform,
        priority: parsedRequest.data.priority
      }
    };

    overlayRuntime.broadcastMessage(chatEvent);
    overlayRuntime.broadcastMessage(topBarEvent);

    return {
      ok: true,
      queued: 2,
      streamerChatMessage,
      topBarEvent,
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
};
