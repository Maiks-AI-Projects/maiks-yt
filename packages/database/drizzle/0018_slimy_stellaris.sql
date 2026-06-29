CREATE TABLE `moderation_active_states` (
	`id` varchar(36) NOT NULL,
	`source` enum('fake-local','website','twitch','youtube','discord','system') NOT NULL,
	`state_kind` enum('message_hidden','author_muted','user_restricted','user_banned') NOT NULL,
	`status` enum('active','expired','revoked','appealed','reviewed') NOT NULL DEFAULT 'active',
	`target_user_id` varchar(36),
	`target_author_name` varchar(191),
	`target_message_id` varchar(191),
	`target_external_id` varchar(191),
	`stream_session_id` varchar(36),
	`active_from` timestamp NOT NULL DEFAULT (now()),
	`active_until` timestamp,
	`duration_seconds` int,
	`reason` varchar(280),
	`note` varchar(280),
	`created_audit_log_id` varchar(36) NOT NULL,
	`last_audit_log_id` varchar(36) NOT NULL,
	`revoked_audit_log_id` varchar(36),
	`revoked_at` timestamp,
	`revoked_by_user_id` varchar(36),
	`revocation_reason` varchar(280),
	`appeal_status` enum('none','pending','accepted','rejected','withdrawn') NOT NULL DEFAULT 'none',
	`appeal_note` varchar(280),
	`reviewed_by_user_id` varchar(36),
	`reviewed_at` timestamp,
	`provider_action` boolean NOT NULL DEFAULT false,
	`provider_action_id` varchar(191),
	`provider_state_id` varchar(191),
	`is_test` boolean NOT NULL DEFAULT false,
	`is_simulated` boolean NOT NULL DEFAULT false,
	`test_resettable` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `moderation_active_states_id` PRIMARY KEY(`id`),
	CONSTRAINT `moderation_active_duration_check` CHECK(`moderation_active_states`.`duration_seconds` is null or `moderation_active_states`.`duration_seconds` >= 0),
	CONSTRAINT `moderation_active_until_check` CHECK(`moderation_active_states`.`active_until` is null or `moderation_active_states`.`active_until` >= `moderation_active_states`.`active_from`),
	CONSTRAINT `moderation_active_temporary_state_check` CHECK((
        `moderation_active_states`.`state_kind` not in ('author_muted', 'user_restricted')
        or (`moderation_active_states`.`duration_seconds` is not null and `moderation_active_states`.`active_until` is not null)
      )),
	CONSTRAINT `moderation_active_fake_local_boundary_check` CHECK(`moderation_active_states`.`source` <> 'fake-local' or (`moderation_active_states`.`provider_action` = false and `moderation_active_states`.`is_test` = true and `moderation_active_states`.`is_simulated` = true and `moderation_active_states`.`test_resettable` = true)),
	CONSTRAINT `moderation_active_test_reset_boundary_check` CHECK((
        `moderation_active_states`.`test_resettable` = false
        or (
          (`moderation_active_states`.`is_test` = true or `moderation_active_states`.`is_simulated` = true)
          and `moderation_active_states`.`provider_action` = false
        )
      )),
	CONSTRAINT `moderation_active_provider_action_check` CHECK((
        (`moderation_active_states`.`provider_action` = false and `moderation_active_states`.`provider_action_id` is null and `moderation_active_states`.`provider_state_id` is null)
        or
        (`moderation_active_states`.`provider_action` = true and `moderation_active_states`.`source` in ('website', 'twitch', 'youtube', 'discord'))
      )),
	CONSTRAINT `moderation_active_revocation_metadata_check` CHECK((
        (`moderation_active_states`.`revoked_at` is null and `moderation_active_states`.`revoked_by_user_id` is null and `moderation_active_states`.`revoked_audit_log_id` is null and `moderation_active_states`.`revocation_reason` is null)
        or
        (`moderation_active_states`.`revoked_at` is not null and `moderation_active_states`.`revoked_by_user_id` is not null and `moderation_active_states`.`revoked_audit_log_id` is not null)
      )),
	CONSTRAINT `moderation_active_status_revocation_check` CHECK((
        (`moderation_active_states`.`status` = 'active' and `moderation_active_states`.`revoked_at` is null)
        or
        (`moderation_active_states`.`status` = 'revoked' and `moderation_active_states`.`revoked_at` is not null)
        or
        (`moderation_active_states`.`status` not in ('active', 'revoked'))
      )),
	CONSTRAINT `moderation_active_appeal_check` CHECK((
        (`moderation_active_states`.`appeal_status` = 'none' and `moderation_active_states`.`appeal_note` is null and `moderation_active_states`.`status` <> 'appealed')
        or
        (`moderation_active_states`.`appeal_status` <> 'none')
      )),
	CONSTRAINT `moderation_active_review_check` CHECK((
        (`moderation_active_states`.`reviewed_at` is null and `moderation_active_states`.`reviewed_by_user_id` is null and `moderation_active_states`.`status` <> 'reviewed')
        or
        (`moderation_active_states`.`reviewed_at` is not null and `moderation_active_states`.`reviewed_by_user_id` is not null)
      ))
);
--> statement-breakpoint
CREATE INDEX `moderation_active_source_status_until_idx` ON `moderation_active_states` (`source`,`status`,`active_until`);--> statement-breakpoint
CREATE INDEX `moderation_active_target_user_idx` ON `moderation_active_states` (`target_user_id`,`source`,`status`);--> statement-breakpoint
CREATE INDEX `moderation_active_target_author_idx` ON `moderation_active_states` (`target_author_name`,`source`,`status`);--> statement-breakpoint
CREATE INDEX `moderation_active_message_idx` ON `moderation_active_states` (`target_message_id`);--> statement-breakpoint
CREATE INDEX `moderation_active_external_idx` ON `moderation_active_states` (`target_external_id`);--> statement-breakpoint
CREATE INDEX `moderation_active_stream_status_idx` ON `moderation_active_states` (`stream_session_id`,`status`);--> statement-breakpoint
CREATE INDEX `moderation_active_test_resettable_idx` ON `moderation_active_states` (`test_resettable`,`created_at`);--> statement-breakpoint
CREATE INDEX `moderation_active_created_audit_idx` ON `moderation_active_states` (`created_audit_log_id`);--> statement-breakpoint
CREATE INDEX `moderation_active_last_audit_idx` ON `moderation_active_states` (`last_audit_log_id`);--> statement-breakpoint
CREATE INDEX `moderation_active_revoked_audit_idx` ON `moderation_active_states` (`revoked_audit_log_id`);