CREATE TABLE `creator_links` (
	`id` varchar(36) NOT NULL,
	`key` varchar(80) NOT NULL,
	`title` varchar(191) NOT NULL,
	`description` text NOT NULL,
	`purpose` enum('account','accountability','affiliate','community','context','feed','project','social','stream','support','tool') NOT NULL,
	`icon` enum('account','accountability','affiliate','community','context','discord','feed','project','social','stream','support','twitch','tool','youtube') NOT NULL,
	`availability` enum('available','unavailable') NOT NULL DEFAULT 'unavailable',
	`href` varchar(1024),
	`availability_note` varchar(191),
	`is_primary` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_published` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `creator_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `creator_links_key_unique` UNIQUE(`key`),
	CONSTRAINT `creator_links_availability_check` CHECK((
        (
          `creator_links`.`availability` = 'available'
          and `creator_links`.`href` is not null
          and trim(`creator_links`.`href`) <> ''
        )
        or
        (
          `creator_links`.`availability` = 'unavailable'
          and `creator_links`.`availability_note` is not null
          and trim(`creator_links`.`availability_note`) <> ''
        )
      ))
);
--> statement-breakpoint
CREATE INDEX `creator_links_published_sort_idx` ON `creator_links` (`is_published`,`sort_order`);--> statement-breakpoint
CREATE INDEX `creator_links_purpose_idx` ON `creator_links` (`purpose`);