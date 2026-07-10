import type { FastifyInstance } from "fastify";
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

export const registerStreamerChatModerationRoutes = (
  server: FastifyInstance,
  dependencies: {
    accessService: StreamerChatModerationAccessService;
    moderationRuntime: InMemoryStreamerChatModerationRuntime;
    moderationStore: StreamerChatModerationStoreService;
    streamerChatRuntime: StreamerChatRuntime;
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
        canViewAudit: canUseStreamerChatModerationAction(access.permissions, "view_audit"),
        canRetractRules: canUseStreamerChatModerationAction(access.permissions, "retract_rule"),
        canViewRules: canUseStreamerChatModerationAction(access.permissions, "view_rules"),
        canWarn: canUseStreamerChatModerationAction(access.permissions, "warn")
      },
      panels: {
        appliedRules: canUseStreamerChatModerationAction(access.permissions, "view_rules"),
        auditHistory: canUseStreamerChatModerationAction(access.permissions, "view_audit"),
        chat: access.permissions.includes("*") || access.permissions.includes("chat:view"),
        liveHelper: access.permissions.includes("*")
          || access.permissions.includes("moderators:manage")
          || access.permissions.includes("fake-local-chat:moderate"),
        pendingApprovals: access.permissions.includes("*") || access.permissions.includes("moderators:manage")
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

    if (result?.message) {
      await dependencies.moderationStore.appendAudit({
        action: "warn_author",
        message: result.message,
        note: `Provider warning message pending: @${result.message.authorName} this is warning ${result.warningCount}/${result.warningThreshold}. A third warning results in an automatic Maiks.yt stream-surface ban.`,
        outcome: "applied",
        reason: "streamer_chat_author_warned"
      });

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
      providerAction: false,
      providerMessageSent: false,
      providerMessage: result
        ? `@${result.message.authorName} this is warning ${result.warningCount}/${result.warningThreshold}. A third warning results in an automatic Maiks.yt stream-surface ban.`
        : null
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
