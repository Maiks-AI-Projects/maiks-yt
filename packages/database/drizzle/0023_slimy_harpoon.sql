CREATE TABLE `money_accounting_warnings` (
	`id` varchar(36) NOT NULL,
	`target_kind` enum('transaction','line','rule','report') NOT NULL,
	`target_id` varchar(36) NOT NULL,
	`warning_kind` enum('unmapped_source','missing_fee','missing_category','missing_receipt','missing_allocation','rule_gap','estimate_unconfirmed','mixed_money_mode','provider_payout_missing','correction_needed') NOT NULL,
	`severity` enum('info','warning','blocking') NOT NULL DEFAULT 'warning',
	`status` enum('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
	`resolved_by_user_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`resolved_at` timestamp,
	CONSTRAINT `money_accounting_warnings_id` PRIMARY KEY(`id`),
	CONSTRAINT `money_accounting_warnings_resolution_check` CHECK((
        (`money_accounting_warnings`.`status` = 'resolved' and `money_accounting_warnings`.`resolved_at` is not null)
        or
        (`money_accounting_warnings`.`status` <> 'resolved' and `money_accounting_warnings`.`resolved_at` is null)
      ))
);
--> statement-breakpoint
CREATE TABLE `money_ledger_lines` (
	`id` varchar(36) NOT NULL,
	`transaction_id` varchar(36) NOT NULL,
	`line_kind` enum('gross_income','provider_fee','payout_fee','transaction_cost','platform_split','streamer_share_estimate','cost','payout','allocation','refund','chargeback','reversal','currency_conversion','correction_delta') NOT NULL,
	`direction` enum('in','out','neutral') NOT NULL,
	`amount_minor` bigint NOT NULL,
	`currency` varchar(3),
	`value_source` enum('eur','site_credit','restricted_credit','twitch_bits_estimate','twitch_sub_estimate','youtube_membership_estimate','youtube_paid_message_estimate','discord_boost_estimate','other_estimate') NOT NULL DEFAULT 'eur',
	`is_estimate` boolean NOT NULL DEFAULT false,
	`category_key` varchar(80),
	`project_id` varchar(36),
	`project_item_id` varchar(36),
	`rule_version_id` varchar(36),
	`receipt_reference_id` varchar(36),
	`notes_private` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `money_ledger_lines_id` PRIMARY KEY(`id`),
	CONSTRAINT `money_ledger_lines_amount_check` CHECK(`money_ledger_lines`.`amount_minor` >= 0),
	CONSTRAINT `money_ledger_lines_currency_check` CHECK((
        (`money_ledger_lines`.`value_source` = 'eur' and `money_ledger_lines`.`currency` is not null and length(`money_ledger_lines`.`currency`) = 3)
        or
        (`money_ledger_lines`.`value_source` <> 'eur')
      )),
	CONSTRAINT `money_ledger_lines_estimate_check` CHECK((
        `money_ledger_lines`.`value_source` in (
          'twitch_bits_estimate',
          'twitch_sub_estimate',
          'youtube_membership_estimate',
          'youtube_paid_message_estimate',
          'discord_boost_estimate',
          'other_estimate'
        )
        or `money_ledger_lines`.`is_estimate` = false
      ))
);
--> statement-breakpoint
CREATE TABLE `money_ledger_transactions` (
	`id` varchar(36) NOT NULL,
	`transaction_type` enum('income','fee','payout','cost','allocation','refund','reversal','dispute','conversion','correction','report_adjustment') NOT NULL,
	`money_mode` enum('real','provider_sandbox','simulated','test') NOT NULL DEFAULT 'real',
	`source_kind` enum('manual','provider_intake','provider_payment','provider_payout','project','project_item','report','correction') NOT NULL DEFAULT 'manual',
	`source_provider` enum('twitch','youtube','discord','stripe','paypal','kofi','bank','manual','other'),
	`source_id` varchar(191),
	`source_event_id` varchar(191),
	`posting_status` enum('draft','posted','voided') NOT NULL DEFAULT 'draft',
	`occurred_at` timestamp NOT NULL,
	`accounting_at` timestamp NOT NULL,
	`corrects_transaction_id` varchar(36),
	`correction_reason` varchar(500),
	`notes_private` text,
	`created_by_user_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `money_ledger_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `money_ledger_transactions_correction_check` CHECK((
        (
          `money_ledger_transactions`.`transaction_type` = 'correction'
          and `money_ledger_transactions`.`corrects_transaction_id` is not null
          and `money_ledger_transactions`.`correction_reason` is not null
          and trim(`money_ledger_transactions`.`correction_reason`) <> ''
        )
        or
        (
          `money_ledger_transactions`.`transaction_type` <> 'correction'
          and `money_ledger_transactions`.`corrects_transaction_id` is null
        )
      )),
	CONSTRAINT `money_ledger_transactions_source_provider_check` CHECK((
        `money_ledger_transactions`.`source_kind` in ('manual', 'project', 'project_item', 'report', 'correction')
        or `money_ledger_transactions`.`source_provider` is not null
      ))
);
--> statement-breakpoint
CREATE TABLE `money_receipt_references` (
	`id` varchar(36) NOT NULL,
	`reference_type` enum('receipt','invoice','provider_statement','bank_statement','note') NOT NULL,
	`storage_kind` enum('external_url','local_reference','future_upload') NOT NULL,
	`label` varchar(191) NOT NULL,
	`private_reference` varchar(1024) NOT NULL,
	`created_by_user_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `money_receipt_references_id` PRIMARY KEY(`id`),
	CONSTRAINT `money_receipt_references_label_check` CHECK(trim(`money_receipt_references`.`label`) <> ''),
	CONSTRAINT `money_receipt_references_private_reference_check` CHECK(trim(`money_receipt_references`.`private_reference`) <> '')
);
--> statement-breakpoint
CREATE TABLE `money_report_exports` (
	`id` varchar(36) NOT NULL,
	`report_kind` enum('accounting_summary','source_breakdown','project_breakdown','tax_review_export','warning_review') NOT NULL,
	`period_start` timestamp NOT NULL,
	`period_end` timestamp NOT NULL,
	`filters_json` json NOT NULL,
	`rule_version_ids_json` json NOT NULL,
	`warning_counts_json` json NOT NULL,
	`file_kind` enum('csv','xlsx','pdf_summary','none') NOT NULL DEFAULT 'none',
	`file_reference` varchar(1024),
	`file_checksum` varchar(191),
	`generated_by_user_id` varchar(36),
	`generated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `money_report_exports_id` PRIMARY KEY(`id`),
	CONSTRAINT `money_report_exports_period_check` CHECK(`money_report_exports`.`period_end` > `money_report_exports`.`period_start`),
	CONSTRAINT `money_report_exports_file_check` CHECK((
        `money_report_exports`.`file_kind` = 'none'
        or `money_report_exports`.`file_reference` is not null
        or `money_report_exports`.`file_checksum` is not null
      ))
);
--> statement-breakpoint
CREATE TABLE `money_rule_versions` (
	`id` varchar(36) NOT NULL,
	`rule_kind` enum('platform_fee','fixed_transaction_fee','payout_fee','currency_conversion_fee','platform_split','streamer_share_estimate','tax_or_vat_note','manual_override') NOT NULL,
	`provider` enum('twitch','youtube','discord','stripe','paypal','kofi','bank','manual','other'),
	`value_source` enum('eur','site_credit','restricted_credit','twitch_bits_estimate','twitch_sub_estimate','youtube_membership_estimate','youtube_paid_message_estimate','discord_boost_estimate','other_estimate'),
	`applies_to_date_basis` enum('event_date','payout_date','accounting_date') NOT NULL,
	`effective_from` timestamp NOT NULL,
	`effective_until` timestamp,
	`percentage_bps` bigint,
	`fixed_amount_minor` bigint,
	`fixed_currency` varchar(3),
	`rule_payload` json,
	`change_reason` varchar(500) NOT NULL,
	`supersedes_rule_id` varchar(36),
	`created_by_user_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `money_rule_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `money_rule_versions_window_check` CHECK(`money_rule_versions`.`effective_until` is null or `money_rule_versions`.`effective_until` > `money_rule_versions`.`effective_from`),
	CONSTRAINT `money_rule_versions_percentage_check` CHECK(`money_rule_versions`.`percentage_bps` is null or (`money_rule_versions`.`percentage_bps` >= 0 and `money_rule_versions`.`percentage_bps` <= 10000)),
	CONSTRAINT `money_rule_versions_fixed_amount_check` CHECK(`money_rule_versions`.`fixed_amount_minor` is null or `money_rule_versions`.`fixed_amount_minor` >= 0),
	CONSTRAINT `money_rule_versions_change_reason_check` CHECK(trim(`money_rule_versions`.`change_reason`) <> '')
);
--> statement-breakpoint
CREATE INDEX `money_accounting_warnings_target_idx` ON `money_accounting_warnings` (`target_kind`,`target_id`);--> statement-breakpoint
CREATE INDEX `money_accounting_warnings_status_idx` ON `money_accounting_warnings` (`status`,`severity`,`created_at`);--> statement-breakpoint
CREATE INDEX `money_ledger_lines_transaction_idx` ON `money_ledger_lines` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `money_ledger_lines_kind_idx` ON `money_ledger_lines` (`line_kind`);--> statement-breakpoint
CREATE INDEX `money_ledger_lines_category_idx` ON `money_ledger_lines` (`category_key`);--> statement-breakpoint
CREATE INDEX `money_ledger_lines_project_idx` ON `money_ledger_lines` (`project_id`,`project_item_id`);--> statement-breakpoint
CREATE INDEX `money_ledger_lines_rule_idx` ON `money_ledger_lines` (`rule_version_id`);--> statement-breakpoint
CREATE INDEX `money_ledger_lines_receipt_idx` ON `money_ledger_lines` (`receipt_reference_id`);--> statement-breakpoint
CREATE INDEX `money_ledger_transactions_mode_idx` ON `money_ledger_transactions` (`money_mode`,`accounting_at`);--> statement-breakpoint
CREATE INDEX `money_ledger_transactions_type_idx` ON `money_ledger_transactions` (`transaction_type`,`accounting_at`);--> statement-breakpoint
CREATE INDEX `money_ledger_transactions_source_idx` ON `money_ledger_transactions` (`source_kind`,`source_provider`,`source_id`);--> statement-breakpoint
CREATE INDEX `money_ledger_transactions_status_idx` ON `money_ledger_transactions` (`posting_status`,`accounting_at`);--> statement-breakpoint
CREATE INDEX `money_ledger_transactions_correction_idx` ON `money_ledger_transactions` (`corrects_transaction_id`);--> statement-breakpoint
CREATE INDEX `money_receipt_references_type_idx` ON `money_receipt_references` (`reference_type`);--> statement-breakpoint
CREATE INDEX `money_receipt_references_created_by_idx` ON `money_receipt_references` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `money_report_exports_period_idx` ON `money_report_exports` (`report_kind`,`period_start`,`period_end`);--> statement-breakpoint
CREATE INDEX `money_report_exports_generated_by_idx` ON `money_report_exports` (`generated_by_user_id`);--> statement-breakpoint
CREATE INDEX `money_rule_versions_lookup_idx` ON `money_rule_versions` (`rule_kind`,`provider`,`value_source`,`effective_from`);--> statement-breakpoint
CREATE INDEX `money_rule_versions_supersedes_idx` ON `money_rule_versions` (`supersedes_rule_id`);