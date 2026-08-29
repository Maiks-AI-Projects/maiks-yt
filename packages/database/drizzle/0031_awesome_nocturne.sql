DROP INDEX `auth_verifications_identifier_idx` ON `auth_verifications`;--> statement-breakpoint
ALTER TABLE `auth_verifications` MODIFY COLUMN `identifier` text NOT NULL;--> statement-breakpoint
ALTER TABLE `auth_verifications` ADD `identifier_hash` varchar(64);--> statement-breakpoint
CREATE INDEX `auth_verifications_identifier_hash_idx` ON `auth_verifications` (`identifier_hash`);
