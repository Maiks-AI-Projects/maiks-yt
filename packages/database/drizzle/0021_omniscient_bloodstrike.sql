CREATE TABLE `provider_channel_identities` (
	`id` varchar(36) NOT NULL,
	`owner_user_id` varchar(36) NOT NULL,
	`provider` enum('youtube','twitch','discord') NOT NULL,
	`provider_channel_id` varchar(191) NOT NULL,
	`display_name` varchar(191) NOT NULL,
	`handle` varchar(191),
	`thumbnail_url` varchar(1024),
	`selected_for_live_chat` boolean NOT NULL DEFAULT false,
	`discovered_at` timestamp NOT NULL,
	`last_seen_at` timestamp NOT NULL,
	`selected_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_channel_identities_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_channel_owner_provider_channel_uidx` UNIQUE(`owner_user_id`,`provider`,`provider_channel_id`),
	CONSTRAINT `provider_channel_selected_at_check` CHECK(`provider_channel_identities`.`selected_for_live_chat` = false or `provider_channel_identities`.`selected_at` is not null)
);
--> statement-breakpoint
CREATE INDEX `provider_channel_owner_provider_idx` ON `provider_channel_identities` (`owner_user_id`,`provider`);--> statement-breakpoint
CREATE INDEX `provider_channel_live_chat_selected_idx` ON `provider_channel_identities` (`owner_user_id`,`provider`,`selected_for_live_chat`);--> statement-breakpoint
CREATE INDEX `provider_channel_last_seen_idx` ON `provider_channel_identities` (`provider`,`last_seen_at`);