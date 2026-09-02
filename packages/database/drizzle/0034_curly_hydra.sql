CREATE TABLE `stream_provider_delivery_bindings` (
	`id` varchar(36) NOT NULL,
	`schedule_entry_id` varchar(36) NOT NULL,
	`channel_ref` varchar(36) NOT NULL,
	`provider` enum('youtube','twitch') NOT NULL,
	`provider_channel_id_snapshot` varchar(191) NOT NULL,
	`display_name_snapshot` varchar(191) NOT NULL,
	`handle_snapshot` varchar(191),
	`desired_revision` int NOT NULL DEFAULT 1,
	`status` enum('pending','syncing','ready','degraded','failed','removed') NOT NULL DEFAULT 'pending',
	`provider_resource_id` varchar(191),
	`provider_stream_id` varchar(191),
	`provider_category_id` varchar(191),
	`last_attempt_at` timestamp,
	`last_success_at` timestamp,
	`last_error_code` varchar(120),
	`last_error_message` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stream_provider_delivery_bindings_id` PRIMARY KEY(`id`),
	CONSTRAINT `stream_provider_delivery_schedule_channel_uidx` UNIQUE(`schedule_entry_id`,`channel_ref`),
	CONSTRAINT `stream_provider_delivery_provider_resource_uidx` UNIQUE(`provider`,`provider_resource_id`),
	CONSTRAINT `stream_provider_delivery_revision_check` CHECK(`stream_provider_delivery_bindings`.`desired_revision` > 0)
);
--> statement-breakpoint
CREATE TABLE `stream_provider_delivery_intents` (
	`id` varchar(36) NOT NULL,
	`delivery_binding_id` varchar(36) NOT NULL,
	`schedule_entry_id` varchar(36) NOT NULL,
	`channel_ref` varchar(36) NOT NULL,
	`operation` enum('twitch.schedule-segment','twitch.channel-metadata','youtube.broadcast','youtube.stream-binding') NOT NULL,
	`desired_revision` int NOT NULL,
	`idempotency_key` varchar(191) NOT NULL,
	`status` enum('pending','processing','succeeded','failed','retry-wait','superseded') NOT NULL DEFAULT 'pending',
	`attempt_count` int NOT NULL DEFAULT 0,
	`available_at` timestamp NOT NULL DEFAULT (now()),
	`claimed_at` timestamp,
	`claimed_by` varchar(191),
	`completed_at` timestamp,
	`last_error_code` varchar(120),
	`last_error_message` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stream_provider_delivery_intents_id` PRIMARY KEY(`id`),
	CONSTRAINT `stream_provider_intent_idempotency_uidx` UNIQUE(`idempotency_key`),
	CONSTRAINT `stream_provider_intent_revision_check` CHECK(`stream_provider_delivery_intents`.`desired_revision` > 0),
	CONSTRAINT `stream_provider_intent_attempt_count_check` CHECK(`stream_provider_delivery_intents`.`attempt_count` >= 0)
);
--> statement-breakpoint
ALTER TABLE `stream_schedule_entries` ADD `creation_request_id` varchar(36);--> statement-breakpoint
ALTER TABLE `stream_schedule_entries` ADD CONSTRAINT `stream_schedule_creation_request_uidx` UNIQUE(`created_by_user_id`,`creation_request_id`);--> statement-breakpoint
CREATE INDEX `stream_provider_delivery_schedule_idx` ON `stream_provider_delivery_bindings` (`schedule_entry_id`,`status`);--> statement-breakpoint
CREATE INDEX `stream_provider_delivery_status_idx` ON `stream_provider_delivery_bindings` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `stream_provider_intent_claim_idx` ON `stream_provider_delivery_intents` (`status`,`available_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `stream_provider_intent_binding_idx` ON `stream_provider_delivery_intents` (`delivery_binding_id`,`desired_revision`);--> statement-breakpoint
CREATE INDEX `stream_provider_intent_schedule_idx` ON `stream_provider_delivery_intents` (`schedule_entry_id`,`channel_ref`);