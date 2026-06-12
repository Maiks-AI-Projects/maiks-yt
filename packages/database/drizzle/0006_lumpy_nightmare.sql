CREATE TABLE `dev_auth_tokens` (
	`id` varchar(36) NOT NULL,
	`label` varchar(191) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`auth_user_id` varchar(36) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`revoked_at` timestamp,
	`last_used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dev_auth_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `dev_auth_tokens_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE INDEX `dev_auth_tokens_auth_user_id_idx` ON `dev_auth_tokens` (`auth_user_id`);--> statement-breakpoint
CREATE INDEX `dev_auth_tokens_expires_at_idx` ON `dev_auth_tokens` (`expires_at`);--> statement-breakpoint
CREATE INDEX `dev_auth_tokens_revoked_at_idx` ON `dev_auth_tokens` (`revoked_at`);