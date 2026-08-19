import { randomUUID } from "node:crypto";

import { obsWidgetBridgeProtocolVersion } from "@maiks-yt/events";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { ObsWidgetBridgeRuntime, ObsWidgetBridgeSocket } from "./obs-widget-bridge-runtime.service.js";

const bridgeQuerySchema = z.object({
  protocolVersion: z.coerce.number().int().positive()
});
const bridgeStatusQuerySchema = z.object({
  accessToken: z.string().min(24)
});

const widgetKindSchema = z.enum(["alerts-effects", "chat", "sponsor", "stream-goal"]);
const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("obs.bridge.hello"),
    payload: z.object({
      protocolVersion: z.literal(obsWidgetBridgeProtocolVersion),
      installationId: z.string().trim().min(8).max(191),
      clientVersion: z.string().trim().min(1).max(64),
      supportedWidgets: z.array(widgetKindSchema).max(16),
      readyWidgets: z.array(widgetKindSchema).max(16)
    })
  }),
  z.object({
    type: z.literal("obs.bridge.capabilities.update"),
    payload: z.object({
      readyWidgets: z.array(widgetKindSchema).max(16)
    })
  }),
  z.object({
    type: z.literal("obs.effect.ack"),
    payload: z.object({
      deliveryId: z.string().uuid(),
      status: z.enum(["started", "completed", "failed"]),
      acknowledgedAt: z.iso.datetime()
    })
  })
]);

type ValidateUrlAccessToken = (input: {
  scope: string;
  surface: "control-panel" | "overlay";
  token: string;
}) => Promise<{ valid: boolean; reason?: string }>;

const readBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();

  return token.length >= 24 ? token : null;
};

export const registerObsWidgetBridgeRoute = (
  server: FastifyInstance,
  dependencies: {
    runtime: ObsWidgetBridgeRuntime;
    validateUrlAccessToken: ValidateUrlAccessToken;
  }
): void => {
  server.get("/obs-bridge/status", async (request, reply) => {
    const parsedRequest = bridgeStatusQuerySchema.safeParse(request.query);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request"
      };
    }

    const tokenValidation = await dependencies.validateUrlAccessToken({
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
      protocolVersion: obsWidgetBridgeProtocolVersion,
      ...dependencies.runtime.getStatus(),
      checkedAt: new Date().toISOString()
    };
  });

  server.get("/obs-bridge/live", { websocket: true }, async (socket: ObsWidgetBridgeSocket & {
    on(event: "close", listener: () => void): void;
    on(event: "message", listener: (data: { toString(): string }) => void): void;
  }, request) => {
    const parsedQuery = bridgeQuerySchema.safeParse(request.query);
    const token = readBearerToken(request.headers.authorization);

    if (!parsedQuery.success || !token) {
      socket.close(1008, "invalid_request");
      return;
    }

    if (parsedQuery.data.protocolVersion !== obsWidgetBridgeProtocolVersion) {
      socket.send(JSON.stringify({
        type: "obs.bridge.error",
        payload: {
          code: "unsupported_protocol",
          message: `Protocol ${String(parsedQuery.data.protocolVersion)} is not supported.`
        }
      }));
      socket.close(1008, "unsupported_protocol");
      return;
    }

    const pendingMessages: string[] = [];
    let processMessage: ((rawMessage: string) => void) | null = null;
    let connectionId: string | null = null;
    let handshakeTimer: NodeJS.Timeout | null = null;
    let heartbeatTimer: NodeJS.Timeout | null = null;
    let closed = false;

    socket.on("message", (data) => {
      const rawMessage = data.toString();

      if (Buffer.byteLength(rawMessage, "utf8") > 64 * 1_024) {
        socket.close(1009, "message_too_large");
        return;
      }

      if (processMessage) {
        processMessage(rawMessage);
        return;
      }

      if (pendingMessages.length >= 4) {
        socket.close(1008, "too_many_pre_auth_messages");
        return;
      }

      pendingMessages.push(rawMessage);
    });
    socket.on("close", () => {
      closed = true;

      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      if (handshakeTimer) {
        clearTimeout(handshakeTimer);
      }
      if (connectionId) {
        dependencies.runtime.closeConnection(connectionId);
      }
    });

    const tokenValidation = await dependencies.validateUrlAccessToken({
      token,
      surface: "overlay",
      scope: "overlay:connect"
    });

    if (!tokenValidation.valid) {
      socket.close(1008, tokenValidation.reason ?? "obs_bridge_access_denied");
      return;
    }

    if (closed) {
      return;
    }

    connectionId = randomUUID();
    const activeConnectionId = connectionId;
    let handshakeComplete = false;
    handshakeTimer = setTimeout(() => {
      if (!handshakeComplete) {
        socket.close(1008, "hello_timeout");
      }
    }, 10_000);
    heartbeatTimer = setInterval(() => {
      if (handshakeComplete) {
        dependencies.runtime.sendHeartbeat();
      }
    }, 10_000);

    processMessage = (serializedMessage) => {
      let rawMessage: unknown;

      try {
        rawMessage = JSON.parse(serializedMessage);
      } catch {
        socket.close(1008, "invalid_message");
        return;
      }

      const parsedMessage = clientMessageSchema.safeParse(rawMessage);

      if (!parsedMessage.success) {
        socket.close(1008, "invalid_message");
        return;
      }

      if (parsedMessage.data.type === "obs.bridge.hello") {
        if (handshakeComplete) {
          socket.close(1008, "duplicate_hello");
          return;
        }

        handshakeComplete = true;
        if (handshakeTimer) {
          clearTimeout(handshakeTimer);
          handshakeTimer = null;
        }
        dependencies.runtime.openConnection(activeConnectionId, parsedMessage.data.payload, socket);
        return;
      }

      if (!handshakeComplete) {
        socket.close(1008, "hello_required");
        return;
      }

      if (parsedMessage.data.type === "obs.bridge.capabilities.update") {
        dependencies.runtime.updateCapabilities(activeConnectionId, parsedMessage.data.payload);
        return;
      }

      dependencies.runtime.acknowledgeEffect(activeConnectionId, parsedMessage.data.payload);
    };

    for (const pendingMessage of pendingMessages.splice(0)) {
      processMessage(pendingMessage);
    }
  });
};
