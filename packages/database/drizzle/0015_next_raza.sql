CREATE TABLE `notification_push_subscriptions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`endpoint_hash` varchar(64) NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` varchar(191) NOT NULL,
	`auth` varchar(191) NOT NULL,
	`user_agent` varchar(512),
	`last_push_at` timestamp,
	`last_error` varchar(512),
	`revoked_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_push_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_push_endpoint_hash_uidx` UNIQUE(`endpoint_hash`)
);
--> statement-breakpoint
CREATE INDEX `notification_push_user_idx` ON `notification_push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `notification_push_revoked_idx` ON `notification_push_subscriptions` (`revoked_at`);--> statement-breakpoint
CREATE INDEX `notification_push_last_push_idx` ON `notification_push_subscriptions` (`last_push_at`);