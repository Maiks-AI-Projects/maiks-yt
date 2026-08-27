import { randomUUID } from "node:crypto";

import { LOCAL_AGENT_PROTOCOL_VERSION } from "@maiks-yt/events";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  readBearerCredential,
  type LocalAgentServerConfig,
  validateLocalAgentCredential
} from "./local-agent-auth.service.js";
import type {
  LocalAgentConnection,
  LocalAgentRuntimeService
} from "./local-agent-runtime.service.js";

const identifierSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9._:-]+$/);
const timestampSchema = z.iso.datetime({ offset: true });
const identitySchema = z.object({
  agentId: identifierSchema,
  deviceId: identifierSchema,
  protocolVersion: z.literal(LOCAL_AGENT_PROTOCOL_VERSION),
  serviceVersion: z.string().trim().min(1).max(64)
}).strict();
const moduleStatusSchema = z.object({
  capabilityId: identifierSchema,
  availability: z.enum(["available", "degraded", "unavailable"]),
  detail: z.string().trim().min(1).max(240).optional(),
  state: z.json().optional()
}).strict();
const agentStatusSchema = z.object({
  startedAt: timestampSchema,
  observedAt: timestampSchema,
  modules: z.array(moduleStatusSchema).max(32)
}).strict();
const capabilitySchema = z.object({
  id: identifierSchema,
  version: z.number().int().positive(),
  actions: z.array(identifierSchema).max(64),
  availability: z.enum(["available", "degraded", "unavailable"]),
  detail: z.string().trim().min(1).max(240).optional()
}).strict();
const acknowledgementSchema = z.object({
  eventId: identifierSchema,
  commandId: identifierSchema,
  status: z.enum(["received", "succeeded", "failed", "rejected", "expired"]),
  acknowledgedAt: timestampSchema,
  replayed: z.boolean(),
  result: z.json().optional(),
  error: z.object({
    code: identifierSchema,
    message: z.string().trim().min(1).max(500),
    retriable: z.boolean()
  }).strict().optional()
}).strict();
const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("register"),
    identity: identitySchema,
    capabilities: z.array(capabilitySchema).max(32),
    status: agentStatusSchema
  }).strict(),
  z.object({
    type: z.literal("heartbeat"),
    identity: identitySchema,
    status: agentStatusSchema
  }).strict(),
  z.object({
    type: z.literal("acknowledgement"),
    identity: identitySchema,
    acknowledgement: acknowledgementSchema
  }).strict()
]);

type LocalAgentSocket = LocalAgentConnection & {
  on(event: "close", listener: () => void): void;
  on(event: "message", listener: (data: { toString(): string }) => void): void;
};

const maxMessageBytes = 64 * 1_024;

export const registerLocalAgentRoutes = (
  server: FastifyInstance,
  dependencies: {
    config: LocalAgentServerConfig;
    runtime: LocalAgentRuntimeService;
  }
): void => {
  server.get("/local-agent/live", { websocket: true }, (socket: LocalAgentSocket, request) => {
    const credential = readBearerCredential(request.headers.authorization);
    if (!dependencies.config.configured
      || !validateLocalAgentCredential(dependencies.config.token, credential)) {
      socket.close(1008, "local_agent_access_denied");
      return;
    }

    let connectionId: string | null = null;
    let registered = false;
    const handshakeTimer = setTimeout(() => {
      if (!registered) {
        socket.close(1008, "registration_timeout");
      }
    }, 5_000);

    socket.on("close", () => {
      clearTimeout(handshakeTimer);
      if (connectionId) {
        dependencies.runtime.close(connectionId);
      }
    });
    socket.on("message", (data) => {
      const raw = data.toString();
      if (Buffer.byteLength(raw, "utf8") > maxMessageBytes) {
        socket.close(1009, "message_too_large");
        return;
      }

      try {
        const message = clientMessageSchema.parse(JSON.parse(raw));
        if (message.identity.agentId !== dependencies.config.expectedAgentId
          || message.identity.deviceId !== dependencies.config.expectedDeviceId) {
          socket.close(1008, "local_agent_identity_mismatch");
          return;
        }

        if (!registered) {
          if (message.type !== "register") {
            socket.close(1008, "registration_required");
            return;
          }
          const registration = dependencies.runtime.register({
            capabilities: message.capabilities,
            identity: message.identity,
            socket,
            status: message.status
          });
          registered = true;
          connectionId = registration.connectionId;
          clearTimeout(handshakeTimer);
          socket.send(JSON.stringify({
            type: "registered",
            connectionId: registration.connectionId,
            serverTime: registration.serverTime
          }));
          return;
        }

        const accepted = message.type === "heartbeat"
          ? dependencies.runtime.heartbeat(message)
          : message.type === "acknowledgement"
            ? dependencies.runtime.acknowledge(message)
            : false;
        if (!accepted) {
          socket.close(1008, "local_agent_message_rejected");
        }
      } catch (error) {
        server.log.warn({ err: error, eventId: randomUUID() }, "Local-agent message rejected.");
        socket.close(1008, "invalid_message");
      }
    });
  });
};
