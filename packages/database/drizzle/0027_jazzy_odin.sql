CREATE TABLE `game_catalog_entries` (
	`id` varchar(36) NOT NULL,
	`canonical_title` varchar(191) NOT NULL,
	`normalized_title` varchar(191) NOT NULL,
	`match_state` enum('discovered','owner-confirmed') NOT NULL DEFAULT 'discovered',
	`first_seen_at` timestamp NOT NULL DEFAULT (now()),
	`last_seen_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `game_catalog_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `game_catalog_entries_title_not_blank_check` CHECK(trim(`game_catalog_entries`.`canonical_title`) <> ''),
	CONSTRAINT `game_catalog_entries_normalized_title_not_blank_check` CHECK(trim(`game_catalog_entries`.`normalized_title`) <> '')
);
--> statement-breakpoint
CREATE TABLE `game_catalog_provider_identities` (
	`id` varchar(36) NOT NULL,
	`catalog_game_id` varchar(36) NOT NULL,
	`provider` enum('steam','twitch','igdb','other') NOT NULL,
	`provider_game_id` varchar(191) NOT NULL,
	`provider_title` varchar(191) NOT NULL,
	`store_url` varchar(1024),
	`artwork_url` varchar(1024),
	`first_seen_at` timestamp NOT NULL DEFAULT (now()),
	`last_seen_at` timestamp NOT NULL DEFAULT (now()),
	`last_refreshed_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `game_catalog_provider_identities_id` PRIMARY KEY(`id`),
	CONSTRAINT `game_catalog_provider_identity_uidx` UNIQUE(`provider`,`provider_game_id`),
	CONSTRAINT `game_catalog_provider_game_id_not_blank_check` CHECK(trim(`game_catalog_provider_identities`.`provider_game_id`) <> ''),
	CONSTRAINT `game_catalog_provider_title_not_blank_check` CHECK(trim(`game_catalog_provider_identities`.`provider_title`) <> '')
);
--> statement-breakpoint
ALTER TABLE `game_library_entries` ADD `catalog_game_id` varchar(36);--> statement-breakpoint
CREATE INDEX `game_catalog_entries_title_idx` ON `game_catalog_entries` (`normalized_title`);--> statement-breakpoint
CREATE INDEX `game_catalog_entries_match_state_idx` ON `game_catalog_entries` (`match_state`,`last_seen_at`);--> statement-breakpoint
CREATE INDEX `game_catalog_provider_catalog_idx` ON `game_catalog_provider_identities` (`catalog_game_id`,`provider`);--> statement-breakpoint
CREATE INDEX `game_catalog_provider_title_idx` ON `game_catalog_provider_identities` (`provider`,`provider_title`);--> statement-breakpoint
CREATE INDEX `game_library_entries_catalog_game_idx` ON `game_library_entries` (`catalog_game_id`);