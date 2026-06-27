CREATE TABLE `system_notifications` (
	`id` varchar(36) NOT NULL,
	`title` varchar(191) NOT NULL,
	`body` text NOT NULL,
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
	`source` enum('dev_smoke','system','security','provider','moderation','money') NOT NULL DEFAULT 'system',
	`status` enum('unread','read','archived') NOT NULL DEFAULT 'unread',
	`action_url` varchar(1024),
	`created_by_user_id` varchar(36),
	`read_at` timestamp,
	`archived_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_notifications_read_state_check` CHECK(`system_notifications`.`status` <> 'read' or `system_notifications`.`read_at` is not null),
	CONSTRAINT `system_notifications_archived_state_check` CHECK(`system_notifications`.`status` <> 'archived' or `system_notifications`.`archived_at` is not null)
);
--> statement-breakpoint
CREATE INDEX `system_notifications_status_created_idx` ON `system_notifications` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `system_notifications_severity_created_idx` ON `system_notifications` (`severity`,`created_at`);--> statement-breakpoint
CREATE INDEX `system_notifications_source_created_idx` ON `system_notifications` (`source`,`created_at`);--> statement-breakpoint
CREATE INDEX `system_notifications_created_by_user_idx` ON `system_notifications` (`created_by_user_id`);