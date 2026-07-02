CREATE TABLE `role_rank_paths` (
	`id` varchar(36) NOT NULL,
	`key` varchar(80) NOT NULL,
	`name` varchar(191) NOT NULL,
	`description` varchar(280),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `role_rank_paths_id` PRIMARY KEY(`id`),
	CONSTRAINT `role_rank_paths_key_unique` UNIQUE(`key`),
	CONSTRAINT `role_rank_paths_key_check` CHECK(trim(`role_rank_paths`.`key`) <> ''),
	CONSTRAINT `role_rank_paths_sort_order_check` CHECK(`role_rank_paths`.`sort_order` >= 0)
);
--> statement-breakpoint
ALTER TABLE `roles` ADD `rank_path_id` varchar(36);--> statement-breakpoint
ALTER TABLE `roles` ADD `rank_level` int;--> statement-breakpoint
ALTER TABLE `roles` ADD `display_label` varchar(191);--> statement-breakpoint
ALTER TABLE `roles` ADD `next_role_id` varchar(36);--> statement-breakpoint
ALTER TABLE `roles` ADD `discord_role_id` varchar(80);--> statement-breakpoint
ALTER TABLE `roles` ADD `is_owner_rank` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `roles` ADD `is_system` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `role_rank_paths_sort_idx` ON `role_rank_paths` (`sort_order`,`key`);--> statement-breakpoint
ALTER TABLE `roles` ADD CONSTRAINT `roles_rank_level_check` CHECK (`roles`.`rank_level` is null or `roles`.`rank_level` > 0);--> statement-breakpoint
ALTER TABLE `roles` ADD CONSTRAINT `roles_rank_path_level_pair_check` CHECK ((
        (`roles`.`rank_path_id` is null and `roles`.`rank_level` is null)
        or
        (`roles`.`rank_path_id` is not null and `roles`.`rank_level` is not null)
      ));--> statement-breakpoint
CREATE INDEX `roles_rank_path_level_idx` ON `roles` (`rank_path_id`,`rank_level`);--> statement-breakpoint
CREATE INDEX `roles_next_role_idx` ON `roles` (`next_role_id`);--> statement-breakpoint
CREATE INDEX `roles_discord_role_idx` ON `roles` (`discord_role_id`);