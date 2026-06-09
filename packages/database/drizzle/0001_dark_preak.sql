CREATE TABLE `action_items` (
	`id` varchar(36) NOT NULL,
	`title` varchar(191) NOT NULL,
	`description` text,
	`status` enum('open','approved','rejected','deferred','resolved') NOT NULL DEFAULT 'open',
	`urgency` enum('low','normal','high','critical') NOT NULL DEFAULT 'normal',
	`category` varchar(80) NOT NULL,
	`live_safe` boolean NOT NULL DEFAULT false,
	`payload` json NOT NULL,
	`created_by_user_id` varchar(36),
	`resolved_by_user_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`resolved_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `action_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_replay_events` (
	`id` varchar(36) NOT NULL,
	`replay_session_id` varchar(36) NOT NULL,
	`event_type` varchar(120) NOT NULL,
	`offset_ms` int NOT NULL DEFAULT 0,
	`payload` json NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `event_replay_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_replay_sessions` (
	`id` varchar(36) NOT NULL,
	`title` varchar(191) NOT NULL,
	`description` text,
	`source` enum('manual','recorded','fixture') NOT NULL DEFAULT 'manual',
	`sanitized` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `event_replay_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `linked_accounts` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`provider` varchar(80) NOT NULL,
	`provider_account_id` varchar(191) NOT NULL,
	`display_name` varchar(191) NOT NULL,
	`allow_login` boolean NOT NULL DEFAULT true,
	`capabilities` json NOT NULL,
	`verified_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `linked_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `linked_accounts_provider_account_uidx` UNIQUE(`provider`,`provider_account_id`)
);
--> statement-breakpoint
CREATE TABLE `overlay_events` (
	`id` varchar(36) NOT NULL,
	`stream_session_id` varchar(36),
	`type` varchar(120) NOT NULL,
	`priority` enum('normal','important','urgent') NOT NULL DEFAULT 'normal',
	`zone` enum('top','center'),
	`payload` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `overlay_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `overlay_states` (
	`id` varchar(36) NOT NULL,
	`stream_session_id` varchar(36),
	`overlay_key` varchar(80) NOT NULL,
	`scene` varchar(80) NOT NULL,
	`layout` varchar(80) NOT NULL,
	`theme` varchar(80) NOT NULL,
	`mode` enum('live','clean','static') NOT NULL DEFAULT 'live',
	`state` json NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `overlay_states_id` PRIMARY KEY(`id`),
	CONSTRAINT `overlay_states_overlay_key_uidx` UNIQUE(`overlay_key`)
);
--> statement-breakpoint
CREATE TABLE `project_milestones` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(36) NOT NULL,
	`title` varchar(191) NOT NULL,
	`description` text,
	`status` enum('planned','active','completed','cancelled') NOT NULL DEFAULT 'planned',
	`sort_order` int NOT NULL DEFAULT 0,
	`starts_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_milestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` varchar(36) NOT NULL,
	`slug` varchar(191) NOT NULL,
	`title` varchar(191) NOT NULL,
	`summary` text,
	`type` enum('one-time-purchase','multi-item-build','ongoing-cost','subscription','stream-work-project','milestone-only') NOT NULL,
	`category` enum('personal','family','content-improvement','stream-infrastructure','software-project','hobby','community','health-accessibility','experiment','ongoing-cost') NOT NULL,
	`status` enum('planning','active','completed','mothballed','cancelled') NOT NULL DEFAULT 'planning',
	`is_public` boolean NOT NULL DEFAULT false,
	`created_by_user_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` varchar(36) NOT NULL,
	`key` varchar(80) NOT NULL,
	`name` varchar(191) NOT NULL,
	`permissions` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `stream_sessions` (
	`id` varchar(36) NOT NULL,
	`title` varchar(191) NOT NULL,
	`channel_key` varchar(80) NOT NULL,
	`hobby_key` varchar(80),
	`status` enum('draft','scheduled','live','completed','cancelled') NOT NULL DEFAULT 'draft',
	`active_project_id` varchar(36),
	`scheduled_start_at` timestamp,
	`started_at` timestamp,
	`ended_at` timestamp,
	`cancellation_reason` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stream_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`role_id` varchar(36) NOT NULL,
	`assigned_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_roles_user_role_uidx` UNIQUE(`user_id`,`role_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`display_name` varchar(191) NOT NULL,
	`profile_visibility` enum('private','minimal','public') NOT NULL DEFAULT 'private',
	`avatar_url` varchar(1024),
	`deleted_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `action_items_status_idx` ON `action_items` (`status`);--> statement-breakpoint
CREATE INDEX `action_items_urgency_idx` ON `action_items` (`urgency`);--> statement-breakpoint
CREATE INDEX `event_replay_events_replay_session_id_idx` ON `event_replay_events` (`replay_session_id`);--> statement-breakpoint
CREATE INDEX `event_replay_events_event_type_idx` ON `event_replay_events` (`event_type`);--> statement-breakpoint
CREATE INDEX `linked_accounts_user_id_idx` ON `linked_accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `overlay_events_stream_session_id_idx` ON `overlay_events` (`stream_session_id`);--> statement-breakpoint
CREATE INDEX `overlay_events_type_idx` ON `overlay_events` (`type`);--> statement-breakpoint
CREATE INDEX `overlay_states_stream_session_id_idx` ON `overlay_states` (`stream_session_id`);--> statement-breakpoint
CREATE INDEX `project_milestones_project_id_idx` ON `project_milestones` (`project_id`);--> statement-breakpoint
CREATE INDEX `projects_status_idx` ON `projects` (`status`);--> statement-breakpoint
CREATE INDEX `projects_category_idx` ON `projects` (`category`);--> statement-breakpoint
CREATE INDEX `stream_sessions_status_idx` ON `stream_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `stream_sessions_channel_key_idx` ON `stream_sessions` (`channel_key`);--> statement-breakpoint
CREATE INDEX `user_roles_user_id_idx` ON `user_roles` (`user_id`);