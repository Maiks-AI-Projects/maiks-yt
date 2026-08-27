import type { FastifyInstance } from "fastify";
import type {
  DiscordChatWarningDeliveryResult,
  DiscordChatWarningDeliveryService,
  DiscordChatModerationService,
  ProviderChatModerationResult,
  TwitchChatWarningDeliveryResult,
  TwitchChatWarningDeliveryService,
  TwitchChatModerationService,
  YouTubeChatWarningDeliveryResult,
  YouTubeChatWarningDeliveryService
} from "@maiks-yt/integrations";
import { z } from "zod";

import {
  canUseStreamerChatModerationAction,
  type StreamerChatModerationAccessService
} from "./streamer-chat-moderation-access.service.js";
import type { InMemoryStreamerChatModerationRuntime } from "./streamer-chat-moderation-runtime.service.js";
import type { StreamerChatModerationStoreService } from "./streamer-chat-moderation-store.service.js";
import type { StreamerChatRuntime } from "./streamer-chat-runtime.service.js";

const streamerChatModerationRequestSchema = z.object({
  accessToken: z.string().min(24),
  targetMessageId: z.string().trim().min(1).max(191)
});
const streamerChatModerationAllowRequestSchema = streamerChatModerationRequestSchema.extend({
  durationSeconds: z.number().int().min(60).max(30 * 24 * 60 * 60).nullable().optional(),
  scope: z.enum(["message", "always", "stream", "timed"])
});
const streamerChatProviderModerationRequestSchema = streamerChatModerationRequestSchema.extend({
  action: z.enum(["delete_message", "timeout_author", "ban_author"]),
  durationSeconds: z.number().int().min(60).max(28 * 24 * 60 * 60).nullable().optional(),
  reason: z.string().trim().max(500).optional()
});
const streamerChatModerationRuleListRequestSchema = z.object({
  accessToken: z.string().min(24)
});
const streamerChatModerationRuleRetractRequestSchema = z.object({
  accessToken: z.string().min(24),
  ruleId: z.string().trim().min(1).max(240)
});

const applyAccessFailure = (
  reply: { code: (statusCode: number) => void },
  failure: { statusCode: number; reason: string }
): {
  ok: false;
  reason: string;
  providerAction: false;
} => {
  reply.code(failure.statusCode);
  return {
    ok: false,
    reason: failure.reason,
    providerAction: false
  };
};

const createProviderModerationReason = (
  action: "delete_message" | "timeout_author" | "ban_author",
  authorName: string,
  customReason?: string
): string => {
  const normalizedCustomReason = customReason?.trim();

  if (normalizedCustomReason) {
    return normalizedCustomReason;
  }

  if (action === "delete_message") {
    return `Message from ${authorName} moderated from Maiks.yt streamer chat.`;
  }

  if (action === "timeout_author") {
    return `${authorName} timed out from Maiks.yt streamer chat.`;
  }

  return `${authorName} banned from Maiks.yt streamer chat.`;
};

const toAuditAction = (
  action: "delete_message" | "timeout_author" | "ban_author"
): "delete_message" | "temporary_mute_author" | "ban_author" => {
  if (action === "delete_message") {
    return "delete_message";
  }

  if (action === "timeout_author") {
    return "temporary_mute_author";
  }

  return "ban_author";
};

export const registerStreamerChatModerationRoutes = (
  server: FastifyInstance,
  dependencies: {
    accessService: StreamerChatModerationAccessService;
    discordModerationService: Pick<DiscordChatModerationService, "moderate">;
    discordWarningDeliveryService: Pick<DiscordChatWarningDeliveryService, "sendWarning">;
    moderationRuntime: InMemoryStreamerChatModerationRuntime;
    moderationStore: StreamerChatModerationStoreService;
    streamerChatRuntime: StreamerChatRuntime;
    twitchModerationService: Pick<TwitchChatModerationService, "moderate">;
    twitchWarningDeliveryService: Pick<TwitchChatWarningDeliveryService, "sendWarning">;
    youtubeWarningDeliveryService: Pick<YouTubeChatWarningDeliveryService, "sendWarning">;
  }
): void => {
  server.get("/streamer-chat/moderation/access", async (request, reply) => {
    const parsedRequest = streamerChatModerationRuleListRequestSchema.safeParse(request.query);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request",
        providerAction: false
      };
    }

    const access = await dependencies.accessService.resolvePermissions(request, parsedRequest.data.accessToken);

    if (!access.ok) {
      return applyAccessFailure(reply, access);
    }

    return {
      ok: true,
      permissions: access.permissions,
      actions: {
        canBan: canUseStreamerChatModerationAction(access.permissions, "ban"),
        canEmergencyClear: canUseStreamerChatModerationAction(access.permissions, "emergency_clear"),
        canHide: canUseStreamerChatModerationAction(access.permissions, "hide"),
        canProviderModerate: canUseStreamerChatModerationAction(access.permissions, "provider_action"),
        canAllow: canUseStreamerChatModerationAction(access.permissions, "allow"),
        canViewAudit: canUseStreamerChatModerationAction(access.permissions, "view_audit"),
        canRetractRules: canUseStreamerChatModerationAction(access.permissions, "retract_rule"),
        canViewRules: canUseStreamerChatModerationAction(access.permissions, "view_rules"),
        canWarn: canUseStreamerChatModerationAction(access.permissions, "warn")
      },
      panels: {
        appliedRules: canUseStreamerChatModerationAction(access.permissions, "view_rules"),
        auditHistory: canUseStreamerChatModerationAction(access.permissions, "view_audit"),
        chat: access.permissions.includes("*") || access.permissions.includes("chat:view")
      },
      providerAction: false,
      checkedAt: new Date().toISOString()
    };
  });

  server.post("/streamer-chat/moderation/hide", async (request, reply) => {
    const parsedRequest = streamerChatModerationRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request",
        providerAction: false
      };
    }

    const access = await dependencies.accessService.requirePermission(request, parsedRequest.data.accessToken, "hide");

    if (!access.ok) {
      return applyAccessFailure(reply, access);
    }

    const affectedMessage = dependencies.moderationRuntime.hideMessage(parsedRequest.data.targetMessageId);

    if (affectedMessage) {
      const audit = await dependencies.moderationStore.appendAudit({
        action: "hide_message",
        message: affectedMessage,
        note: "Applied from stream chat quick controls.",
        outcome: "applied",
        reason: "streamer_chat_message_hidden"
      });
      await dependencies.moderationStore.upsertActiveState({
        auditLogId: audit.id,
        message: affectedMessage,
        stateKind: "message_hidden"
      });
    }

    return {
      ok: true,
      action: "hide",
      affectedMessage,
      affectedCount: affectedMessage ? 1 : 0,
      providerAction: false
    };
  });

  server.post("/streamer-chat/moderation/ban", async (request, reply) => {
    const parsedRequest = streamerChatModerationRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request",
        providerAction: false
      };
    }

    const access = await dependencies.accessService.requirePermission(request, parsedRequest.data.accessToken, "ban");

    if (!access.ok) {
      return applyAccessFailure(reply, access);
    }

    const result = dependencies.moderationRuntime.banActorFromMessage(parsedRequest.data.targetMessageId);

    if (result?.bannedMessage) {
      const audit = await dependencies.moderationStore.appendAudit({
        action: "ban_author",
        message: result.bannedMessage,
        note: "Applied from stream chat quick controls.",
        outcome: "applied",
        reason: "streamer_chat_author_banned"
      });
      await dependencies.moderationStore.upsertActiveState({
        auditLogId: audit.id,
        message: result.bannedMessage,
        stateKind: "user_banned"
      });
    }

    return {
      ok: true,
      action: "ban",
      affectedMessage: result?.bannedMessage ?? null,
      affectedCount: result?.affectedMessages.length ?? 0,
      providerAction: false
    };
  });

  server.post("/streamer-chat/moderation/allow", async (request, reply) => {
    const parsedRequest = streamerChatModerationAllowRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request",
        providerAction: false
      };
    }

    const access = await dependencies.accessService.requirePermission(request, parsedRequest.data.accessToken, "allow");

    if (!access.ok) {
      return applyAccessFailure(reply, access);
    }

    const durationSeconds = parsedRequest.data.scope === "timed"
      ? parsedRequest.data.durationSeconds ?? 4 * 60 * 60
      : null;
    const activeUntil = durationSeconds === null ? null : new Date(Date.now() + durationSeconds * 1000);
    const scope = parsedRequest.data.scope;
    const affectedMessage = scope === "message"
      ? dependencies.moderationRuntime.allowMessage(parsedRequest.data.targetMessageId, activeUntil?.toISOString() ?? null)
      : dependencies.moderationRuntime.allowActorFromMessage(parsedRequest.data.targetMessageId, activeUntil?.toISOString() ?? null);

    if (affectedMessage) {
      const audit = await dependencies.moderationStore.appendAudit({
        action: scope === "message" ? "allow_message" : "allow_author",
        message: affectedMessage,
        note: scope === "timed"
          ? `Allowed for ${durationSeconds} seconds from stream chat options.`
          : scope === "stream"
            ? "Allowed for this stream from stream chat options."
            : scope === "message"
              ? "Message allowed from stream chat options."
              : "Author allowed from stream chat options.",
        outcome: "applied",
        reason: `streamer_chat_${scope}_allowed`
      });
      await dependencies.moderationStore.upsertAllowState({
        activeUntil,
        auditLogId: audit.id,
        durationSeconds,
        message: affectedMessage,
        stateKind: scope === "message" ? "message_allowed" : "author_allowed"
      });
    }

    return {
      ok: true,
      action: "allow",
      allowScope: scope,
      activeUntil: activeUntil?.toISOString() ?? null,
      affectedMessage,
      affectedCount: affectedMessage ? 1 : 0,
      providerAction: false
    };
  });

  server.post("/streamer-chat/moderation/warn", async (request, reply) => {
    const parsedRequest = streamerChatModerationRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request",
        providerAction: false
      };
    }

    const access = await dependencies.accessService.requirePermission(request, parsedRequest.data.accessToken, "warn");

    if (!access.ok) {
      return applyAccessFailure(reply, access);
    }

    const targetMessage = dependencies.streamerChatRuntime.findMessage(parsedRequest.data.targetMessageId);
    const previousWarningCount = targetMessage
      ? await dependencies.moderationStore.getWarningCount(targetMessage.source, targetMessage.authorName)
      : 0;
    const result = dependencies.moderationRuntime.warnActorFromMessage(
      parsedRequest.data.targetMessageId,
      previousWarningCount
    );

    let providerDelivery: DiscordChatWarningDeliveryResult | TwitchChatWarningDeliveryResult | YouTubeChatWarningDeliveryResult | null = null;

    if (result?.message) {
      const providerMessage = `@${result.message.authorName} this is warning ${result.warningCount}/${result.warningThreshold}. A third warning results in an automatic Maiks.yt stream-surface ban.`;
      await dependencies.moderationStore.appendAudit({
        action: "warn_author",
        message: result.message,
        note: `Provider warning message prepared: ${providerMessage}`,
        outcome: "applied",
        reason: "streamer_chat_author_warned"
      });

      if (result.message.source === "discord") {
        providerDelivery = await dependencies.discordWarningDeliveryService.sendWarning({
          authorName: result.message.authorName,
          channelId: result.message.providerChannelId,
          userId: result.message.providerUserId,
          warningCount: result.warningCount,
          warningThreshold: result.warningThreshold
        });

        await dependencies.moderationStore.appendProviderWarningAudit({
          deliveryResult: providerDelivery,
          message: result.message,
          providerMessage: providerDelivery.providerMessage ?? providerMessage
        });
      }

      if (result.message.source === "twitch") {
        providerDelivery = await dependencies.twitchWarningDeliveryService.sendWarning({
          authorName: result.message.authorName,
          channelName: result.message.providerChannelId ?? result.message.channelName,
          userName: result.message.providerUserLogin ?? result.message.providerUserId ?? result.message.authorName,
          warningCount: result.warningCount,
          warningThreshold: result.warningThreshold
        });

        await dependencies.moderationStore.appendProviderWarningAudit({
          deliveryResult: providerDelivery,
          message: result.message,
          providerMessage: providerDelivery.providerMessage ?? providerMessage
        });
      }

      if (result.message.source === "youtube") {
        providerDelivery = await dependencies.youtubeWarningDeliveryService.sendWarning({
          authorChannelId: result.message.providerUserId,
          authorName: result.message.authorName,
          liveChatId: result.message.providerChannelId,
          warningCount: result.warningCount,
          warningThreshold: result.warningThreshold
        });

        await dependencies.moderationStore.appendProviderWarningAudit({
          deliveryResult: providerDelivery,
          message: result.message,
          providerMessage: providerDelivery.providerMessage ?? providerMessage
        });
      }

      if (result.autoBanned) {
        const audit = await dependencies.moderationStore.appendAudit({
          action: "ban_author",
          message: result.message,
          note: "Automatic local ban after third warning.",
          outcome: "applied",
          reason: "streamer_chat_warning_threshold_reached"
        });
        await dependencies.moderationStore.upsertActiveState({
          auditLogId: audit.id,
          message: result.message,
          stateKind: "user_banned"
        });
      }
    }

    return {
      ok: true,
      action: "warn",
      affectedMessage: result?.message ?? null,
      affectedCount: result?.affectedMessages.length ?? 0,
      autoBanned: result?.autoBanned ?? false,
      warningCount: result?.warningCount ?? 0,
      warningThreshold: result?.warningThreshold ?? 3,
      providerAction: providerDelivery?.providerAction ?? false,
      providerMessageSent: providerDelivery?.providerMessageSent ?? false,
      providerMessage: providerDelivery?.providerMessage ?? (result
        ? `@${result.message.authorName} this is warning ${result.warningCount}/${result.warningThreshold}. A third warning results in an automatic Maiks.yt stream-surface ban.`
        : null),
      providerWarningReason: providerDelivery?.ok === false ? providerDelivery.reason : null
    };
  });

  server.post("/streamer-chat/moderation/provider-action", async (request, reply) => {
    const parsedRequest = streamerChatProviderModerationRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request",
        providerAction: false
      };
    }

    const access = await dependencies.accessService.requirePermission(request, parsedRequest.data.accessToken, "provider_action");

    if (!access.ok) {
      return applyAccessFailure(reply, access);
    }

    const targetMessage = dependencies.streamerChatRuntime.findMessage(parsedRequest.data.targetMessageId);

    if (!targetMessage) {
      return {
        ok: true,
        action: parsedRequest.data.action,
        affectedMessage: null,
        affectedCount: 0,
        providerAction: false,
        providerActionSent: false,
        providerActionReason: "streamer_chat_message_not_found"
      };
    }

    const reason = createProviderModerationReason(parsedRequest.data.action, targetMessage.authorName, parsedRequest.data.reason);
    let providerResult: ProviderChatModerationResult;

    if (targetMessage.source === "discord") {
      providerResult = await dependencies.discordModerationService.moderate({
        action: parsedRequest.data.action,
        channelId: targetMessage.providerChannelId ?? null,
        durationSeconds: parsedRequest.data.durationSeconds ?? null,
        guildId: targetMessage.providerGuildId ?? null,
        messageId: targetMessage.providerMessageId ?? null,
        reason,
        userId: targetMessage.providerUserId ?? null
      });
    } else if (targetMessage.source === "twitch") {
      providerResult = await dependencies.twitchModerationService.moderate({
        action: parsedRequest.data.action,
        durationSeconds: parsedRequest.data.durationSeconds ?? null,
        messageId: targetMessage.providerMessageId ?? null,
        reason,
        userId: targetMessage.providerUserId ?? null
      });
    } else {
      providerResult = {
        ok: false,
        providerAction: false,
        providerActionId: null,
        providerActionSent: false,
        reason: targetMessage.source === "youtube"
          ? "youtube_provider_moderation_gated"
          : "provider_moderation_unsupported_source"
      };
    }

    await dependencies.moderationStore.appendProviderActionAudit({
      action: toAuditAction(parsedRequest.data.action),
      actionKey: parsedRequest.data.action,
      durationSeconds: parsedRequest.data.durationSeconds ?? null,
      message: targetMessage,
      providerResult,
      reason
    });

    return {
      ok: true,
      action: parsedRequest.data.action,
      affectedMessage: targetMessage,
      affectedCount: providerResult.ok ? 1 : 0,
      providerAction: providerResult.providerAction,
      providerActionSent: providerResult.providerActionSent,
      providerActionReason: providerResult.ok ? null : providerResult.reason
    };
  });

  server.get("/streamer-chat/moderation/rules", async (request, reply) => {
    const parsedRequest = streamerChatModerationRuleListRequestSchema.safeParse(request.query);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request",
        providerAction: false
      };
    }

    const access = await dependencies.accessService.requirePermission(request, parsedRequest.data.accessToken, "view_rules");

    if (!access.ok) {
      return applyAccessFailure(reply, access);
    }

    return {
      ok: true,
      rules: await dependencies.moderationStore.listRules(),
      providerAction: false,
      checkedAt: new Date().toISOString()
    };
  });

  server.get("/streamer-chat/moderation/audit", async (request, reply) => {
    const parsedRequest = streamerChatModerationRuleListRequestSchema.safeParse(request.query);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request",
        providerAction: false
      };
    }

    const access = await dependencies.accessService.requirePermission(request, parsedRequest.data.accessToken, "view_audit");

    if (!access.ok) {
      return applyAccessFailure(reply, access);
    }

    return {
      ok: true,
      audit: await dependencies.moderationStore.listAudit(),
      providerAction: false,
      checkedAt: new Date().toISOString()
    };
  });

  server.post("/streamer-chat/moderation/rules/retract", async (request, reply) => {
    const parsedRequest = streamerChatModerationRuleRetractRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "invalid_request",
        providerAction: false
      };
    }

    const access = await dependencies.accessService.requirePermission(request, parsedRequest.data.accessToken, "retract_rule");

    if (!access.ok) {
      return applyAccessFailure(reply, access);
    }

    const retractedRule = await dependencies.moderationStore.retractRule(parsedRequest.data.ruleId);

    if (retractedRule) {
      dependencies.moderationRuntime.retractRule(retractedRule.id);
    }

    return {
      ok: true,
      retractedRule,
      providerAction: false
    };
  });
};
