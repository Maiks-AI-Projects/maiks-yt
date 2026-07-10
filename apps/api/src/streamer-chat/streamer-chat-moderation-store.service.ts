import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";
import type { StreamerChatMessage } from "@maiks-yt/events";
import type { DiscordChatWarningDeliveryResult } from "@maiks-yt/integrations";

import type {
  StreamerChatModerationAuditEntry,
  StreamerChatModerationRule,
  StreamerChatModerationRuleKind
} from "./streamer-chat-moderation-runtime.service.js";

const controlTokenModerationActorId = "control-token";

const toModerationDate = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return new Date(value).toISOString();
  }

  return new Date().toISOString();
};

const isStreamerChatSource = (source: unknown): source is StreamerChatMessage["source"] =>
  source === "fake-local" || source === "twitch" || source === "youtube" || source === "discord";

const getStreamerChatModerationFlags = (source: StreamerChatMessage["source"]): {
  isSimulated: boolean;
  isTest: boolean;
  testResettable: boolean;
} => source === "fake-local"
  ? {
    isSimulated: true,
    isTest: true,
    testResettable: true
  }
  : {
    isSimulated: false,
    isTest: false,
    testResettable: false
  };

const createStreamerChatActorKey = (source: StreamerChatMessage["source"], authorName: string): string =>
  `${source}:${authorName.trim().toLowerCase()}`;

const createHiddenMessageRuleId = (messageId: string): string => `message_hidden:${messageId}`;
const createBannedActorRuleId = (source: StreamerChatMessage["source"], authorName: string): string =>
  `author_banned:${createStreamerChatActorKey(source, authorName)}`;
const createWarningRuleId = (source: StreamerChatMessage["source"], authorName: string): string =>
  `author_warned:${createStreamerChatActorKey(source, authorName)}`;

export class StreamerChatModerationStoreService {
  public constructor(private readonly getDatabasePool: () => DatabasePool) {}

  public async appendAudit({
    action,
    message,
    note,
    outcome,
    reason
  }: {
    action: "warn_author" | "hide_message" | "ban_author" | "unban_author";
    message: {
      authorName: string;
      id: string;
      providerMessageId?: string;
      source: StreamerChatMessage["source"];
    };
    note: string | null;
    outcome: "applied" | "not_found" | "reverted";
    reason: string | null;
  }): Promise<{ id: string; at: string }> {
    const id = randomUUID();
    const at = new Date().toISOString();
    const flags = getStreamerChatModerationFlags(message.source);

    await this.getDatabasePool().execute(
      `
        INSERT INTO moderation_audit_logs
          (
            id,
            source,
            action,
            outcome,
            actor_display_name,
            target_author_name,
            target_message_id,
            target_external_id,
            reason,
            note,
            provider_action,
            is_test,
            is_simulated,
            test_resettable,
            redacted_context,
            created_at
          )
        VALUES (?, ?, ?, ?, 'Control chat window', ?, ?, ?, ?, ?, false, ?, ?, ?, ?, ?)
      `,
      [
        id,
        message.source,
        action,
        outcome,
        message.authorName,
        message.id,
        message.providerMessageId ?? null,
        reason,
        note,
        flags.isTest,
        flags.isSimulated,
        flags.testResettable,
        JSON.stringify({
          source: "streamer-chat-window",
          providerAction: false
        }),
        new Date(at)
      ]
    );

    return { id, at };
  }

  public async upsertActiveState({
    auditLogId,
    message,
    stateKind
  }: {
    auditLogId: string;
    message: {
      authorName: string;
      id: string;
      providerMessageId?: string;
      source: StreamerChatMessage["source"];
    };
    stateKind: "message_hidden" | "user_banned";
  }): Promise<void> {
    const now = new Date();
    const flags = getStreamerChatModerationFlags(message.source);
    const targetClause = stateKind === "message_hidden"
      ? "target_message_id = ?"
      : "LOWER(target_author_name) = LOWER(?)";
    const targetValue = stateKind === "message_hidden" ? message.id : message.authorName;
    const [updateResult] = await this.getDatabasePool().execute(
      `
        UPDATE moderation_active_states
        SET
          status = 'active',
          active_until = NULL,
          duration_seconds = NULL,
          reason = ?,
          note = ?,
          last_audit_log_id = ?,
          revoked_audit_log_id = NULL,
          revoked_at = NULL,
          revoked_by_user_id = NULL,
          revocation_reason = NULL,
          provider_action = false,
          provider_action_id = NULL,
          provider_state_id = NULL,
          is_test = ?,
          is_simulated = ?,
          test_resettable = ?,
          updated_at = ?
        WHERE source = ?
          AND state_kind = ?
          AND status = 'active'
          AND revoked_at IS NULL
          AND ${targetClause}
      `,
      [
        stateKind === "message_hidden" ? "Hidden from stream chat surfaces." : "Banned from stream chat surfaces.",
        "Applied from stream chat quick controls.",
        auditLogId,
        flags.isTest,
        flags.isSimulated,
        flags.testResettable,
        now,
        message.source,
        stateKind,
        targetValue
      ]
    );

    if (((updateResult as { affectedRows?: number }).affectedRows ?? 0) > 0) {
      return;
    }

    await this.getDatabasePool().execute(
      `
        INSERT INTO moderation_active_states
          (
            id,
            source,
            state_kind,
            status,
            target_author_name,
            target_message_id,
            target_external_id,
            active_from,
            reason,
            note,
            created_audit_log_id,
            last_audit_log_id,
            provider_action,
            is_test,
            is_simulated,
            test_resettable,
            created_at,
            updated_at
          )
        VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, false, ?, ?, ?, ?, ?)
      `,
      [
        randomUUID(),
        message.source,
        stateKind,
        message.authorName,
        stateKind === "message_hidden" ? message.id : null,
        message.providerMessageId ?? null,
        now,
        stateKind === "message_hidden" ? "Hidden from stream chat surfaces." : "Banned from stream chat surfaces.",
        "Applied from stream chat quick controls.",
        auditLogId,
        auditLogId,
        flags.isTest,
        flags.isSimulated,
        flags.testResettable,
        now,
        now
      ]
    );
  }

  public async appendProviderWarningAudit({
    deliveryResult,
    message,
    providerMessage
  }: {
    deliveryResult: DiscordChatWarningDeliveryResult;
    message: {
      authorName: string;
      id: string;
      providerChannelId?: string;
      providerMessageId?: string;
      providerUserId?: string;
      source: StreamerChatMessage["source"];
    };
    providerMessage: string;
  }): Promise<{ id: string; at: string }> {
    const id = randomUUID();
    const at = new Date().toISOString();
    const providerActionId = deliveryResult.providerMessageId ?? `provider-warning-${id}`;

    await this.getDatabasePool().execute(
      `
        INSERT INTO moderation_audit_logs
          (
            id,
            source,
            action,
            outcome,
            actor_display_name,
            target_author_name,
            target_message_id,
            target_external_id,
            reason,
            note,
            provider_action,
            provider_action_id,
            is_test,
            is_simulated,
            test_resettable,
            redacted_context,
            created_at
          )
        VALUES (?, ?, 'warn_author', ?, 'Control chat window', ?, ?, ?, ?, ?, true, ?, false, false, false, ?, ?)
      `,
      [
        id,
        message.source,
        deliveryResult.ok ? "applied" : "provider_failed",
        message.authorName,
        message.id,
        message.providerMessageId ?? message.providerUserId ?? null,
        deliveryResult.ok ? "streamer_chat_provider_warning_sent" : deliveryResult.reason,
        deliveryResult.ok ? "Provider warning message sent." : "Provider warning message failed or was skipped.",
        providerActionId,
        JSON.stringify({
          provider: message.source,
          providerAction: true,
          providerChannelId: message.providerChannelId ?? null,
          providerMessage,
          providerMessageSent: deliveryResult.providerMessageSent,
          providerWarningReason: deliveryResult.ok ? null : deliveryResult.reason
        }),
        new Date(at)
      ]
    );

    return { id, at };
  }

  public async getWarningCount(
    source: StreamerChatMessage["source"],
    authorName: string
  ): Promise<number> {
    const [rows] = await this.getDatabasePool().execute(
      `
        SELECT
          COALESCE(SUM(CASE WHEN outcome = 'applied' THEN 1 WHEN outcome = 'reverted' THEN -1 ELSE 0 END), 0) AS warningCount
        FROM moderation_audit_logs
        WHERE source = ?
          AND action = 'warn_author'
          AND LOWER(target_author_name) = LOWER(?)
          AND provider_action = false
      `,
      [source, authorName]
    );

    const firstRow = Array.isArray(rows) ? (rows as Array<{ warningCount?: unknown }>)[0] : null;
    const count = Number(firstRow?.warningCount ?? 0);

    return Number.isFinite(count) && count > 0 ? count : 0;
  }

  public async listRules(): Promise<StreamerChatModerationRule[]> {
    const [activeRows] = await this.getDatabasePool().execute(
      `
        SELECT
          id,
          source,
          state_kind AS stateKind,
          target_author_name AS authorName,
          target_message_id AS messageId,
          active_from AS appliedAt
        FROM moderation_active_states
        WHERE status = 'active'
          AND provider_action = false
          AND state_kind IN ('message_hidden', 'user_banned')
          AND source IN ('fake-local', 'twitch', 'youtube', 'discord')
        ORDER BY active_from DESC
        LIMIT 100
      `
    );
    const activeRules = (Array.isArray(activeRows) ? activeRows : []).flatMap((row) => {
      const item = row as {
        appliedAt: unknown;
        authorName: string | null;
        messageId: string | null;
        source: unknown;
        stateKind: "message_hidden" | "user_banned";
      };

      if (!isStreamerChatSource(item.source) || !item.authorName) {
        return [];
      }

      const kind: StreamerChatModerationRuleKind = item.stateKind === "message_hidden" ? "message_hidden" : "author_banned";

      return [{
        appliedAt: toModerationDate(item.appliedAt),
        authorName: item.authorName,
        id: kind === "message_hidden" && item.messageId
          ? createHiddenMessageRuleId(item.messageId)
          : createBannedActorRuleId(item.source, item.authorName),
        kind,
        messageId: item.messageId,
        source: item.source
      }];
    });
    const [warningRows] = await this.getDatabasePool().execute(
      `
        SELECT
          source,
          target_author_name AS authorName,
          MAX(created_at) AS appliedAt,
          COALESCE(SUM(CASE WHEN outcome = 'applied' THEN 1 WHEN outcome = 'reverted' THEN -1 ELSE 0 END), 0) AS warningCount,
          MAX(target_message_id) AS messageId
        FROM moderation_audit_logs
        WHERE action = 'warn_author'
          AND provider_action = false
          AND source IN ('fake-local', 'twitch', 'youtube', 'discord')
        GROUP BY source, LOWER(target_author_name), target_author_name
        HAVING warningCount > 0
        ORDER BY appliedAt DESC
        LIMIT 100
      `
    );
    const warningRules = (Array.isArray(warningRows) ? warningRows : []).flatMap((row) => {
      const item = row as {
        appliedAt: unknown;
        authorName: string | null;
        messageId: string | null;
        source: unknown;
        warningCount: unknown;
      };

      if (!isStreamerChatSource(item.source) || !item.authorName) {
        return [];
      }

      return [{
        appliedAt: toModerationDate(item.appliedAt),
        authorName: item.authorName,
        count: Number(item.warningCount),
        id: createWarningRuleId(item.source, item.authorName),
        kind: "author_warned" as const,
        messageId: item.messageId,
        source: item.source
      }];
    });

    return [...activeRules, ...warningRules]
      .sort((left, right) => right.appliedAt.localeCompare(left.appliedAt));
  }

  public async listAudit(limit = 50): Promise<StreamerChatModerationAuditEntry[]> {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const [rows] = await this.getDatabasePool().execute(
      `
        SELECT
          id,
          source,
          action,
          outcome,
          actor_display_name AS actorDisplayName,
          target_author_name AS targetAuthorName,
          target_message_id AS messageId,
          target_external_id AS targetExternalId,
          reason,
          note,
          provider_action AS providerAction,
          created_at AS createdAt
        FROM moderation_audit_logs
        WHERE source IN ('fake-local', 'twitch', 'youtube', 'discord')
          AND action IN ('warn_author', 'hide_message', 'ban_author', 'unban_author')
        ORDER BY created_at DESC, id DESC
        LIMIT ${safeLimit}
      `
    );

    return (Array.isArray(rows) ? rows : []).flatMap((row) => {
      const item = row as {
        action: StreamerChatModerationAuditEntry["action"];
        actorDisplayName: string | null;
        createdAt: unknown;
        id: string;
        messageId: string | null;
        note: string | null;
        outcome: StreamerChatModerationAuditEntry["outcome"];
        providerAction: boolean | number;
        reason: string | null;
        source: unknown;
        targetAuthorName: string | null;
        targetExternalId: string | null;
      };

      if (!isStreamerChatSource(item.source)) {
        return [];
      }

      return [{
        action: item.action,
        actorDisplayName: item.actorDisplayName,
        at: toModerationDate(item.createdAt),
        id: item.id,
        messageId: item.messageId,
        note: item.note,
        outcome: item.outcome,
        providerAction: Boolean(item.providerAction),
        reason: item.reason,
        source: item.source,
        targetAuthorName: item.targetAuthorName,
        targetExternalId: item.targetExternalId
      }];
    });
  }

  public async retractRule(ruleId: string): Promise<StreamerChatModerationRule | null> {
    const rule = (await this.listRules()).find((candidate) => candidate.id === ruleId) ?? null;

    if (!rule) {
      return null;
    }

    const audit = await this.appendAudit({
      action: rule.kind === "author_banned"
        ? "unban_author"
        : rule.kind === "message_hidden"
          ? "hide_message"
          : "warn_author",
      message: {
        authorName: rule.authorName,
        id: rule.messageId ?? rule.id,
        source: rule.source
      },
      note: "Retracted from applied rules window.",
      outcome: "reverted",
      reason: "streamer_chat_rule_retracted"
    });

    if (rule.kind === "message_hidden" || rule.kind === "author_banned") {
      const stateKind = rule.kind === "message_hidden" ? "message_hidden" : "user_banned";
      const targetClause = rule.kind === "message_hidden"
        ? "target_message_id = ?"
        : "LOWER(target_author_name) = LOWER(?)";
      const targetValue = rule.kind === "message_hidden" ? rule.messageId : rule.authorName;

      if (targetValue) {
        await this.getDatabasePool().execute(
          `
            UPDATE moderation_active_states
            SET
              status = 'revoked',
              revoked_audit_log_id = ?,
              revoked_at = ?,
              revoked_by_user_id = ?,
              revocation_reason = ?,
              last_audit_log_id = ?,
              updated_at = ?
            WHERE source = ?
              AND state_kind = ?
              AND status = 'active'
              AND ${targetClause}
          `,
          [
            audit.id,
            new Date(audit.at),
            controlTokenModerationActorId,
            "Retracted from applied rules window.",
            audit.id,
            new Date(audit.at),
            rule.source,
            stateKind,
            targetValue
          ]
        );
      }
    }

    return rule;
  }
}
