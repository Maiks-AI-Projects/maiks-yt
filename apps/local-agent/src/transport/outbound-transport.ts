import type { AgentClientMessage } from "../protocol/agent-protocol.types.js";

export type TransportClose = {
  code: number;
  reason: string;
};

export interface OutboundSession {
  readonly closed: Promise<TransportClose>;
  onMessage(listener: (message: unknown) => void): () => void;
  send(message: AgentClientMessage): Promise<void>;
  close(): Promise<void>;
}

export interface OutboundConnector {
  connect(signal: AbortSignal): Promise<OutboundSession>;
}
