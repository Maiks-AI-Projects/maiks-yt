import { sql } from "drizzle-orm";
import {
  check,
  customType,
  foreignKey,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core";

export * from "./database-core.schema.js";
export * from "./database-auth.schema.js";
export * from "./database-community.schema.js";
export * from "./database-access.schema.js";
export * from "./database-projects.schema.js";
export * from "./database-content.schema.js";
export * from "./database-streaming.schema.js";
export * from "./database-events.schema.js";
export * from "./database-games.schema.js";
export * from "./database-music.schema.js";
export * from "./database-money.schema.js";

const asciiHandle = customType<{
  data: string;
  driverData: string;
  config: { length: number };
  configRequired: true;
}>({
  dataType: (config) => `varchar(${config.length}) character set ascii collate ascii_bin`
});

const domainUserIdSnapshot = customType<{
  data: string;
  driverData: string;
}>({
  dataType: () => "varchar(36) character set utf8mb4 collate utf8mb4_general_ci"
});

const profileHandleOperationId = customType<{
  data: string;
  driverData: string;
}>({
  dataType: () => "varchar(36) character set utf8mb4 collate utf8mb4_general_ci"
});

export const profileHandles = mysqlTable(
  "profile_handles",
  {
    handle: asciiHandle("handle", { length: 32 }).notNull().primaryKey(),
    state: mysqlEnum("state", ["active", "reserved", "retired"]).notNull(),
    userId: domainUserIdSnapshot("user_id"),
    reservedAt: timestamp("reserved_at"),
    assignedAt: timestamp("assigned_at"),
    retiredAt: timestamp("retired_at"),
    reusableAfter: timestamp("reusable_after"),
    transitionKind: mysqlEnum("transition_kind", [
      "owner_reserved",
      "policy_reserved",
      "owner_assigned",
      "expired_reuse_assigned",
      "renamed",
      "deleted_user",
      "admin_retired"
    ]).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow()
  },
  (table) => [
    uniqueIndex("profile_handles_user_id_uidx").on(table.userId),
    index("profile_handles_state_reusable_idx").on(table.state, table.reusableAfter),
    index("profile_handles_user_state_idx").on(table.userId, table.state),
    check(
      "profile_handles_handle_ascii_check",
      sql`${table.handle} regexp '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'
        and ${table.handle} not regexp '--'
        and ${table.handle} = lower(${table.handle})`
    ),
    check(
      "profile_handles_state_shape_check",
      sql`(
        (
          ${table.state} = 'active'
          and ${table.userId} is not null
          and ${table.reservedAt} is null
          and ${table.assignedAt} is not null
          and ${table.retiredAt} is null
          and ${table.reusableAfter} is null
          and ${table.transitionKind} in ('owner_assigned', 'expired_reuse_assigned')
        )
        or (
          ${table.state} = 'reserved'
          and ${table.userId} is null
          and ${table.reservedAt} is not null
          and ${table.assignedAt} is null
          and ${table.retiredAt} is null
          and ${table.reusableAfter} is null
          and ${table.transitionKind} in ('owner_reserved', 'policy_reserved')
        )
        or (
          ${table.state} = 'retired'
          and ${table.userId} is null
          and ${table.reservedAt} is null
          and ${table.assignedAt} is null
          and ${table.retiredAt} is not null
          and ${table.reusableAfter} is not null
          and ${table.reusableAfter} >= ${table.retiredAt} + interval 1 year
          and ${table.transitionKind} in ('renamed', 'deleted_user', 'admin_retired')
        )
      )`
    )
  ]
);

export const profileHandleOperations = mysqlTable(
  "profile_handle_operations",
  {
    id: profileHandleOperationId("id").primaryKey(),
    operationVersion: int("operation_version").notNull().default(1),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    requestFingerprintSha256: varchar("request_fingerprint_sha256", { length: 64 }).notNull(),
    operationType: mysqlEnum("operation_type", [
      "owner_reserve_handle",
      "owner_release_reservation",
      "owner_change_reservation",
      "owner_assign_handle",
      "owner_rename_handle",
      "owner_retire_handle",
      "owner_reuse_retired_handle"
    ]).notNull(),
    operationOutcome: mysqlEnum("operation_outcome", [
      "applied",
      "denied",
      "invalid",
      "not_found",
      "conflict",
      "stale"
    ]).notNull(),
    expectedDetailCount: int("expected_detail_count").notNull(),
    actorKind: mysqlEnum("actor_kind", ["owner"]).notNull(),
    actorUserIdSnapshot: domainUserIdSnapshot("actor_user_id_snapshot").notNull(),
    actorAuthoritySnapshot: mysqlEnum("actor_authority_snapshot", ["owner"]).notNull(),
    subjectUserIdSnapshot: domainUserIdSnapshot("subject_user_id_snapshot"),
    subjectBoundary: mysqlEnum("subject_boundary", [
      "user_handle",
      "reserved_handle",
      "retired_handle",
      "normalized_missing_subject"
    ]).notNull(),
    reasonCode: mysqlEnum("reason_code", [
      "owner_brand_reservation",
      "owner_manual_assignment",
      "owner_manual_rename",
      "owner_manual_retirement",
      "reservation_cleanup",
      "invalid_request",
      "authority_denied",
      "handle_unavailable",
      "concurrency_retry"
    ]).notNull(),
    operatorNote: varchar("operator_note", { length: 280 }),
    requestedAt: timestamp("requested_at").notNull(),
    replayResult: mysqlEnum("replay_result", [
      "stored_applied",
      "stored_denied",
      "stored_invalid",
      "stored_not_found",
      "stored_conflict",
      "stored_stale"
    ]).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("profile_handle_operations_idempotency_key_uidx").on(table.idempotencyKey),
    index("profile_handle_operations_requested_at_idx").on(table.requestedAt),
    index("profile_handle_operations_actor_requested_idx").on(table.actorUserIdSnapshot, table.requestedAt),
    index("profile_handle_operations_subject_requested_idx").on(table.subjectUserIdSnapshot, table.requestedAt),
    check("profile_handle_operations_version_check", sql`${table.operationVersion} = 1`),
    check(
      "profile_handle_operations_fingerprint_check",
      sql`length(${table.requestFingerprintSha256}) = 64
        and ${table.requestFingerprintSha256} regexp '^[0-9a-f]{64}$'`
    ),
    check(
      "profile_handle_operations_detail_count_check",
      sql`(
        (${table.operationOutcome} = 'applied' and ${table.operationType} in (
          'owner_reserve_handle',
          'owner_release_reservation',
          'owner_assign_handle',
          'owner_retire_handle',
          'owner_reuse_retired_handle'
        ) and ${table.expectedDetailCount} = 1)
        or (${table.operationOutcome} = 'applied' and ${table.operationType} in (
          'owner_change_reservation',
          'owner_rename_handle'
        ) and ${table.expectedDetailCount} = 2)
        or (${table.operationOutcome} <> 'applied' and ${table.expectedDetailCount} >= 0 and ${table.expectedDetailCount} <= 2)
      )`
    ),
    check(
      "profile_handle_operations_replay_result_check",
      sql`(
        (${table.operationOutcome} = 'applied' and ${table.replayResult} = 'stored_applied')
        or (${table.operationOutcome} = 'denied' and ${table.replayResult} = 'stored_denied')
        or (${table.operationOutcome} = 'invalid' and ${table.replayResult} = 'stored_invalid')
        or (${table.operationOutcome} = 'not_found' and ${table.replayResult} = 'stored_not_found')
        or (${table.operationOutcome} = 'conflict' and ${table.replayResult} = 'stored_conflict')
        or (${table.operationOutcome} = 'stale' and ${table.replayResult} = 'stored_stale')
      )`
    ),
    check(
      "profile_handle_operations_note_check",
      sql`${table.operatorNote} is null
        or (
          char_length(trim(${table.operatorNote})) > 0
          and ${table.operatorNote} not regexp '[[:cntrl:]]'
        )`
    )
  ]
);

export const profileHandleTransitionEvents = mysqlTable(
  "profile_handle_transition_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    operationId: profileHandleOperationId("operation_id").notNull(),
    eventSequence: int("event_sequence").notNull(),
    transitionType: mysqlEnum("transition_type", [
      "owner_reserved",
      "reservation_released",
      "reservation_changed_from",
      "reservation_changed_to",
      "owner_assigned",
      "expired_reuse_assigned",
      "renamed_from",
      "renamed_to",
      "manual_retired"
    ]).notNull(),
    detailOutcome: mysqlEnum("detail_outcome", [
      "applied",
      "denied",
      "invalid",
      "not_found",
      "conflict",
      "stale"
    ]).notNull(),
    handle: asciiHandle("handle", { length: 32 }).notNull(),
    relatedHandle: asciiHandle("related_handle", { length: 32 }),
    priorState: mysqlEnum("prior_state", ["none", "active", "reserved", "retired"]).notNull(),
    priorUserIdSnapshot: domainUserIdSnapshot("prior_user_id_snapshot"),
    priorTransitionKind: mysqlEnum("prior_transition_kind", [
      "owner_reserved",
      "policy_reserved",
      "owner_assigned",
      "expired_reuse_assigned",
      "renamed",
      "deleted_user",
      "admin_retired"
    ]),
    priorReusableAfter: timestamp("prior_reusable_after"),
    newState: mysqlEnum("new_state", ["none", "active", "reserved", "retired"]).notNull(),
    newUserIdSnapshot: domainUserIdSnapshot("new_user_id_snapshot"),
    newTransitionKind: mysqlEnum("new_transition_kind", [
      "owner_reserved",
      "policy_reserved",
      "owner_assigned",
      "expired_reuse_assigned",
      "renamed",
      "deleted_user",
      "admin_retired"
    ]),
    newReusableAfter: timestamp("new_reusable_after"),
    occurredAt: timestamp("occurred_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow()
  },
  (table) => [
    foreignKey({
      name: "profile_handle_events_operation_fk",
      columns: [table.operationId],
      foreignColumns: [profileHandleOperations.id]
    }).onDelete("no action").onUpdate("no action"),
    uniqueIndex("profile_handle_events_operation_sequence_uidx").on(table.operationId, table.eventSequence),
    uniqueIndex("profile_handle_events_operation_handle_type_uidx").on(
      table.operationId,
      table.handle,
      table.transitionType
    ),
    index("profile_handle_events_operation_idx").on(table.operationId),
    index("profile_handle_events_handle_occurred_idx").on(table.handle, table.occurredAt),
    index("profile_handle_events_related_handle_idx").on(table.relatedHandle),
    check("profile_handle_events_sequence_check", sql`${table.eventSequence} > 0`),
    check(
      "profile_handle_events_handle_check",
      sql`${table.handle} regexp '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'
        and ${table.handle} not regexp '--'
        and ${table.handle} = lower(${table.handle})`
    ),
    check(
      "profile_handle_events_related_handle_check",
      sql`${table.relatedHandle} is null
        or (
          ${table.relatedHandle} regexp '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'
          and ${table.relatedHandle} not regexp '--'
          and ${table.relatedHandle} = lower(${table.relatedHandle})
        )`
    ),
    check(
      "profile_handle_events_prior_state_shape_check",
      sql`(
        (${table.priorState} = 'none'
          and ${table.priorUserIdSnapshot} is null
          and ${table.priorTransitionKind} is null
          and ${table.priorReusableAfter} is null)
        or (${table.priorState} = 'active'
          and ${table.priorUserIdSnapshot} is not null
          and ${table.priorTransitionKind} in ('owner_assigned', 'expired_reuse_assigned')
          and ${table.priorReusableAfter} is null)
        or (${table.priorState} = 'reserved'
          and ${table.priorUserIdSnapshot} is null
          and ${table.priorTransitionKind} in ('owner_reserved', 'policy_reserved')
          and ${table.priorReusableAfter} is null)
        or (${table.priorState} = 'retired'
          and ${table.priorUserIdSnapshot} is null
          and ${table.priorTransitionKind} in ('renamed', 'deleted_user', 'admin_retired')
          and ${table.priorReusableAfter} is not null)
      )`
    ),
    check(
      "profile_handle_events_new_state_shape_check",
      sql`(
        (${table.newState} = 'none'
          and ${table.newUserIdSnapshot} is null
          and ${table.newTransitionKind} is null
          and ${table.newReusableAfter} is null)
        or (${table.newState} = 'active'
          and ${table.newUserIdSnapshot} is not null
          and ${table.newTransitionKind} in ('owner_assigned', 'expired_reuse_assigned')
          and ${table.newReusableAfter} is null)
        or (${table.newState} = 'reserved'
          and ${table.newUserIdSnapshot} is null
          and ${table.newTransitionKind} in ('owner_reserved', 'policy_reserved')
          and ${table.newReusableAfter} is null)
        or (${table.newState} = 'retired'
          and ${table.newUserIdSnapshot} is null
          and ${table.newTransitionKind} in ('renamed', 'deleted_user', 'admin_retired')
          and ${table.newReusableAfter} is not null)
      )`
    ),
    check(
      "profile_handle_events_transition_shape_check",
      sql`(
        (${table.detailOutcome} = 'applied'
          and ${table.transitionType} = 'owner_reserved'
          and ${table.priorState} = 'none'
          and ${table.newState} = 'reserved'
          and ${table.newTransitionKind} = 'owner_reserved')
        or (${table.detailOutcome} = 'applied'
          and ${table.transitionType} = 'reservation_released'
          and ${table.priorState} = 'reserved'
          and ${table.newState} = 'none')
        or (${table.detailOutcome} = 'applied'
          and ${table.transitionType} = 'reservation_changed_from'
          and ${table.priorState} = 'reserved'
          and ${table.newState} = 'none'
          and ${table.relatedHandle} is not null)
        or (${table.detailOutcome} = 'applied'
          and ${table.transitionType} = 'reservation_changed_to'
          and ${table.priorState} = 'none'
          and ${table.newState} = 'reserved'
          and ${table.newTransitionKind} in ('owner_reserved', 'policy_reserved')
          and ${table.relatedHandle} is not null)
        or (${table.detailOutcome} = 'applied'
          and ${table.transitionType} = 'owner_assigned'
          and ${table.priorState} in ('none', 'reserved')
          and ${table.newState} = 'active'
          and ${table.newTransitionKind} = 'owner_assigned')
        or (${table.detailOutcome} = 'applied'
          and ${table.transitionType} = 'expired_reuse_assigned'
          and ${table.priorState} = 'retired'
          and ${table.newState} = 'active'
          and ${table.newTransitionKind} = 'expired_reuse_assigned')
        or (${table.detailOutcome} = 'applied'
          and ${table.transitionType} = 'renamed_from'
          and ${table.priorState} = 'active'
          and ${table.newState} = 'retired'
          and ${table.newTransitionKind} = 'renamed'
          and ${table.relatedHandle} is not null)
        or (${table.detailOutcome} = 'applied'
          and ${table.transitionType} = 'renamed_to'
          and ${table.newState} = 'active'
          and (
            (${table.priorState} in ('none', 'reserved')
              and ${table.newTransitionKind} = 'owner_assigned')
            or (${table.priorState} = 'retired'
              and ${table.newTransitionKind} = 'expired_reuse_assigned')
          )
          and ${table.relatedHandle} is not null)
        or (${table.detailOutcome} = 'applied'
          and ${table.transitionType} = 'manual_retired'
          and ${table.priorState} = 'active'
          and ${table.newState} = 'retired'
          and ${table.newTransitionKind} = 'admin_retired')
        or (${table.detailOutcome} <> 'applied'
          and ${table.newState} = ${table.priorState}
          and ${table.newUserIdSnapshot} <=> ${table.priorUserIdSnapshot}
          and ${table.newTransitionKind} <=> ${table.priorTransitionKind}
          and ${table.newReusableAfter} <=> ${table.priorReusableAfter})
      )`
    )
  ]
);
