ALTER TABLE `action_items`
	ADD CONSTRAINT `action_items_legacy_status_check` CHECK (
		`status` IN ('open', 'approved', 'rejected', 'deferred', 'resolved')
	),
	ADD CONSTRAINT `action_items_legacy_priority_check` CHECK (
		`urgency` IN ('low', 'normal', 'high', 'critical')
	),
	ADD CONSTRAINT `action_items_legacy_category_check` CHECK (
		LOWER(TRIM(`category`)) IN (
			'ai',
			'artificial-intelligence',
			'donation',
			'donations',
			'support',
			'moderation',
			'safety',
			'overlay',
			'overlays',
			'project',
			'projects',
			'development',
			'schedule',
			'scheduling',
			'calendar',
			'stream',
			'streaming',
			'sponsor',
			'sponsorship',
			'system'
		)
	);--> statement-breakpoint
ALTER TABLE `action_items`
	DROP CONSTRAINT `action_items_legacy_status_check`,
	DROP CONSTRAINT `action_items_legacy_priority_check`,
	DROP CONSTRAINT `action_items_legacy_category_check`;--> statement-breakpoint
CREATE TABLE `action_item_history` (
	`id` varchar(36) NOT NULL,
	`action_id` varchar(36) NOT NULL,
	`decision` enum('approve','reject','defer') NOT NULL,
	`previous_status` enum('open','approved','rejected','deferred','completed') NOT NULL,
	`new_status` enum('open','approved','rejected','deferred','completed') NOT NULL,
	`actor_user_id` varchar(36) NOT NULL,
	`note` varchar(1000),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `action_item_history_id` PRIMARY KEY(`id`),
	CONSTRAINT `action_item_history_transition_check` CHECK((
        (
          `action_item_history`.`decision` = 'approve'
          and `action_item_history`.`previous_status` in ('open', 'deferred')
          and `action_item_history`.`new_status` = 'approved'
        )
        or
        (
          `action_item_history`.`decision` = 'reject'
          and `action_item_history`.`previous_status` in ('open', 'deferred')
          and `action_item_history`.`new_status` = 'rejected'
        )
        or
        (
          `action_item_history`.`decision` = 'defer'
          and `action_item_history`.`previous_status` = 'open'
          and `action_item_history`.`new_status` = 'deferred'
        )
      ))
);
--> statement-breakpoint
ALTER TABLE `action_items` RENAME COLUMN `urgency` TO `priority`;--> statement-breakpoint
DROP INDEX `action_items_status_idx` ON `action_items`;--> statement-breakpoint
DROP INDEX `action_items_urgency_idx` ON `action_items`;--> statement-breakpoint
ALTER TABLE `action_items` MODIFY COLUMN `status` varchar(20) NOT NULL DEFAULT 'open';--> statement-breakpoint
ALTER TABLE `action_items` MODIFY COLUMN `priority` varchar(20) NOT NULL DEFAULT 'normal';--> statement-breakpoint
ALTER TABLE `action_items` MODIFY COLUMN `payload` json;--> statement-breakpoint
ALTER TABLE `action_items` ADD `decision_kind` enum('approve','approve-or-reject','review','defer','acknowledge');--> statement-breakpoint
ALTER TABLE `action_items` ADD `stream_relevant` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `action_items` ADD `due_at` timestamp;--> statement-breakpoint
ALTER TABLE `action_items` ADD `source_type` enum('ai','donation','moderation','overlay','project','schedule','stream','sponsor','system');--> statement-breakpoint
ALTER TABLE `action_items` ADD `source_id` varchar(191);--> statement-breakpoint
ALTER TABLE `action_items` ADD `source_label` varchar(191);--> statement-breakpoint
UPDATE `action_items`
SET `description` = ''
WHERE `description` IS NULL;--> statement-breakpoint
UPDATE `action_items`
SET `status` = 'completed'
WHERE `status` = 'resolved';--> statement-breakpoint
UPDATE `action_items`
SET `priority` = 'urgent'
WHERE `priority` = 'critical';--> statement-breakpoint
UPDATE `action_items`
SET `category` = CASE LOWER(TRIM(`category`))
	WHEN 'ai' THEN 'ai'
	WHEN 'artificial-intelligence' THEN 'ai'
	WHEN 'donation' THEN 'donation'
	WHEN 'donations' THEN 'donation'
	WHEN 'support' THEN 'donation'
	WHEN 'moderation' THEN 'moderation'
	WHEN 'safety' THEN 'moderation'
	WHEN 'overlay' THEN 'overlay'
	WHEN 'overlays' THEN 'overlay'
	WHEN 'project' THEN 'project'
	WHEN 'projects' THEN 'project'
	WHEN 'development' THEN 'project'
	WHEN 'schedule' THEN 'schedule'
	WHEN 'scheduling' THEN 'schedule'
	WHEN 'calendar' THEN 'schedule'
	WHEN 'stream' THEN 'stream'
	WHEN 'streaming' THEN 'stream'
	WHEN 'sponsor' THEN 'sponsor'
	WHEN 'sponsorship' THEN 'sponsor'
	WHEN 'system' THEN 'system'
	ELSE `category`
END;--> statement-breakpoint
UPDATE `action_items`
SET `decision_kind` = 'review'
WHERE `decision_kind` IS NULL;--> statement-breakpoint
ALTER TABLE `action_items` MODIFY COLUMN `description` text NOT NULL;--> statement-breakpoint
ALTER TABLE `action_items` MODIFY COLUMN `status` enum('open','approved','rejected','deferred','completed') NOT NULL DEFAULT 'open';--> statement-breakpoint
ALTER TABLE `action_items` MODIFY COLUMN `priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal';--> statement-breakpoint
ALTER TABLE `action_items` MODIFY COLUMN `category` enum('ai','donation','moderation','overlay','project','schedule','stream','sponsor','system') NOT NULL;--> statement-breakpoint
ALTER TABLE `action_items` MODIFY COLUMN `decision_kind` enum('approve','approve-or-reject','review','defer','acknowledge') NOT NULL;--> statement-breakpoint
ALTER TABLE `action_item_history` ADD CONSTRAINT `action_item_history_action_id_action_items_id_fk` FOREIGN KEY (`action_id`) REFERENCES `action_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `action_item_history` ADD CONSTRAINT `action_item_history_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `action_item_history_action_created_at_idx` ON `action_item_history` (`action_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `action_item_history_created_at_idx` ON `action_item_history` (`created_at`);--> statement-breakpoint
CREATE INDEX `action_item_history_actor_user_id_idx` ON `action_item_history` (`actor_user_id`);--> statement-breakpoint
ALTER TABLE `action_items` ADD CONSTRAINT `action_items_source_fields_check` CHECK ((
        (`action_items`.`source_type` is null and `action_items`.`source_id` is null and `action_items`.`source_label` is null)
        or
        (`action_items`.`source_type` is not null and `action_items`.`source_id` is not null and `action_items`.`source_label` is not null)
      ));--> statement-breakpoint
CREATE INDEX `action_items_status_priority_due_at_idx` ON `action_items` (`status`,`priority`,`due_at`);--> statement-breakpoint
CREATE INDEX `action_items_category_idx` ON `action_items` (`category`);
