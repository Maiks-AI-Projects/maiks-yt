CREATE TABLE `app_metadata` (
	`key` varchar(191) NOT NULL,
	`value` varchar(1024) NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_metadata_key` PRIMARY KEY(`key`)
);
