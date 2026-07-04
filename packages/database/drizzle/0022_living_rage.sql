CREATE TABLE `provider_event_intake_logs` (
	`id` varchar(36) NOT NULL,
	`provider` enum('twitch','youtube','discord') NOT NULL,
	`mechanism` enum('twitch-eventsub','twitch-irc','youtube-live-chat','youtube-activity','youtube-pubsub','discord-gateway','discord-webhook') NOT NULL,
	`provider_event_name` varchar(191) NOT NULL,
	`internal_trigger` varchar(191) NOT NULL,
	`category` enum('auth','channel','chat','community','content','interaction','moderation','money','operations','roles','stream','system','unknown') NOT NULL DEFAULT 'unknown',
	`source_event_id` varchar(191),
	`provider_channel_identity_id` varchar(36),
	`provider_channel_id` varchar(191),
	`provider_message_id` varchar(191),
	`actor_external_id` varchar(191),
	`actor_display_name` varchar(191),
	`catalog_known` boolean NOT NULL DEFAULT false,
	`money_shaped` boolean NOT NULL DEFAULT false,
	`moderation_shaped` boolean NOT NULL DEFAULT false,
	`auth_or_token_shaped` boolean NOT NULL DEFAULT false,
	`high_volume` boolean NOT NULL DEFAULT false,
	`overlay_eligible_by_default` boolean NOT NULL DEFAULT false,
	`processing_status` enum('stored','normalized','mapped_to_event_history','ignored','failed') NOT NULL DEFAULT 'stored',
	`event_history_id` varchar(36),
	`redacted_payload` json NOT NULL,
	`payload_schema_version` int NOT NULL DEFAULT 1,
	`occurred_at` timestamp,
	`received_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `provider_event_intake_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_event_intake_source_event_uidx` UNIQUE(`provider`,`mechanism`,`source_event_id`),
	CONSTRAINT `provider_event_intake_schema_version_check` CHECK(`provider_event_intake_logs`.`payload_schema_version` > 0),
	CONSTRAINT `provider_event_intake_overlay_default_check` CHECK(`provider_event_intake_logs`.`overlay_eligible_by_default` = false),
	CONSTRAINT `provider_event_intake_mapped_history_check` CHECK(`provider_event_intake_logs`.`processing_status` <> 'mapped_to_event_history' or `provider_event_intake_logs`.`event_history_id` is not null)
);
--> statement-breakpoint
CREATE INDEX `provider_event_intake_provider_received_idx` ON `provider_event_intake_logs` (`provider`,`received_at`);--> statement-breakpoint
CREATE INDEX `provider_event_intake_event_idx` ON `provider_event_intake_logs` (`provider`,`mechanism`,`provider_event_name`);--> statement-breakpoint
CREATE INDEX `provider_event_intake_trigger_idx` ON `provider_event_intake_logs` (`internal_trigger`);--> statement-breakpoint
CREATE INDEX `provider_event_intake_channel_idx` ON `provider_event_intake_logs` (`provider`,`provider_channel_id`);--> statement-breakpoint
CREATE INDEX `provider_event_intake_actor_idx` ON `provider_event_intake_logs` (`provider`,`actor_external_id`);--> statement-breakpoint
CREATE INDEX `provider_event_intake_safety_idx` ON `provider_event_intake_logs` (`money_shaped`,`moderation_shaped`,`auth_or_token_shaped`);--> statement-breakpoint
CREATE INDEX `provider_event_intake_status_idx` ON `provider_event_intake_logs` (`processing_status`,`received_at`);--> statement-breakpoint
CREATE INDEX `provider_event_intake_event_history_idx` ON `provider_event_intake_logs` (`event_history_id`);