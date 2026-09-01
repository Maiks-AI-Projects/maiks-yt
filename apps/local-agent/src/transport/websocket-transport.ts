import WebSocket, { type RawData } from "ws";
import { LOCAL_AGENT_WEBSOCKET_SUBPROTOCOL } from "@maiks-yt/events";

import type { AgentClientMessage } from "../protocol/agent-protocol.types.js";
import type { OutboundConnector, OutboundSession, TransportClose } from "./outbound-transport.js";

const MAX_MESSAGE_BYTES = 64 * 1_024;

function decodeMessage(data: RawData): unknown {
  const buffer = Array.isArray(data)
    ? Buffer.concat(data)
    : data instanceof ArrayBuffer
      ? Buffer.from(data)
      : data;
  if (buffer.byteLength > MAX_MESSAGE_BYTES) {
    throw new Error("Remote message exceeded the 64 KiB limit");
  }
  return JSON.parse(buffer.toString("utf8"));
}

class WebSocketOutboundSession implements OutboundSession {
  readonly closed: Promise<TransportClose>;
  readonly #socket: WebSocket;
  readonly #listeners = new Set<(message: unknown) => void>();

  constructor(socket: WebSocket) {
    this.#socket = socket;
    this.closed = new Promise((resolve) => {
      socket.once("close", (code, reason) => resolve({ code, reason: reason.toString("utf8") }));
    });
    socket.on("message", (data) => {
      try {
        const message = decodeMessage(data);
        for (const listener of this.#listeners) {
          listener(message);
        }
      } catch (error) {
        console.error("Rejected invalid local-agent server message", error);
      }
    });
    socket.on("error", (error) => {
      console.error("Local-agent WebSocket session failed", error);
    });
  }

  onMessage(listener: (message: unknown) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  send(message: AgentClientMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.#socket.readyState !== WebSocket.OPEN) {
        reject(new Error("Outbound WebSocket is not open"));
        return;
      }
      this.#socket.send(JSON.stringify(message), (error) => error ? reject(error) : resolve());
    });
  }

  async close(): Promise<void> {
    if (this.#socket.readyState === WebSocket.CLOSED) {
      return;
    }
    this.#socket.close(1000, "local-agent shutdown");
    await this.closed;
  }
}

export class WebSocketOutboundConnector implements OutboundConnector {
  readonly #url: URL;
  readonly #credential: string;
  readonly #agentId: string;

  constructor(url: URL, credential: string, agentId: string) {
    this.#url = url;
    this.#credential = credential;
    this.#agentId = agentId;
  }

  connect(signal: AbortSignal): Promise<OutboundSession> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason ?? new Error("Connection aborted"));
        return;
      }
      const socket = new WebSocket(this.#url, LOCAL_AGENT_WEBSOCKET_SUBPROTOCOL, {
        followRedirects: false,
        handshakeTimeout: 10_000,
        maxPayload: MAX_MESSAGE_BYTES,
        headers: {
          Authorization: `Bearer ${this.#credential}`,
          "X-Maiks-Agent-Id": this.#agentId
        }
      });
      const abort = (): void => socket.close(1000, "local-agent shutdown");
      const cleanup = (): void => {
        signal.removeEventListener("abort", abort);
        socket.off("error", fail);
      };
      const fail = (error: Error): void => {
        cleanup();
        reject(error);
      };
      signal.addEventListener("abort", abort, { once: true });
      socket.once("error", fail);
      socket.once("open", () => {
        cleanup();
        resolve(new WebSocketOutboundSession(socket));
      });
    });
  }
}
