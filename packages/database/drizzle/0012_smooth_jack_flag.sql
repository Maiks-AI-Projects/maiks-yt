CREATE TABLE `event_approval_queue` (
	`id` varchar(36) NOT NULL,
	`event_history_id` varchar(36) NOT NULL,
	`routing_rule_id` varchar(36),
	`destination` enum('ignore','internal_audit','control_panel','top_notification','center_notification','streamer_feed','streamer_chat','approval_queue') NOT NULL,
	`status` enum('pending','approved','rejected','expired','cancelled') NOT NULL DEFAULT 'pending',
	`reviewer_user_id` varchar(36),
	`reviewed_at` timestamp,
	`review_note` varchar(1000),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `event_approval_queue_id` PRIMARY KEY(`id`),
	CONSTRAINT `event_approval_queue_history_uidx` UNIQUE(`event_history_id`),
	CONSTRAINT `event_approval_queue_review_state_check` CHECK((
        (
          `event_approval_queue`.`status` = 'pending'
          and `event_approval_queue`.`reviewer_user_id` is null
          and `event_approval_queue`.`reviewed_at` is null
          and `event_approval_queue`.`review_note` is null
        )
        or
        (
          `event_approval_queue`.`status` <> 'pending'
          and `event_approval_queue`.`reviewed_at` is not null
        )
      ))
);
--> statement-breakpoint
CREATE TABLE `event_cooldown_state` (
	`id` varchar(36) NOT NULL,
	`routing_rule_id` varchar(36) NOT NULL,
	`event_kind` enum('chat','website.signup','website.username-change','website.profile-image-update','website.project-update-published','website.schedule-changed','website.schedule-cancelled','website.action-panel-item','website.free-tts-request','website.account-security-change','website.provider-token-change','twitch.follow','twitch.sub','twitch.bits','twitch.raid','twitch.redeem','youtube.subscriber','youtube.member','youtube.super-chat','youtube.super-sticker','discord.message','discord.join','discord.role','discord.boost','simulated.support-money') NOT NULL,
	`source_platform` enum('twitch','youtube','discord','website','test/system') NOT NULL,
	`scope` enum('global','user','stream','user_stream') NOT NULL,
	`cooldown_key` varchar(191) NOT NULL,
	`actor_user_id` varchar(36),
	`actor_external_id` varchar(191),
	`stream_session_id` varchar(36),
	`stream_schedule_entry_id` varchar(36),
	`window_started_at` timestamp NOT NULL,
	`window_ends_at` timestamp NOT NULL,
	`hit_count` int NOT NULL DEFAULT 0,
	`last_event_history_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `event_cooldown_state_id` PRIMARY KEY(`id`),
	CONSTRAINT `event_cooldown_state_rule_key_uidx` UNIQUE(`routing_rule_id`,`cooldown_key`),
	CONSTRAINT `event_cooldown_state_window_check` CHECK(`event_cooldown_state`.`window_ends_at` > `event_cooldown_state`.`window_started_at`),
	CONSTRAINT `event_cooldown_state_hit_count_check` CHECK(`event_cooldown_state`.`hit_count` >= 0)
);
--> statement-breakpoint
CREATE TABLE `event_history` (
	`id` varchar(36) NOT NULL,
	`source_platform` enum('twitch','youtube','discord','website','test/system') NOT NULL,
	`event_kind` enum('chat','website.signup','website.username-change','website.profile-image-update','website.project-update-published','website.schedule-changed','website.schedule-cancelled','website.action-panel-item','website.free-tts-request','website.account-security-change','website.provider-token-change','twitch.follow','twitch.sub','twitch.bits','twitch.raid','twitch.redeem','youtube.subscriber','youtube.member','youtube.super-chat','youtube.super-sticker','discord.message','discord.join','discord.role','discord.boost','simulated.support-money') NOT NULL,
	`source_event_id` varchar(191),
	`routing_rule_id` varchar(36),
	`routing_outcome` enum('ignored','stored_internal','routed','queued_for_approval','blocked_opt_out','blocked_cooldown','blocked_safety','failed') NOT NULL DEFAULT 'stored_internal',
	`destination` enum('ignore','internal_audit','control_panel','top_notification','center_notification','streamer_feed','streamer_chat','approval_queue'),
	`actor_user_id` varchar(36),
	`actor_external_id` varchar(191),
	`actor_display_name` varchar(191),
	`user_id` varchar(36),
	`stream_session_id` varchar(36),
	`stream_schedule_entry_id` varchar(36),
	`session_id` varchar(191),
	`is_test` boolean NOT NULL DEFAULT false,
	`is_simulated` boolean NOT NULL DEFAULT false,
	`is_real_money` boolean NOT NULL DEFAULT false,
	`test_resettable` boolean NOT NULL DEFAULT false,
	`redacted_payload` json NOT NULL,
	`occurred_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `event_history_id` PRIMARY KEY(`id`),
	CONSTRAINT `event_history_destination_outcome_check` CHECK((
        (
          `event_history`.`routing_outcome` in ('ignored', 'blocked_opt_out', 'blocked_cooldown', 'blocked_safety', 'failed')
          and `event_history`.`destination` is null
        )
        or
        (
          `event_history`.`routing_outcome` in ('stored_internal', 'routed', 'queued_for_approval')
          and `event_history`.`destination` is not null
        )
      )),
	CONSTRAINT `event_history_simulated_money_check` CHECK(not (`event_history`.`is_real_money` = true and (`event_history`.`is_test` = true or `event_history`.`is_simulated` = true))),
	CONSTRAINT `event_history_test_reset_boundary_check` CHECK((
        `event_history`.`test_resettable` = false
        or (
          (`event_history`.`is_test` = true or `event_history`.`is_simulated` = true)
          and `event_history`.`is_real_money` = false
        )
      ))
);
--> statement-breakpoint
CREATE TABLE `event_routing_rules` (
	`id` varchar(36) NOT NULL,
	`event_kind` enum('chat','website.signup','website.username-change','website.profile-image-update','website.project-update-published','website.schedule-changed','website.schedule-cancelled','website.action-panel-item','website.free-tts-request','website.account-security-change','website.provider-token-change','twitch.follow','twitch.sub','twitch.bits','twitch.raid','twitch.redeem','youtube.subscriber','youtube.member','youtube.super-chat','youtube.super-sticker','discord.message','discord.join','discord.role','discord.boost','simulated.support-money') NOT NULL,
	`source_platform` enum('any','twitch','youtube','discord','website','test/system') NOT NULL DEFAULT 'any',
	`destination` enum('ignore','internal_audit','control_panel','top_notification','center_notification','streamer_feed','streamer_chat','approval_queue') NOT NULL DEFAULT 'internal_audit',
	`enabled` boolean NOT NULL DEFAULT false,
	`live_only` boolean NOT NULL DEFAULT false,
	`offline_only` boolean NOT NULL DEFAULT false,
	`approval_required` boolean NOT NULL DEFAULT true,
	`per_user_cooldown_seconds` int,
	`global_cooldown_seconds` int,
	`once_per_stream` boolean NOT NULL DEFAULT false,
	`template_key` varchar(80),
	`theme_key` varchar(80),
	`sound_key` varchar(80),
	`notification_priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`created_by_user_id` varchar(36),
	`updated_by_user_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `event_routing_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `event_routing_rules_kind_source_uidx` UNIQUE(`event_kind`,`source_platform`),
	CONSTRAINT `event_routing_rules_live_window_check` CHECK(not (`event_routing_rules`.`live_only` = true and `event_routing_rules`.`offline_only` = true)),
	CONSTRAINT `event_routing_rules_per_user_cooldown_check` CHECK(`event_routing_rules`.`per_user_cooldown_seconds` is null or `event_routing_rules`.`per_user_cooldown_seconds` >= 0),
	CONSTRAINT `event_routing_rules_global_cooldown_check` CHECK(`event_routing_rules`.`global_cooldown_seconds` is null or `event_routing_rules`.`global_cooldown_seconds` >= 0),
	CONSTRAINT `event_routing_rules_internal_only_destination_check` CHECK((
        `event_routing_rules`.`event_kind` not in (
          'website.account-security-change',
          'website.provider-token-change',
          'website.action-panel-item',
          'discord.role'
        )
        or `event_routing_rules`.`destination` in ('ignore', 'internal_audit', 'control_panel')
      ))
);
--> statement-breakpoint
CREATE TABLE `event_user_opt_outs` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`event_kind` enum('all_stream_visible_website_events','website.signup','website.username-change','website.profile-image-update','website.free-tts-request') NOT NULL DEFAULT 'all_stream_visible_website_events',
	`opted_out` boolean NOT NULL DEFAULT true,
	`reason` varchar(191),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `event_user_opt_outs_id` PRIMARY KEY(`id`),
	CONSTRAINT `event_user_opt_outs_user_kind_uidx` UNIQUE(`user_id`,`event_kind`)
);
--> statement-breakpoint
CREATE INDEX `event_approval_queue_status_created_idx` ON `event_approval_queue` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `event_approval_queue_reviewer_idx` ON `event_approval_queue` (`reviewer_user_id`);--> statement-breakpoint
CREATE INDEX `event_approval_queue_rule_idx` ON `event_approval_queue` (`routing_rule_id`);--> statement-breakpoint
CREATE INDEX `event_cooldown_state_window_idx` ON `event_cooldown_state` (`window_ends_at`);--> statement-breakpoint
CREATE INDEX `event_cooldown_state_event_kind_idx` ON `event_cooldown_state` (`event_kind`);--> statement-breakpoint
CREATE INDEX `event_cooldown_state_actor_user_idx` ON `event_cooldown_state` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `event_cooldown_state_stream_session_idx` ON `event_cooldown_state` (`stream_session_id`);--> statement-breakpoint
CREATE INDEX `event_history_source_kind_created_idx` ON `event_history` (`source_platform`,`event_kind`,`created_at`);--> statement-breakpoint
CREATE INDEX `event_history_actor_user_idx` ON `event_history` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `event_history_user_idx` ON `event_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `event_history_stream_session_idx` ON `event_history` (`stream_session_id`);--> statement-breakpoint
CREATE INDEX `event_history_stream_schedule_entry_idx` ON `event_history` (`stream_schedule_entry_id`);--> statement-breakpoint
CREATE INDEX `event_history_routing_rule_idx` ON `event_history` (`routing_rule_id`);--> statement-breakpoint
CREATE INDEX `event_history_test_resettable_idx` ON `event_history` (`test_resettable`,`created_at`);--> statement-breakpoint
CREATE INDEX `event_routing_rules_destination_idx` ON `event_routing_rules` (`destination`);--> statement-breakpoint
CREATE INDEX `event_routing_rules_enabled_idx` ON `event_routing_rules` (`enabled`);--> statement-breakpoint
CREATE INDEX `event_user_opt_outs_user_id_idx` ON `event_user_opt_outs` (`user_id`);--> statement-breakpoint
CREATE INDEX `event_user_opt_outs_event_kind_idx` ON `event_user_opt_outs` (`event_kind`);