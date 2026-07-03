import { randomUUID } from "node:crypto";

import type { RealtimeEvent } from "@maiks-yt/events";
import type { FastifyInstance } from "fastify";

type RealtimeSpikeEvent = {
  type: "realtime.spike.heartbeat" | "realtime.spike.echo";
  payload: {
    connectionId: string;
    id: string;
    sequence: number;
    sentAt: string;
    message: string;
    transport: "sse" | "websocket";
  };
};

interface RealtimeSpikeSocket {
  send: (message: string) => void;
  on(event: "message", listener: (message: { toString(): string }) => void): void;
  on(event: "close", listener: () => void): void;
}

const createRealtimeSpikeEvent = ({
  connectionId,
  sequence,
  transport,
  type = "realtime.spike.heartbeat",
  message = "Realtime spike heartbeat"
}: {
  connectionId: string;
  sequence: number;
  transport: RealtimeSpikeEvent["payload"]["transport"];
  type?: RealtimeSpikeEvent["type"];
  message?: string;
}): RealtimeSpikeEvent => ({
  type,
  payload: {
    connectionId,
    id: randomUUID(),
    sequence,
    sentAt: new Date().toISOString(),
    message,
    transport
  }
});

export const registerRealtimeSpikeRoutes = (server: FastifyInstance): void => {
  server.post<{ Body: RealtimeEvent }>("/events/test", async (request) => ({
    accepted: true,
    eventType: request.body.type
  }));

  server.get("/realtime/spike/sse", async (request, reply) => {
    const connectionId = randomUUID();
    let sequence = 0;

    server.log.info({ connectionId, transport: "sse" }, "Realtime spike connection opened.");
    reply.raw.writeHead(200, {
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
      "content-type": "text/event-stream",
      "x-accel-buffering": "no"
    });
    reply.hijack();

    const sendEvent = (): void => {
      sequence += 1;
      const event = createRealtimeSpikeEvent({
        connectionId,
        sequence,
        transport: "sse"
      });

      server.log.info({ connectionId, eventId: event.payload.id, sequence, transport: "sse" }, "Realtime spike event sent.");
      reply.raw.write(`event: heartbeat\ndata: ${JSON.stringify(event)}\n\n`);
    };

    sendEvent();
    const interval = setInterval(sendEvent, 5_000);

    request.raw.on("close", () => {
      clearInterval(interval);
      server.log.info({ connectionId, sequence, transport: "sse" }, "Realtime spike connection closed.");
      reply.raw.end();
    });
  });

  server.get("/realtime/spike/ws", { websocket: true }, (socket: RealtimeSpikeSocket) => {
    const connectionId = randomUUID();
    let sequence = 0;

    server.log.info({ connectionId, transport: "websocket" }, "Realtime spike connection opened.");
    const sendEvent = (event: RealtimeSpikeEvent): void => {
      server.log.info(
        { connectionId, eventId: event.payload.id, sequence: event.payload.sequence, transport: "websocket" },
        "Realtime spike event sent."
      );
      socket.send(JSON.stringify(event));
    };
    const createNextEvent = (
      type?: RealtimeSpikeEvent["type"],
      message?: string
    ): RealtimeSpikeEvent => {
      sequence += 1;

      return createRealtimeSpikeEvent({
        connectionId,
        sequence,
        transport: "websocket",
        ...(type ? { type } : {}),
        ...(message ? { message } : {})
      });
    };
    const interval = setInterval(() => sendEvent(createNextEvent()), 5_000);

    sendEvent(createNextEvent());

    socket.on("message", (message: { toString(): string }) => {
      server.log.info({ connectionId, transport: "websocket" }, "Realtime spike message received.");
      sendEvent(createNextEvent("realtime.spike.echo", message.toString()));
    });
    socket.on("close", () => {
      clearInterval(interval);
      server.log.info({ connectionId, sequence, transport: "websocket" }, "Realtime spike connection closed.");
    });
  });
};
