import { randomUUID } from "node:crypto";

import type { OverlayLiveMessage } from "@maiks-yt/events";
import type { FastifyInstance } from "fastify";

import type { OverlayLiveSocket } from "./index.js";
import {
  overlayStateRequestSchema,
  type OverlayRouteDependencies
} from "./overlay-route-validation.service.js";

export const registerOverlayLiveRoute = (
  server: FastifyInstance,
  dependencies: Pick<OverlayRouteDependencies, "overlayRuntime" | "validateUrlAccessToken">
): void => {
  const { overlayRuntime, validateUrlAccessToken } = dependencies;

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
