CREATE TABLE `moderation_audit_logs` (
	`id` varchar(36) NOT NULL,
	`source` enum('fake-local','website','twitch','youtube','discord','system') NOT NULL,
	`action` enum('warn_author','hide_message','temporary_mute_author','note_author','noop','ban_author','unban_author','delete_message','restrict_user','rank_status_change') NOT NULL,
	`outcome` enum('applied','denied','invalid','not_found','no_op','provider_queued','provider_failed','reverted') NOT NULL,
	`actor_user_id` varchar(36),
	`actor_display_name` varchar(191),
	`target_user_id` varchar(36),
	`target_author_name` varchar(191),
	`target_message_id` varchar(191),
	`target_external_id` varchar(191),
	`event_history_id` varchar(36),
	`stream_session_id` varchar(36),
	`duration_seconds` int,
	`active_until` timestamp,
	`reason` varchar(280),
	`note` varchar(280),
	`provider_action` boolean NOT NULL DEFAULT false,
	`provider_action_id` varchar(191),
	`is_test` boolean NOT NULL DEFAULT false,
	`is_simulated` boolean NOT NULL DEFAULT false,
	`test_resettable` boolean NOT NULL DEFAULT false,
	`redacted_context` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `moderation_audit_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `moderation_audit_duration_check` CHECK(`moderation_audit_logs`.`duration_seconds` is null or `moderation_audit_logs`.`duration_seconds` >= 0),
	CONSTRAINT `moderation_audit_temporary_mute_check` CHECK((
        `moderation_audit_logs`.`action` <> 'temporary_mute_author'
        or (`moderation_audit_logs`.`duration_seconds` is not null and `moderation_audit_logs`.`active_until` is not null)
      )),
	CONSTRAINT `moderation_audit_provider_outcome_check` CHECK(`moderation_audit_logs`.`outcome` not in ('provider_queued', 'provider_failed') or `moderation_audit_logs`.`provider_action` = true),
	CONSTRAINT `moderation_audit_provider_action_check` CHECK((
        (`moderation_audit_logs`.`provider_action` = true and `moderation_audit_logs`.`provider_action_id` is not null and `moderation_audit_logs`.`source` in ('twitch', 'youtube', 'discord', 'website'))
        or
        (`moderation_audit_logs`.`provider_action` = false and `moderation_audit_logs`.`provider_action_id` is null)
      )),
	CONSTRAINT `moderation_audit_fake_local_boundary_check` CHECK(`moderation_audit_logs`.`source` <> 'fake-local' or (`moderation_audit_logs`.`provider_action` = false and `moderation_audit_logs`.`is_test` = true and `moderation_audit_logs`.`is_simulated` = true)),
	CONSTRAINT `moderation_audit_test_reset_boundary_check` CHECK((
        `moderation_audit_logs`.`test_resettable` = false
        or (
          (`moderation_audit_logs`.`is_test` = true or `moderation_audit_logs`.`is_simulated` = true)
          and `moderation_audit_logs`.`provider_action` = false
        )
      ))
);
--> statement-breakpoint
CREATE INDEX `moderation_audit_source_created_idx` ON `moderation_audit_logs` (`source`,`created_at`);--> statement-breakpoint
CREATE INDEX `moderation_audit_actor_created_idx` ON `moderation_audit_logs` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `moderation_audit_target_user_created_idx` ON `moderation_audit_logs` (`target_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `moderation_audit_target_author_created_idx` ON `moderation_audit_logs` (`target_author_name`,`created_at`);--> statement-breakpoint
CREATE INDEX `moderation_audit_message_idx` ON `moderation_audit_logs` (`target_message_id`);--> statement-breakpoint
CREATE INDEX `moderation_audit_event_history_idx` ON `moderation_audit_logs` (`event_history_id`);--> statement-breakpoint
CREATE INDEX `moderation_audit_stream_session_idx` ON `moderation_audit_logs` (`stream_session_id`);--> statement-breakpoint
CREATE INDEX `moderation_audit_test_resettable_idx` ON `moderation_audit_logs` (`test_resettable`,`created_at`);