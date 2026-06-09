CREATE TABLE `url_access_tokens` (
	`id` varchar(36) NOT NULL,
	`label` varchar(191) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`surface` enum('overlay','control-panel','admin','api') NOT NULL,
	`scopes` json NOT NULL,
	`requires_login` boolean NOT NULL DEFAULT true,
	`expires_at` timestamp,
	`revoked_at` timestamp,
	`last_used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `url_access_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `url_access_tokens_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE INDEX `url_access_tokens_surface_idx` ON `url_access_tokens` (`surface`);--> statement-breakpoint
CREATE INDEX `url_access_tokens_expires_at_idx` ON `url_access_tokens` (`expires_at`);--> statement-breakpoint
CREATE INDEX `url_access_tokens_revoked_at_idx` ON `url_access_tokens` (`revoked_at`);