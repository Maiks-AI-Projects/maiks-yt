CREATE TABLE `stream_schedule_channel_targets` (
	`id` varchar(36) NOT NULL,
	`schedule_entry_id` varchar(36) NOT NULL,
	`channel_ref` varchar(36) NOT NULL,
	`provider` enum('youtube','twitch') NOT NULL,
	`provider_channel_id_snapshot` varchar(191) NOT NULL,
	`display_name_snapshot` varchar(191) NOT NULL,
	`handle_snapshot` varchar(191),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stream_schedule_channel_targets_id` PRIMARY KEY(`id`),
	CONSTRAINT `stream_schedule_channel_target_uidx` UNIQUE(`schedule_entry_id`,`channel_ref`)
);
--> statement-breakpoint
CREATE INDEX `stream_schedule_channel_schedule_idx` ON `stream_schedule_channel_targets` (`schedule_entry_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `stream_schedule_channel_ref_idx` ON `stream_schedule_channel_targets` (`channel_ref`);