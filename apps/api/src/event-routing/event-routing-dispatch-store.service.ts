import { randomUUID } from "node:crypto";

import type { DatabasePool } from "@maiks-yt/database";

import type {
  EventRoutingActiveCooldown,
  EventRoutingCooldownInsert,
  EventRoutingDispatchRepository,
  EventRoutingDispatchRuleRecord,
  EventRoutingHistoryInsert,
  EventRoutingHistoryRecord
} from "./event-routing-dispatch.types.js";

type RuleRow = EventRoutingDispatchRuleRecord & {
  enabled: number | boolean;
  liveOnly: number | boolean;
  offlineOnly: number | boolean;
  approvalRequired: number | boolean;
  oncePerStream: number | boolean;
  perUserCooldownSeconds?: number | null;
  globalCooldownSeconds?: number | null;
  templateKey?: string | null;
  themeKey?: string | null;
  soundKey?: string | null;
};

type CooldownRow = {
  id: string;
  cooldownKey: string;
  windowEndsAt: Date | string;
  hitCount: number;
};

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const selectRuleFields = `
  id,
  event_kind AS eventKind,
  source_platform AS sourcePlatform,
  destination,
  enabled,
  live_only AS liveOnly,
  offline_only AS offlineOnly,
  approval_required AS approvalRequired,
  per_user_cooldown_seconds AS perUserCooldownSeconds,
  global_cooldown_seconds AS globalCooldownSeconds,
  once_per_stream AS oncePerStream,
  template_key AS templateKey,
  theme_key AS themeKey,
  sound_key AS soundKey,
  notification_priority AS notificationPriority
`;

const mapRule = (row: RuleRow): EventRoutingDispatchRuleRecord => ({
  id: row.id,
  eventKind: row.eventKind,
  sourcePlatform: row.sourcePlatform,
  destination: row.destination,
  enabled: Boolean(row.enabled),
  liveOnly: Boolean(row.liveOnly),
  offlineOnly: Boolean(row.offlineOnly),
  approvalRequired: Boolean(row.approvalRequired),
  perUserCooldownSeconds: row.perUserCooldownSeconds ?? null,
  globalCooldownSeconds: row.globalCooldownSeconds ?? null,
  oncePerStream: Boolean(row.oncePerStream),
  templateKey: row.templateKey ?? null,
  themeKey: row.themeKey ?? null,
  soundKey: row.soundKey ?? null,
  notificationPriority: row.notificationPriority
});

const mapCooldown = (row: CooldownRow): EventRoutingActiveCooldown => ({
  id: row.id,
  cooldownKey: row.cooldownKey,
  windowEndsAt: toIsoString(row.windowEndsAt),
  hitCount: row.hitCount
});

const mapHistory = (
  id: string,
  input: EventRoutingHistoryInsert,
  createdAt: Date
): EventRoutingHistoryRecord => ({
  ...input,
  id,
  isTest: true,
  isSimulated: true,
  isRealMoney: false,
  testResettable: true,
  createdAt: createdAt.toISOString()
});

export const createEventRoutingDispatchRepository = (
  pool: DatabasePool
): EventRoutingDispatchRepository => ({
  async getRule(eventKind, sourcePlatform) {
    const [rows] = await pool.execute(
      `
        SELECT ${selectRuleFields}
        FROM event_routing_rules
        WHERE event_kind = ?
          AND source_platform = ?
        LIMIT 1
      `,
      [eventKind, sourcePlatform]
    );

    return Array.isArray(rows) && rows.length > 0
      ? mapRule(rows[0] as RuleRow)
      : null;
  },

  async isUserOptedOut(input) {
    const [rows] = await pool.execute(
      `
        SELECT opted_out AS optedOut
        FROM event_user_opt_outs
        WHERE user_id = ?
          AND event_kind IN ('all_stream_visible_website_events', ?)
          AND opted_out = true
        LIMIT 1
      `,
      [input.userId, input.eventKind]
    );

    return Array.isArray(rows) && rows.length > 0;
  },

  async findActiveCooldown(input) {
    const [rows] = await pool.execute(
      `
        SELECT
          id,
          cooldown_key AS cooldownKey,
          window_ends_at AS windowEndsAt,
          hit_count AS hitCount
        FROM event_cooldown_state
        WHERE routing_rule_id = ?
          AND cooldown_key = ?
          AND window_ends_at > ?
        LIMIT 1
      `,
      [input.routingRuleId, input.cooldownKey, input.now]
    );

    return Array.isArray(rows) && rows.length > 0
      ? mapCooldown(rows[0] as CooldownRow)
      : null;
  },

  async writeHistory(input) {
    const id = randomUUID();
    const createdAt = new Date();

    await pool.execute(
      `
        INSERT INTO event_history
          (
            id,
            source_platform,
            event_kind,
            source_event_id,
            routing_rule_id,
            routing_outcome,
            destination,
            actor_user_id,
            actor_external_id,
            actor_display_name,
            user_id,
            stream_session_id,
            stream_schedule_entry_id,
            session_id,
            is_test,
            is_simulated,
            is_real_money,
            test_resettable,
            redacted_payload,
            occurred_at,
            created_at
          )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, true, false, true, ?, ?, ?)
      `,
      [
        id,
        input.sourcePlatform,
        input.eventKind,
        input.sourceEventId,
        input.routingRuleId,
        input.routingOutcome,
        input.destination,
        input.actorUserId,
        input.actorExternalId,
        input.actorDisplayName,
        input.userId,
        input.streamSessionId,
        input.streamScheduleEntryId,
        input.sessionId,
        JSON.stringify(input.redactedPayload),
        input.occurredAt,
        createdAt
      ]
    );

    return mapHistory(id, input, createdAt);
  },

  async queueApproval(input) {
    const id = randomUUID();
    const createdAt = new Date();

    await pool.execute(
      `
        INSERT INTO event_approval_queue
          (
            id,
            event_history_id,
            routing_rule_id,
            destination,
            status,
            created_at,
            updated_at
          )
        VALUES (?, ?, ?, ?, 'pending', ?, ?)
      `,
      [
        id,
        input.eventHistoryId,
        input.routingRuleId,
        input.destination,
        createdAt,
        createdAt
      ]
    );

    return {
      id,
      eventHistoryId: input.eventHistoryId,
      routingRuleId: input.routingRuleId,
      destination: input.destination,
      status: "pending",
      createdAt: createdAt.toISOString()
    };
  },

  async recordCooldown(input: EventRoutingCooldownInsert) {
    const id = randomUUID();

    await pool.execute(
      `
        INSERT INTO event_cooldown_state
          (
            id,
            routing_rule_id,
            event_kind,
            source_platform,
            scope,
            cooldown_key,
            actor_user_id,
            actor_external_id,
            stream_session_id,
            stream_schedule_entry_id,
            window_started_at,
            window_ends_at,
            hit_count,
            last_event_history_id
          )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        ON DUPLICATE KEY UPDATE
          event_kind = VALUES(event_kind),
          source_platform = VALUES(source_platform),
          scope = VALUES(scope),
          actor_user_id = VALUES(actor_user_id),
          actor_external_id = VALUES(actor_external_id),
          stream_session_id = VALUES(stream_session_id),
          stream_schedule_entry_id = VALUES(stream_schedule_entry_id),
          window_started_at = IF(window_ends_at > VALUES(window_started_at), window_started_at, VALUES(window_started_at)),
          window_ends_at = IF(window_ends_at > VALUES(window_started_at), window_ends_at, VALUES(window_ends_at)),
          hit_count = IF(window_ends_at > VALUES(window_started_at), hit_count + 1, VALUES(hit_count)),
          last_event_history_id = VALUES(last_event_history_id),
          updated_at = NOW()
      `,
      [
        id,
        input.routingRuleId,
        input.eventKind,
        input.sourcePlatform,
        input.scope,
        input.cooldownKey,
        input.actorUserId,
        input.actorExternalId,
        input.streamSessionId,
        input.streamScheduleEntryId,
        input.windowStartedAt,
        input.windowEndsAt,
        input.lastEventHistoryId
      ]
    );
  }
});
