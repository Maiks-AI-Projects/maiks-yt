ALTER TABLE `linked_accounts` ADD `purpose_label` varchar(191);--> statement-breakpoint
ALTER TABLE `linked_accounts` ADD `audience_key` varchar(80);--> statement-breakpoint
ALTER TABLE `linked_accounts` ADD `channel_key` varchar(80);--> statement-breakpoint
CREATE INDEX `linked_accounts_audience_key_idx` ON `linked_accounts` (`audience_key`);--> statement-breakpoint
CREATE INDEX `linked_accounts_channel_key_idx` ON `linked_accounts` (`channel_key`);