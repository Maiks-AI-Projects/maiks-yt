ALTER TABLE `auth_sessions` ADD `token_hash` varchar(64);--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_token_hash_uidx` UNIQUE(`token_hash`);
