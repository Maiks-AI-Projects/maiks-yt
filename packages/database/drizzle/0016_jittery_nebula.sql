CREATE TABLE `role_grant_audit_logs` (
	`id` varchar(36) NOT NULL,
	`target_user_id` varchar(36) NOT NULL,
	`role_id` varchar(36) NOT NULL,
	`actor_user_id` varchar(36),
	`action` enum('grant','update','revoke','expire') NOT NULL,
	`previous_value` json,
	`next_value` json,
	`reason` varchar(280),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `role_grant_audit_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `role_grant_audit_value_check` CHECK((
        (`role_grant_audit_logs`.`action` = 'grant' and `role_grant_audit_logs`.`previous_value` is null and `role_grant_audit_logs`.`next_value` is not null)
        or
        (`role_grant_audit_logs`.`action` = 'update' and `role_grant_audit_logs`.`previous_value` is not null and `role_grant_audit_logs`.`next_value` is not null)
        or
        (`role_grant_audit_logs`.`action` in ('revoke', 'expire') and `role_grant_audit_logs`.`previous_value` is not null)
      ))
);
--> statement-breakpoint
ALTER TABLE `user_roles` ADD `trust_level` enum('observer','helper','moderator','senior_moderator','trusted_operator','owner') DEFAULT 'helper' NOT NULL;--> statement-breakpoint
UPDATE `user_roles` INNER JOIN `roles` ON `roles`.`id` = `user_roles`.`role_id` SET `user_roles`.`trust_level` = 'owner' WHERE `roles`.`key` = 'owner';--> statement-breakpoint
ALTER TABLE `user_roles` ADD `scope_kind` enum('global','chat','event_routing','content','project','stream_operations') DEFAULT 'global' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_roles` ADD `scope_id` varchar(191);--> statement-breakpoint
ALTER TABLE `user_roles` ADD `availability` enum('always','live_only','offline_only') DEFAULT 'always' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_roles` ADD `assigned_by_user_id` varchar(36);--> statement-breakpoint
ALTER TABLE `user_roles` ADD `expires_at` timestamp;--> statement-breakpoint
ALTER TABLE `user_roles` ADD `revoked_at` timestamp;--> statement-breakpoint
ALTER TABLE `user_roles` ADD `revoked_by_user_id` varchar(36);--> statement-breakpoint
ALTER TABLE `user_roles` ADD `revocation_reason` varchar(280);--> statement-breakpoint
CREATE INDEX `role_grant_audit_target_created_idx` ON `role_grant_audit_logs` (`target_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `role_grant_audit_actor_created_idx` ON `role_grant_audit_logs` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `role_grant_audit_role_created_idx` ON `role_grant_audit_logs` (`role_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_scope_id_check` CHECK ((
        (`user_roles`.`scope_kind` = 'global' and `user_roles`.`scope_id` is null)
        or
        (`user_roles`.`scope_kind` <> 'global' and `user_roles`.`scope_id` is not null and trim(`user_roles`.`scope_id`) <> '')
      ));--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_revocation_check` CHECK ((
        (`user_roles`.`revoked_at` is null and `user_roles`.`revoked_by_user_id` is null and `user_roles`.`revocation_reason` is null)
        or
        (`user_roles`.`revoked_at` is not null and `user_roles`.`revoked_by_user_id` is not null)
      ));--> statement-breakpoint
CREATE INDEX `user_roles_scope_idx` ON `user_roles` (`scope_kind`,`scope_id`);--> statement-breakpoint
CREATE INDEX `user_roles_expires_at_idx` ON `user_roles` (`expires_at`);--> statement-breakpoint
CREATE INDEX `user_roles_revoked_at_idx` ON `user_roles` (`revoked_at`);--> statement-breakpoint
CREATE INDEX `user_roles_assigned_by_user_idx` ON `user_roles` (`assigned_by_user_id`);
