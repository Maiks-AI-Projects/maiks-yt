CREATE TABLE `provider_runtime_credentials` (
	`id` varchar(36) NOT NULL,
	`owner_user_id` varchar(36) NOT NULL,
	`provider` enum('youtube','twitch','discord') NOT NULL,
	`purpose` enum('youtube_live_chat','twitch_eventsub','discord_gateway') NOT NULL,
	`status` enum('active','revoked','error') NOT NULL DEFAULT 'active',
	`provider_account_id` varchar(191),
	`display_name` varchar(191),
	`scopes` json NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`access_token_expires_at` timestamp,
	`refresh_token_expires_at` timestamp,
	`last_verified_at` timestamp,
	`last_error` varchar(512),
	`revoked_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_runtime_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_runtime_owner_provider_purpose_uidx` UNIQUE(`owner_user_id`,`provider`,`purpose`),
	CONSTRAINT `provider_runtime_youtube_purpose_check` CHECK(`provider_runtime_credentials`.`provider` <> 'youtube' or `provider_runtime_credentials`.`purpose` = 'youtube_live_chat'),
	CONSTRAINT `provider_runtime_twitch_purpose_check` CHECK(`provider_runtime_credentials`.`provider` <> 'twitch' or `provider_runtime_credentials`.`purpose` = 'twitch_eventsub'),
	CONSTRAINT `provider_runtime_discord_purpose_check` CHECK(`provider_runtime_credentials`.`provider` <> 'discord' or `provider_runtime_credentials`.`purpose` = 'discord_gateway'),
	CONSTRAINT `provider_runtime_active_token_check` CHECK(`provider_runtime_credentials`.`provider` <> 'youtube' or `provider_runtime_credentials`.`status` <> 'active' or `provider_runtime_credentials`.`refresh_token` is not null),
	CONSTRAINT `provider_runtime_revocation_check` CHECK((
        (`provider_runtime_credentials`.`status` <> 'revoked' and `provider_runtime_credentials`.`revoked_at` is null)
        or
        (`provider_runtime_credentials`.`status` = 'revoked' and `provider_runtime_credentials`.`revoked_at` is not null)
      ))
);
--> statement-breakpoint
CREATE INDEX `provider_runtime_provider_status_idx` ON `provider_runtime_credentials` (`provider`,`status`);--> statement-breakpoint
CREATE INDEX `provider_runtime_owner_status_idx` ON `provider_runtime_credentials` (`owner_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `provider_runtime_revoked_at_idx` ON `provider_runtime_credentials` (`revoked_at`);