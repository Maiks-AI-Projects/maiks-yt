CREATE TABLE `public_updates` (
	`id` varchar(36) NOT NULL,
	`slug` varchar(191) NOT NULL,
	`title` varchar(191) NOT NULL,
	`summary` varchar(500) NOT NULL,
	`body` text NOT NULL,
	`kind` enum('post','stream-recap','announcement') NOT NULL,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`visibility` enum('hidden','public') NOT NULL DEFAULT 'hidden',
	`published_at` timestamp,
	`is_pinned` boolean NOT NULL DEFAULT false,
	`is_example` boolean NOT NULL DEFAULT false,
	`created_by_user_id` varchar(36),
	`updated_by_user_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `public_updates_id` PRIMARY KEY(`id`),
	CONSTRAINT `public_updates_slug_uidx` UNIQUE(`slug`),
	CONSTRAINT `public_updates_slug_check` CHECK((
        trim(`public_updates`.`slug`) = `public_updates`.`slug`
        and `public_updates`.`slug` regexp '^[a-z0-9][a-z0-9-]{0,190}$'
      )),
	CONSTRAINT `public_updates_draft_visibility_check` CHECK(`public_updates`.`status` <> 'draft' or `public_updates`.`visibility` = 'hidden'),
	CONSTRAINT `public_updates_published_at_check` CHECK((
        (`public_updates`.`status` = 'draft' and `public_updates`.`published_at` is null)
        or
        (`public_updates`.`status` = 'published' and `public_updates`.`published_at` is not null)
      ))
);
--> statement-breakpoint
CREATE INDEX `public_updates_listing_idx` ON `public_updates` (`status`,`visibility`,`is_pinned`,`published_at`);--> statement-breakpoint
CREATE INDEX `public_updates_kind_idx` ON `public_updates` (`kind`,`published_at`);