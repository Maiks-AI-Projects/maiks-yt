CREATE TABLE `stream_schedule_entries` (
	`id` varchar(36) NOT NULL,
	`title` varchar(191) NOT NULL,
	`description` text,
	`starts_at` timestamp NOT NULL,
	`ends_at` timestamp,
	`channel_key` varchar(80) NOT NULL,
	`topic_key` varchar(80),
	`theme_key` varchar(80),
	`visibility` enum('draft','public','private') NOT NULL DEFAULT 'draft',
	`status` enum('planned','live','completed','cancelled') NOT NULL DEFAULT 'planned',
	`cancellation_reason_code` enum('health','family','energy','technical','schedule-conflict','other'),
	`cancellation_reason` varchar(500),
	`created_by_user_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stream_schedule_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `stream_schedule_time_window_check` CHECK(`stream_schedule_entries`.`ends_at` is null or `stream_schedule_entries`.`ends_at` > `stream_schedule_entries`.`starts_at`),
	CONSTRAINT `stream_schedule_cancellation_check` CHECK((
        (
          `stream_schedule_entries`.`status` = 'cancelled'
          and `stream_schedule_entries`.`cancellation_reason_code` is not null
          and `stream_schedule_entries`.`cancellation_reason` is not null
          and trim(`stream_schedule_entries`.`cancellation_reason`) <> ''
        )
        or
        (
          `stream_schedule_entries`.`status` <> 'cancelled'
          and `stream_schedule_entries`.`cancellation_reason_code` is null
          and `stream_schedule_entries`.`cancellation_reason` is null
        )
      ))
);
--> statement-breakpoint
CREATE INDEX `stream_schedule_public_starts_idx` ON `stream_schedule_entries` (`visibility`,`starts_at`);--> statement-breakpoint
CREATE INDEX `stream_schedule_status_idx` ON `stream_schedule_entries` (`status`);--> statement-breakpoint
CREATE INDEX `stream_schedule_channel_idx` ON `stream_schedule_entries` (`channel_key`);