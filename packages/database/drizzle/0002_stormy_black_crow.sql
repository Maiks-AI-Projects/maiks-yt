CREATE TABLE `project_item_links` (
	`id` varchar(36) NOT NULL,
	`project_item_id` varchar(36) NOT NULL,
	`provider` varchar(80) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`label` varchar(191) NOT NULL,
	`relationship` enum('store-product','wishlist-entry','reference','receipt') NOT NULL,
	`last_seen_minor_amount` int,
	`currency_code` varchar(3),
	`checked_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_item_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_items` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`parent_item_id` varchar(36),
	`title` varchar(191) NOT NULL,
	`description` text,
	`kind` enum('product','service','subscription','task','wishlist','other') NOT NULL,
	`status` enum('planned','active','acquired','completed','removed') NOT NULL DEFAULT 'planned',
	`quantity` int NOT NULL DEFAULT 1,
	`estimated_minor_amount` int,
	`currency_code` varchar(3),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `value_sources` (
	`id` varchar(36) NOT NULL,
	`key` varchar(80) NOT NULL,
	`label` varchar(191) NOT NULL,
	`provider` varchar(80) NOT NULL,
	`source_type` enum('direct','platform','manual','affiliate','sponsor','internal') NOT NULL,
	`value_kind` enum('money','restricted-credit','non-monetary') NOT NULL,
	`currency_code` varchar(3),
	`payout_eligible` boolean NOT NULL DEFAULT false,
	`enabled` boolean NOT NULL DEFAULT true,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `value_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `value_sources_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE INDEX `project_item_links_project_item_id_idx` ON `project_item_links` (`project_item_id`);--> statement-breakpoint
CREATE INDEX `project_item_links_provider_idx` ON `project_item_links` (`provider`);--> statement-breakpoint
CREATE INDEX `project_items_project_id_idx` ON `project_items` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_items_parent_item_id_idx` ON `project_items` (`parent_item_id`);--> statement-breakpoint
CREATE INDEX `project_items_status_idx` ON `project_items` (`status`);--> statement-breakpoint
CREATE INDEX `value_sources_provider_idx` ON `value_sources` (`provider`);--> statement-breakpoint
CREATE INDEX `value_sources_source_type_idx` ON `value_sources` (`source_type`);