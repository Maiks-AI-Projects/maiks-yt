CREATE TABLE `game_library_entries` (
	`id` varchar(36) NOT NULL,
	`slug` varchar(191) NOT NULL,
	`title` varchar(191) NOT NULL,
	`platform_label` varchar(120),
	`store_provider` varchar(80),
	`store_url` varchar(1024),
	`ownership_status` enum('owned','not-owned','borrowed','subscription-access','gifted','unknown') NOT NULL DEFAULT 'unknown',
	`interest_status` enum('interested','maybe-later','currently-playing','completed','paused','not-a-fit') NOT NULL DEFAULT 'interested',
	`stream_fit_note` varchar(500),
	`content_warnings` text,
	`category_label` varchar(120),
	`visibility` enum('private','public') NOT NULL DEFAULT 'private',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by_user_id` varchar(36),
	`updated_by_user_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `game_library_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `game_library_entries_slug_uidx` UNIQUE(`slug`),
	CONSTRAINT `game_library_entries_slug_not_blank_check` CHECK(trim(`game_library_entries`.`slug`) <> ''),
	CONSTRAINT `game_library_entries_title_not_blank_check` CHECK(trim(`game_library_entries`.`title`) <> '')
);
--> statement-breakpoint
CREATE TABLE `game_schedule_links` (
	`id` varchar(36) NOT NULL,
	`game_id` varchar(36) NOT NULL,
	`schedule_entry_id` varchar(36) NOT NULL,
	`relationship` enum('planned','current','played','completed-showcase') NOT NULL DEFAULT 'planned',
	`public_note` varchar(280),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by_user_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `game_schedule_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `game_schedule_links_entry_game_uidx` UNIQUE(`schedule_entry_id`,`game_id`)
);
--> statement-breakpoint
CREATE TABLE `game_suggestions` (
	`id` varchar(36) NOT NULL,
	`title` varchar(191) NOT NULL,
	`platform_label` varchar(120),
	`store_url` varchar(1024),
	`reason` varchar(1000),
	`tags` json,
	`suggested_by_user_id` varchar(36),
	`suggested_by_name` varchar(191),
	`status` enum('pending','accepted','maybe-later','rejected','duplicate','already-played') NOT NULL DEFAULT 'pending',
	`linked_game_id` varchar(36),
	`reviewer_user_id` varchar(36),
	`reviewer_note` varchar(1000),
	`reviewed_at` timestamp,
	`is_public` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `game_suggestions_id` PRIMARY KEY(`id`),
	CONSTRAINT `game_suggestions_title_not_blank_check` CHECK(trim(`game_suggestions`.`title`) <> ''),
	CONSTRAINT `game_suggestions_pending_private_check` CHECK(`game_suggestions`.`status` <> 'pending' or `game_suggestions`.`is_public` = false),
	CONSTRAINT `game_suggestions_review_state_check` CHECK((
        (`game_suggestions`.`status` = 'pending' and `game_suggestions`.`reviewer_user_id` is null and `game_suggestions`.`reviewed_at` is null)
        or
        (`game_suggestions`.`status` <> 'pending' and `game_suggestions`.`reviewer_user_id` is not null and `game_suggestions`.`reviewed_at` is not null)
      ))
);
--> statement-breakpoint
CREATE INDEX `game_library_entries_public_idx` ON `game_library_entries` (`visibility`,`interest_status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `game_library_entries_ownership_idx` ON `game_library_entries` (`ownership_status`);--> statement-breakpoint
CREATE INDEX `game_schedule_links_game_idx` ON `game_schedule_links` (`game_id`);--> statement-breakpoint
CREATE INDEX `game_schedule_links_schedule_entry_idx` ON `game_schedule_links` (`schedule_entry_id`);--> statement-breakpoint
CREATE INDEX `game_schedule_links_relationship_idx` ON `game_schedule_links` (`relationship`);--> statement-breakpoint
CREATE INDEX `game_suggestions_status_idx` ON `game_suggestions` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `game_suggestions_linked_game_idx` ON `game_suggestions` (`linked_game_id`);--> statement-breakpoint
CREATE INDEX `game_suggestions_suggested_by_user_idx` ON `game_suggestions` (`suggested_by_user_id`);