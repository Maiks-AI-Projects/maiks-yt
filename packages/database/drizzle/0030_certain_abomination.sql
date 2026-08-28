CREATE TABLE `profile_handle_operations` (
	`id` varchar(36) character set utf8mb4 collate utf8mb4_general_ci NOT NULL,
	`operation_version` int NOT NULL DEFAULT 1,
	`idempotency_key` varchar(128) NOT NULL,
	`request_fingerprint_sha256` varchar(64) NOT NULL,
	`operation_type` enum('owner_reserve_handle','owner_release_reservation','owner_change_reservation','owner_assign_handle','owner_rename_handle','owner_retire_handle','owner_reuse_retired_handle') NOT NULL,
	`operation_outcome` enum('applied','denied','invalid','not_found','conflict','stale') NOT NULL,
	`expected_detail_count` int NOT NULL,
	`actor_kind` enum('owner') NOT NULL,
	`actor_user_id_snapshot` varchar(36) character set utf8mb4 collate utf8mb4_general_ci NOT NULL,
	`actor_authority_snapshot` enum('owner') NOT NULL,
	`subject_user_id_snapshot` varchar(36) character set utf8mb4 collate utf8mb4_general_ci,
	`subject_boundary` enum('user_handle','reserved_handle','retired_handle','normalized_missing_subject') NOT NULL,
	`reason_code` enum('owner_brand_reservation','owner_manual_assignment','owner_manual_rename','owner_manual_retirement','reservation_cleanup','invalid_request','authority_denied','handle_unavailable','concurrency_retry') NOT NULL,
	`operator_note` varchar(280),
	`requested_at` timestamp NOT NULL,
	`replay_result` enum('stored_applied','stored_denied','stored_invalid','stored_not_found','stored_conflict','stored_stale') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `profile_handle_operations_id` PRIMARY KEY(`id`),
	CONSTRAINT `profile_handle_operations_idempotency_key_uidx` UNIQUE(`idempotency_key`),
	CONSTRAINT `profile_handle_operations_version_check` CHECK(`profile_handle_operations`.`operation_version` = 1),
	CONSTRAINT `profile_handle_operations_fingerprint_check` CHECK(length(`profile_handle_operations`.`request_fingerprint_sha256`) = 64
        and `profile_handle_operations`.`request_fingerprint_sha256` regexp '^[0-9a-f]{64}$'),
	CONSTRAINT `profile_handle_operations_detail_count_check` CHECK((
        (`profile_handle_operations`.`operation_outcome` = 'applied' and `profile_handle_operations`.`operation_type` in (
          'owner_reserve_handle',
          'owner_release_reservation',
          'owner_assign_handle',
          'owner_retire_handle',
          'owner_reuse_retired_handle'
        ) and `profile_handle_operations`.`expected_detail_count` = 1)
        or (`profile_handle_operations`.`operation_outcome` = 'applied' and `profile_handle_operations`.`operation_type` in (
          'owner_change_reservation',
          'owner_rename_handle'
        ) and `profile_handle_operations`.`expected_detail_count` = 2)
        or (`profile_handle_operations`.`operation_outcome` <> 'applied' and `profile_handle_operations`.`expected_detail_count` >= 0 and `profile_handle_operations`.`expected_detail_count` <= 2)
      )),
	CONSTRAINT `profile_handle_operations_replay_result_check` CHECK((
        (`profile_handle_operations`.`operation_outcome` = 'applied' and `profile_handle_operations`.`replay_result` = 'stored_applied')
        or (`profile_handle_operations`.`operation_outcome` = 'denied' and `profile_handle_operations`.`replay_result` = 'stored_denied')
        or (`profile_handle_operations`.`operation_outcome` = 'invalid' and `profile_handle_operations`.`replay_result` = 'stored_invalid')
        or (`profile_handle_operations`.`operation_outcome` = 'not_found' and `profile_handle_operations`.`replay_result` = 'stored_not_found')
        or (`profile_handle_operations`.`operation_outcome` = 'conflict' and `profile_handle_operations`.`replay_result` = 'stored_conflict')
        or (`profile_handle_operations`.`operation_outcome` = 'stale' and `profile_handle_operations`.`replay_result` = 'stored_stale')
      )),
	CONSTRAINT `profile_handle_operations_note_check` CHECK(`profile_handle_operations`.`operator_note` is null
        or (
          char_length(trim(`profile_handle_operations`.`operator_note`)) > 0
          and `profile_handle_operations`.`operator_note` not regexp '[[:cntrl:]]'
        ))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
--> statement-breakpoint
CREATE TABLE `profile_handle_transition_events` (
	`id` varchar(36) NOT NULL,
	`operation_id` varchar(36) character set utf8mb4 collate utf8mb4_general_ci NOT NULL,
	`event_sequence` int NOT NULL,
	`transition_type` enum('owner_reserved','reservation_released','reservation_changed_from','reservation_changed_to','owner_assigned','expired_reuse_assigned','renamed_from','renamed_to','manual_retired') NOT NULL,
	`detail_outcome` enum('applied','denied','invalid','not_found','conflict','stale') NOT NULL,
	`handle` varchar(32) character set ascii collate ascii_bin NOT NULL,
	`related_handle` varchar(32) character set ascii collate ascii_bin,
	`prior_state` enum('none','active','reserved','retired') NOT NULL,
	`prior_user_id_snapshot` varchar(36) character set utf8mb4 collate utf8mb4_general_ci,
	`prior_transition_kind` enum('owner_reserved','policy_reserved','owner_assigned','expired_reuse_assigned','renamed','deleted_user','admin_retired'),
	`prior_reusable_after` timestamp,
	`new_state` enum('none','active','reserved','retired') NOT NULL,
	`new_user_id_snapshot` varchar(36) character set utf8mb4 collate utf8mb4_general_ci,
	`new_transition_kind` enum('owner_reserved','policy_reserved','owner_assigned','expired_reuse_assigned','renamed','deleted_user','admin_retired'),
	`new_reusable_after` timestamp,
	`occurred_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `profile_handle_transition_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `profile_handle_events_operation_sequence_uidx` UNIQUE(`operation_id`,`event_sequence`),
	CONSTRAINT `profile_handle_events_operation_handle_type_uidx` UNIQUE(`operation_id`,`handle`,`transition_type`),
	CONSTRAINT `profile_handle_events_sequence_check` CHECK(`profile_handle_transition_events`.`event_sequence` > 0),
	CONSTRAINT `profile_handle_events_handle_check` CHECK(`profile_handle_transition_events`.`handle` regexp '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'
        and `profile_handle_transition_events`.`handle` not regexp '--'
        and `profile_handle_transition_events`.`handle` = lower(`profile_handle_transition_events`.`handle`)),
	CONSTRAINT `profile_handle_events_related_handle_check` CHECK(`profile_handle_transition_events`.`related_handle` is null
        or (
          `profile_handle_transition_events`.`related_handle` regexp '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'
          and `profile_handle_transition_events`.`related_handle` not regexp '--'
          and `profile_handle_transition_events`.`related_handle` = lower(`profile_handle_transition_events`.`related_handle`)
        )),
	CONSTRAINT `profile_handle_events_prior_state_shape_check` CHECK((
        (`profile_handle_transition_events`.`prior_state` = 'none'
          and `profile_handle_transition_events`.`prior_user_id_snapshot` is null
          and `profile_handle_transition_events`.`prior_transition_kind` is null
          and `profile_handle_transition_events`.`prior_reusable_after` is null)
        or (`profile_handle_transition_events`.`prior_state` = 'active'
          and `profile_handle_transition_events`.`prior_user_id_snapshot` is not null
          and `profile_handle_transition_events`.`prior_transition_kind` in ('owner_assigned', 'expired_reuse_assigned')
          and `profile_handle_transition_events`.`prior_reusable_after` is null)
        or (`profile_handle_transition_events`.`prior_state` = 'reserved'
          and `profile_handle_transition_events`.`prior_user_id_snapshot` is null
          and `profile_handle_transition_events`.`prior_transition_kind` in ('owner_reserved', 'policy_reserved')
          and `profile_handle_transition_events`.`prior_reusable_after` is null)
        or (`profile_handle_transition_events`.`prior_state` = 'retired'
          and `profile_handle_transition_events`.`prior_user_id_snapshot` is null
          and `profile_handle_transition_events`.`prior_transition_kind` in ('renamed', 'deleted_user', 'admin_retired')
          and `profile_handle_transition_events`.`prior_reusable_after` is not null)
      )),
	CONSTRAINT `profile_handle_events_new_state_shape_check` CHECK((
        (`profile_handle_transition_events`.`new_state` = 'none'
          and `profile_handle_transition_events`.`new_user_id_snapshot` is null
          and `profile_handle_transition_events`.`new_transition_kind` is null
          and `profile_handle_transition_events`.`new_reusable_after` is null)
        or (`profile_handle_transition_events`.`new_state` = 'active'
          and `profile_handle_transition_events`.`new_user_id_snapshot` is not null
          and `profile_handle_transition_events`.`new_transition_kind` in ('owner_assigned', 'expired_reuse_assigned')
          and `profile_handle_transition_events`.`new_reusable_after` is null)
        or (`profile_handle_transition_events`.`new_state` = 'reserved'
          and `profile_handle_transition_events`.`new_user_id_snapshot` is null
          and `profile_handle_transition_events`.`new_transition_kind` in ('owner_reserved', 'policy_reserved')
          and `profile_handle_transition_events`.`new_reusable_after` is null)
        or (`profile_handle_transition_events`.`new_state` = 'retired'
          and `profile_handle_transition_events`.`new_user_id_snapshot` is null
          and `profile_handle_transition_events`.`new_transition_kind` in ('renamed', 'deleted_user', 'admin_retired')
          and `profile_handle_transition_events`.`new_reusable_after` is not null)
      )),
	CONSTRAINT `profile_handle_events_transition_shape_check` CHECK((
        (`profile_handle_transition_events`.`detail_outcome` = 'applied'
          and `profile_handle_transition_events`.`transition_type` = 'owner_reserved'
          and `profile_handle_transition_events`.`prior_state` = 'none'
          and `profile_handle_transition_events`.`new_state` = 'reserved'
          and `profile_handle_transition_events`.`new_transition_kind` = 'owner_reserved')
        or (`profile_handle_transition_events`.`detail_outcome` = 'applied'
          and `profile_handle_transition_events`.`transition_type` = 'reservation_released'
          and `profile_handle_transition_events`.`prior_state` = 'reserved'
          and `profile_handle_transition_events`.`new_state` = 'none')
        or (`profile_handle_transition_events`.`detail_outcome` = 'applied'
          and `profile_handle_transition_events`.`transition_type` = 'reservation_changed_from'
          and `profile_handle_transition_events`.`prior_state` = 'reserved'
          and `profile_handle_transition_events`.`new_state` = 'none'
          and `profile_handle_transition_events`.`related_handle` is not null)
        or (`profile_handle_transition_events`.`detail_outcome` = 'applied'
          and `profile_handle_transition_events`.`transition_type` = 'reservation_changed_to'
          and `profile_handle_transition_events`.`prior_state` = 'none'
          and `profile_handle_transition_events`.`new_state` = 'reserved'
          and `profile_handle_transition_events`.`new_transition_kind` in ('owner_reserved', 'policy_reserved')
          and `profile_handle_transition_events`.`related_handle` is not null)
        or (`profile_handle_transition_events`.`detail_outcome` = 'applied'
          and `profile_handle_transition_events`.`transition_type` = 'owner_assigned'
          and `profile_handle_transition_events`.`prior_state` in ('none', 'reserved')
          and `profile_handle_transition_events`.`new_state` = 'active'
          and `profile_handle_transition_events`.`new_transition_kind` = 'owner_assigned')
        or (`profile_handle_transition_events`.`detail_outcome` = 'applied'
          and `profile_handle_transition_events`.`transition_type` = 'expired_reuse_assigned'
          and `profile_handle_transition_events`.`prior_state` = 'retired'
          and `profile_handle_transition_events`.`new_state` = 'active'
          and `profile_handle_transition_events`.`new_transition_kind` = 'expired_reuse_assigned')
        or (`profile_handle_transition_events`.`detail_outcome` = 'applied'
          and `profile_handle_transition_events`.`transition_type` = 'renamed_from'
          and `profile_handle_transition_events`.`prior_state` = 'active'
          and `profile_handle_transition_events`.`new_state` = 'retired'
          and `profile_handle_transition_events`.`new_transition_kind` = 'renamed'
          and `profile_handle_transition_events`.`related_handle` is not null)
        or (`profile_handle_transition_events`.`detail_outcome` = 'applied'
          and `profile_handle_transition_events`.`transition_type` = 'renamed_to'
          and `profile_handle_transition_events`.`new_state` = 'active'
          and (
            (`profile_handle_transition_events`.`prior_state` in ('none', 'reserved')
              and `profile_handle_transition_events`.`new_transition_kind` = 'owner_assigned')
            or (`profile_handle_transition_events`.`prior_state` = 'retired'
              and `profile_handle_transition_events`.`new_transition_kind` = 'expired_reuse_assigned')
          )
          and `profile_handle_transition_events`.`related_handle` is not null)
        or (`profile_handle_transition_events`.`detail_outcome` = 'applied'
          and `profile_handle_transition_events`.`transition_type` = 'manual_retired'
          and `profile_handle_transition_events`.`prior_state` = 'active'
          and `profile_handle_transition_events`.`new_state` = 'retired'
          and `profile_handle_transition_events`.`new_transition_kind` = 'admin_retired')
        or (`profile_handle_transition_events`.`detail_outcome` <> 'applied'
          and `profile_handle_transition_events`.`new_state` = `profile_handle_transition_events`.`prior_state`
          and `profile_handle_transition_events`.`new_user_id_snapshot` <=> `profile_handle_transition_events`.`prior_user_id_snapshot`
          and `profile_handle_transition_events`.`new_transition_kind` <=> `profile_handle_transition_events`.`prior_transition_kind`
          and `profile_handle_transition_events`.`new_reusable_after` <=> `profile_handle_transition_events`.`prior_reusable_after`)
      ))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
--> statement-breakpoint
CREATE TABLE `profile_handles` (
	`handle` varchar(32) character set ascii collate ascii_bin NOT NULL,
	`state` enum('active','reserved','retired') NOT NULL,
	`user_id` varchar(36) character set utf8mb4 collate utf8mb4_general_ci,
	`reserved_at` timestamp,
	`assigned_at` timestamp,
	`retired_at` timestamp,
	`reusable_after` timestamp,
	`transition_kind` enum('owner_reserved','policy_reserved','owner_assigned','expired_reuse_assigned','renamed','deleted_user','admin_retired') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `profile_handles_handle` PRIMARY KEY(`handle`),
	CONSTRAINT `profile_handles_user_id_uidx` UNIQUE(`user_id`),
	CONSTRAINT `profile_handles_handle_ascii_check` CHECK(`profile_handles`.`handle` regexp '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'
        and `profile_handles`.`handle` not regexp '--'
        and `profile_handles`.`handle` = lower(`profile_handles`.`handle`)),
	CONSTRAINT `profile_handles_state_shape_check` CHECK((
        (
          `profile_handles`.`state` = 'active'
          and `profile_handles`.`user_id` is not null
          and `profile_handles`.`reserved_at` is null
          and `profile_handles`.`assigned_at` is not null
          and `profile_handles`.`retired_at` is null
          and `profile_handles`.`reusable_after` is null
          and `profile_handles`.`transition_kind` in ('owner_assigned', 'expired_reuse_assigned')
        )
        or (
          `profile_handles`.`state` = 'reserved'
          and `profile_handles`.`user_id` is null
          and `profile_handles`.`reserved_at` is not null
          and `profile_handles`.`assigned_at` is null
          and `profile_handles`.`retired_at` is null
          and `profile_handles`.`reusable_after` is null
          and `profile_handles`.`transition_kind` in ('owner_reserved', 'policy_reserved')
        )
        or (
          `profile_handles`.`state` = 'retired'
          and `profile_handles`.`user_id` is null
          and `profile_handles`.`reserved_at` is null
          and `profile_handles`.`assigned_at` is null
          and `profile_handles`.`retired_at` is not null
          and `profile_handles`.`reusable_after` is not null
          and `profile_handles`.`reusable_after` >= `profile_handles`.`retired_at` + interval 1 year
          and `profile_handles`.`transition_kind` in ('renamed', 'deleted_user', 'admin_retired')
        )
      ))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
--> statement-breakpoint
ALTER TABLE `profile_handle_transition_events` ADD CONSTRAINT `profile_handle_events_operation_fk` FOREIGN KEY (`operation_id`) REFERENCES `profile_handle_operations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `profile_handle_operations_requested_at_idx` ON `profile_handle_operations` (`requested_at`);--> statement-breakpoint
CREATE INDEX `profile_handle_operations_actor_requested_idx` ON `profile_handle_operations` (`actor_user_id_snapshot`,`requested_at`);--> statement-breakpoint
CREATE INDEX `profile_handle_operations_subject_requested_idx` ON `profile_handle_operations` (`subject_user_id_snapshot`,`requested_at`);--> statement-breakpoint
CREATE INDEX `profile_handle_events_operation_idx` ON `profile_handle_transition_events` (`operation_id`);--> statement-breakpoint
CREATE INDEX `profile_handle_events_handle_occurred_idx` ON `profile_handle_transition_events` (`handle`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `profile_handle_events_related_handle_idx` ON `profile_handle_transition_events` (`related_handle`);--> statement-breakpoint
CREATE INDEX `profile_handles_state_reusable_idx` ON `profile_handles` (`state`,`reusable_after`);--> statement-breakpoint
CREATE INDEX `profile_handles_user_state_idx` ON `profile_handles` (`user_id`,`state`);--> statement-breakpoint
CREATE TRIGGER `profile_handle_operations_reject_update`
BEFORE UPDATE ON `profile_handle_operations`
FOR EACH ROW
BEGIN
	SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'profile_handle_operations is append-only';
END;--> statement-breakpoint
CREATE TRIGGER `profile_handle_operations_reject_delete`
BEFORE DELETE ON `profile_handle_operations`
FOR EACH ROW
BEGIN
	SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'profile_handle_operations is append-only';
END;--> statement-breakpoint
CREATE TRIGGER `profile_handle_transition_events_reject_update`
BEFORE UPDATE ON `profile_handle_transition_events`
FOR EACH ROW
BEGIN
	SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'profile_handle_transition_events is append-only';
END;--> statement-breakpoint
CREATE TRIGGER `profile_handle_transition_events_reject_delete`
BEFORE DELETE ON `profile_handle_transition_events`
FOR EACH ROW
BEGIN
	SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'profile_handle_transition_events is append-only';
END;
