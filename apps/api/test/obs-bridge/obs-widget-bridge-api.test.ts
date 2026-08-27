import fastifyWebsocket from "@fastify/websocket";
import Fastify from "fastify";
import WebSocket from "ws";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ObsWidgetBridgeRuntime,
  registerObsWidgetBridgeRoute
} from "../../src/obs-bridge/index.js";
import { OverlayRuntime } from "../../src/overlay/index.js";

describe("OBS widget bridge API", () => {
  let server: ReturnType<typeof Fastify>;
  let overlayTokenValidationDelayMs: number;
  let controlStatusAuthenticated: boolean;
  const validToken = "a".repeat(32);

  beforeEach(async () => {
    server = Fastify();
    overlayTokenValidationDelayMs = 0;
    controlStatusAuthenticated = true;
    const overlayRuntime = new OverlayRuntime();
    const runtime = new ObsWidgetBridgeRuntime({
      createOverlaySnapshot: () => overlayRuntime.createSnapshotFromRequestedState({
        scene: "default",
        layout: "standard",
        theme: "default",
        mode: "normal"
      }),
      listChatMessages: () => []
    });

    await server.register(fastifyWebsocket);
    registerObsWidgetBridgeRoute(server, {
      requireUrlAccessTokenForRequest: async (_request, { token, surface, scope, deniedReason }) => {
        if (token === validToken && surface === "control-panel" && scope === "control:open") {
          if (!controlStatusAuthenticated) {
            return {
              ok: false,
              statusCode: 401,
              reason: "not_authenticated"
            };
          }

          return {
            ok: true,
            requiresLogin: true,
            session: { user: { id: "auth-owner" }, session: { userId: "auth-owner" } },
            user: {
              id: "owner-user",
              displayName: "Owner",
              profileVisibility: "private",
              avatarUrl: null
            }
          };
        }

        return {
          ok: false,
          statusCode: 403,
          reason: deniedReason
        };
      },
      runtime,
      validateUrlAccessToken: async ({ token, surface, scope }) => {
        if (surface === "overlay" && overlayTokenValidationDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, overlayTokenValidationDelayMs));
        }

        return {
          valid: token === validToken && (
            (surface === "control-panel" && scope === "control:open")
            || (surface === "overlay" && scope === "overlay:connect")
          )
        };
      }
    });
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
  });

  it("rejects status reads without a valid control token", async () => {
    const response = await server.inject({
      method: "GET",
      url: `/obs-bridge/status?accessToken=${"b".repeat(32)}`
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      ok: false,
      reason: "control_panel_access_denied"
    });
  });

  it("reports protocol and fallback ownership with a valid control token", async () => {
    const response = await server.inject({
      method: "GET",
      url: `/obs-bridge/status?accessToken=${validToken}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      protocolVersion: 1,
      connected: false,
      effectDelivery: "master-overlay",
      pendingEffects: 0
    });
  });

  it("rejects status reads when a valid control token has no authenticated session", async () => {
    controlStatusAuthenticated = false;

    const response = await server.inject({
      method: "GET",
      url: `/obs-bridge/status?accessToken=${validToken}`
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      reason: "not_authenticated"
    });
  });

  it("buffers an immediate client hello while overlay-token validation is in flight", async () => {
    overlayTokenValidationDelayMs = 50;
    const address = await server.listen({ host: "127.0.0.1", port: 0 });
    const socket = new WebSocket(
      `${address.replace("http://", "ws://")}/obs-bridge/live?protocolVersion=1`,
      {
        headers: {
          Authorization: `Bearer ${validToken}`
        }
      }
    );
    const bridgeReady = new Promise<Record<string, unknown>>((resolve, reject) => {
      const messages = new Map<string, Record<string, unknown>>();
      const timeout = setTimeout(() => reject(new Error("Timed out waiting for OBS bridge handshake")), 2_000);

      socket.on("message", (rawMessage) => {
        const message = JSON.parse(rawMessage.toString()) as Record<string, unknown>;
        const messageType = typeof message.type === "string" ? message.type : "unknown";
        messages.set(messageType, message);

        if (
          messages.has("obs.bridge.welcome")
          && messages.has("obs.widget.state.snapshot")
        ) {
          clearTimeout(timeout);
          resolve(messages.get("obs.bridge.welcome")!);
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });
    socket.send(JSON.stringify({
      type: "obs.bridge.hello",
      payload: {
        protocolVersion: 1,
        installationId: "test-installation",
        clientVersion: "test-client",
        supportedWidgets: ["chat", "alerts-effects"],
        readyWidgets: ["chat"]
      }
    }));

    await expect(bridgeReady).resolves.toMatchObject({
      type: "obs.bridge.welcome",
      payload: {
        protocolVersion: 1,
        effectDelivery: "master-overlay"
      }
    });

    socket.close();
    await new Promise<void>((resolve) => socket.once("close", () => resolve()));
  });
});
