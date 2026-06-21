CREATE TABLE `project_updates` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`title` varchar(191) NOT NULL,
	`summary` varchar(280),
	`body` text NOT NULL,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`is_visible` boolean NOT NULL DEFAULT true,
	`published_at` timestamp,
	`is_pinned` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `project_updates_project_id_idx` ON `project_updates` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_updates_public_order_idx` ON `project_updates` (`project_id`,`status`,`is_visible`,`is_pinned`,`sort_order`,`published_at`);