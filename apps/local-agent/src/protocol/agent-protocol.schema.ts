import { z } from "zod";
import type { AgentServerMessage } from "./agent-protocol.types.js";

const identifierSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9._:-]+$/);
const timestampSchema = z.iso.datetime({ offset: true });

const registeredMessageSchema = z.object({
  type: z.literal("registered"),
  connectionId: identifierSchema,
  serverTime: timestampSchema
}).strict();

const commandEnvelopeSchema = z.object({
  type: z.literal("command"),
  eventId: identifierSchema,
  commandId: identifierSchema,
  issuedAt: timestampSchema,
  expiresAt: timestampSchema.optional(),
  capability: identifierSchema,
  action: identifierSchema,
  payload: z.unknown()
}).strict();

const agentServerMessageSchema = z.discriminatedUnion("type", [
  registeredMessageSchema,
  commandEnvelopeSchema
]);

export function parseAgentServerMessage(value: unknown): AgentServerMessage {
  return agentServerMessageSchema.parse(value);
}
