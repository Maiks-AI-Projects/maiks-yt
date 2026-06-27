CREATE TABLE `content_pages` (
	`id` varchar(36) NOT NULL,
	`title` varchar(191) NOT NULL,
	`route_scope` enum('primary') NOT NULL DEFAULT 'primary',
	`normalized_path` varchar(191) NOT NULL,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`visibility` enum('hidden','public') NOT NULL DEFAULT 'hidden',
	`seo_title` varchar(191),
	`seo_description` varchar(320),
	`body` text NOT NULL,
	`created_by_user_id` varchar(36),
	`updated_by_user_id` varchar(36),
	`published_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `content_pages_route_key_uidx` UNIQUE(`route_scope`,`normalized_path`),
	CONSTRAINT `content_pages_route_scope_check` CHECK(`content_pages`.`route_scope` = 'primary'),
	CONSTRAINT `content_pages_normalized_path_check` CHECK((
        trim(`content_pages`.`normalized_path`) = `content_pages`.`normalized_path`
        and `content_pages`.`normalized_path` <> ''
        and left(`content_pages`.`normalized_path`, 1) = '/'
        and `content_pages`.`normalized_path` not like '%?%'
        and `content_pages`.`normalized_path` not like '%#%'
      )),
	CONSTRAINT `content_pages_draft_visibility_check` CHECK(`content_pages`.`status` <> 'draft' or `content_pages`.`visibility` = 'hidden'),
	CONSTRAINT `content_pages_published_at_check` CHECK((
        (`content_pages`.`status` = 'draft' and `content_pages`.`published_at` is null)
        or
        (`content_pages`.`status` = 'published' and `content_pages`.`published_at` is not null)
      ))
);
--> statement-breakpoint
CREATE INDEX `content_pages_public_lookup_idx` ON `content_pages` (`route_scope`,`normalized_path`,`status`,`visibility`);--> statement-breakpoint
CREATE INDEX `content_pages_admin_listing_idx` ON `content_pages` (`status`,`visibility`,`updated_at`);--> statement-breakpoint
CREATE INDEX `content_pages_created_by_user_idx` ON `content_pages` (`created_by_user_id`);