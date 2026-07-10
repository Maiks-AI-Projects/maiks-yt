import { randomUUID } from "node:crypto";

import type {
  DiscordGatewayEventProjectionInput,
  DiscordGatewayEventProjectionResult,
  DiscordChatProjectionInput,
  DiscordChatProjectionResult
} from "./discord-chat-intake.types.js";

const maxAuthorNameLength = 40;
const maxChannelNameLength = 80;
const maxMessageLength = 500;

const stripControlCharacters = (value: string): string =>
  value.replace(/[\u0000-\u001F\u007F]/g, " ");

const normalizeText = (value: string, maxLength: number): string =>
  stripControlCharacters(value).replace(/\s+/g, " ").trim().slice(0, maxLength).trim();

const normalizeId = (value: string | undefined): string => normalizeText(value ?? "", 80);
const normalizeEventName = (value: string | undefined): string =>
  normalizeText(value ?? "", 191).toUpperCase();

const getStringField = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? normalizeId(value) : null;
};

const getNestedRecord = (record: Record<string, unknown>, key: string): Record<string, unknown> | null => {
  const value = record[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
};

const resolveDiscordActor = (
  data: Record<string, unknown>
): { actorDisplayName: string | null; actorExternalId: string | null } => {
  const directUser = getNestedRecord(data, "user");
  const author = getNestedRecord(data, "author");
  const member = getNestedRecord(data, "member");
  const memberUser = member ? getNestedRecord(member, "user") : null;
  const actor = directUser ?? author ?? memberUser;
  const actorExternalId = actor ? getStringField(actor, "id") : null;
  const displayName = member ? getStringField(member, "nick") : null;
  const globalName = actor ? getStringField(actor, "global_name") : null;
  const username = actor ? getStringField(actor, "username") : null;

  return {
    actorDisplayName: displayName ?? globalName ?? username,
    actorExternalId
  };
};

const buildSourceEventId = (
  providerEventName: string,
  data: Record<string, unknown>,
  sequence: number | null | undefined,
  receivedAt: Date
): string => {
  const stableId = getStringField(data, "id")
    ?? getStringField(data, "message_id")
    ?? getStringField(data, "target_id")
    ?? getStringField(data, "user_id")
    ?? getStringField(data, "role_id");
  const suffix = stableId ?? (typeof sequence === "number" ? `seq-${sequence}` : receivedAt.toISOString());

  return `discord-gateway:${providerEventName}:${suffix}`.slice(0, 191);
};

export const resolveDiscordChatGuildId = (env: Record<string, string | undefined>): string =>
  normalizeId(env.DISCORD_CHAT_GUILD_ID ?? env.DISCORD_GUILD_ID);

export const resolveDiscordChatChannelIds = (env: Record<string, string | undefined>): readonly string[] => {
  const configured = env.DISCORD_CHAT_CHANNEL_IDS ?? env.DISCORD_CHAT_CHANNEL_ID ?? env.DISCORD_CHANNEL_ID ?? "";

  return configured
    .split(",")
    .map((value) => normalizeId(value))
    .filter((value) => value.length > 0);
};

export const projectDiscordChatMessage = (
  input: DiscordChatProjectionInput
): DiscordChatProjectionResult => {
  const guildId = normalizeId(input.guildId);
  const channelId = normalizeId(input.channelId);
  const userId = normalizeId(input.authorUserId);
  const channelName = normalizeText(input.channelName ?? channelId, maxChannelNameLength);
  const authorName = normalizeText(input.authorDisplayName || input.authorUsername, maxAuthorNameLength);
  const message = normalizeText(input.text, maxMessageLength);

  if (!guildId) {
    return {
      ok: false,
      reason: "empty_guild"
    };
  }

  if (!channelId || !channelName) {
    return {
      ok: false,
      reason: "empty_channel"
    };
  }

  if (!authorName) {
    return {
      ok: false,
      reason: "empty_author"
    };
  }

  if (!userId) {
    return {
      ok: false,
      reason: "empty_author"
    };
  }

  if (!message) {
    return {
      ok: false,
      reason: "empty_message"
    };
  }

  return {
    ok: true,
    message: {
      id: randomUUID(),
      authorKind: "human",
      authorName,
      channelId,
      channelName,
      createdAt: (input.createdAt ?? new Date()).toISOString(),
      guildId,
      message,
      providerMessageId: normalizeId(input.messageId) || randomUUID(),
      userId,
      source: "discord",
      visibleOnOverlayByDefault: false
    }
  };
};

export const projectDiscordGatewayEvent = (
  input: DiscordGatewayEventProjectionInput
): DiscordGatewayEventProjectionResult => {
  const providerEventName = normalizeEventName(input.providerEventName);
  const configuredGuildId = normalizeId(input.guildId);
  const eventGuildId = getStringField(input.data, "guild_id") ?? configuredGuildId;
  const receivedAt = input.receivedAt ?? new Date();

  if (!providerEventName) {
    return {
      ok: false,
      reason: "empty_event"
    };
  }

  if (!configuredGuildId) {
    return {
      ok: false,
      reason: "empty_guild"
    };
  }

  if (eventGuildId !== configuredGuildId) {
    return {
      ok: false,
      reason: "wrong_guild"
    };
  }

  if (providerEventName === "MESSAGE_CREATE") {
    return {
      ok: false,
      reason: "chat_message_create"
    };
  }

  const actor = resolveDiscordActor(input.data);

  return {
    ok: true,
    event: {
      actorDisplayName: actor.actorDisplayName,
      actorExternalId: actor.actorExternalId,
      channelId: getStringField(input.data, "channel_id"),
      guildId: eventGuildId,
      messageId: getStringField(input.data, "message_id") ?? getStringField(input.data, "id"),
      occurredAt: receivedAt.toISOString(),
      providerEventName,
      redactedPayload: {
        channelId: getStringField(input.data, "channel_id"),
        guildId: eventGuildId,
        providerEventName,
        sequence: input.sequence ?? null,
        summary: input.data
      },
      source: "discord",
      sourceEventId: buildSourceEventId(providerEventName, input.data, input.sequence, receivedAt)
    }
  };
};
