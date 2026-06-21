ALTER TABLE `stream_schedule_entries` ADD `project_id` varchar(36);--> statement-breakpoint
ALTER TABLE `stream_schedule_entries` ADD `focus_label` varchar(120);--> statement-breakpoint
ALTER TABLE `stream_schedule_entries` ADD `focus_note` varchar(280);--> statement-breakpoint
CREATE INDEX `stream_schedule_project_id_idx` ON `stream_schedule_entries` (`project_id`);