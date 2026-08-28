CREATE TABLE `music_anonymous_request_buckets` (
	`id` varchar(36) NOT NULL,
	`anonymous_daily_hmac` varchar(64) NOT NULL,
	`amsterdam_date` date NOT NULL,
	`request_count` int NOT NULL DEFAULT 0,
	`last_request_at` timestamp,
	`blocked_until` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `music_anonymous_request_buckets_id` PRIMARY KEY(`id`),
	CONSTRAINT `music_anonymous_request_buckets_daily_uidx` UNIQUE(`anonymous_daily_hmac`,`amsterdam_date`),
	CONSTRAINT `music_anonymous_request_buckets_hmac_check` CHECK(length(`music_anonymous_request_buckets`.`anonymous_daily_hmac`) = 64),
	CONSTRAINT `music_anonymous_request_buckets_count_check` CHECK(`music_anonymous_request_buckets`.`request_count` >= 0)
);
--> statement-breakpoint
CREATE TABLE `music_blacklist_entries` (
	`id` varchar(36) NOT NULL,
	`scope` enum('track','source','artist','provider','external_id','keyword') NOT NULL,
	`track_id` varchar(36),
	`source_id` varchar(36),
	`provider_key` varchar(80),
	`normalized_value` varchar(191) NOT NULL,
	`reason` varchar(500) NOT NULL,
	`severity` enum('temporary','permanent','safety','rights') NOT NULL DEFAULT 'permanent',
	`created_by_user_id` varchar(36) NOT NULL,
	`revoked_by_user_id` varchar(36),
	`revoked_at` timestamp,
	`revocation_reason` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `music_blacklist_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `music_blacklist_entries_value_check` CHECK(trim(`music_blacklist_entries`.`normalized_value`) <> ''),
	CONSTRAINT `music_blacklist_entries_reason_check` CHECK(trim(`music_blacklist_entries`.`reason`) <> ''),
	CONSTRAINT `music_blacklist_entries_revocation_check` CHECK((
        (`music_blacklist_entries`.`revoked_at` is null and `music_blacklist_entries`.`revoked_by_user_id` is null and `music_blacklist_entries`.`revocation_reason` is null)
        or
        (`music_blacklist_entries`.`revoked_at` is not null and `music_blacklist_entries`.`revoked_by_user_id` is not null and `music_blacklist_entries`.`revocation_reason` is not null and trim(`music_blacklist_entries`.`revocation_reason`) <> '')
      )),
	CONSTRAINT `music_blacklist_entries_scope_target_check` CHECK((
        (`music_blacklist_entries`.`scope` = 'track' and `music_blacklist_entries`.`track_id` is not null)
        or (`music_blacklist_entries`.`scope` = 'source' and `music_blacklist_entries`.`source_id` is not null)
        or (`music_blacklist_entries`.`scope` = 'provider' and `music_blacklist_entries`.`provider_key` is not null)
        or (`music_blacklist_entries`.`scope` in ('artist', 'external_id', 'keyword'))
      ))
);
--> statement-breakpoint
CREATE TABLE `music_license_snapshots` (
	`id` varchar(36) NOT NULL,
	`track_id` varchar(36) NOT NULL,
	`source_id` varchar(36) NOT NULL,
	`provider_policy_id` varchar(36),
	`license_name` varchar(191) NOT NULL,
	`license_kind` enum('royalty-free','creative-commons','platform-library','direct-permission','public-domain','custom','unknown') NOT NULL DEFAULT 'unknown',
	`rights_state` enum('eligible','uncertain','ineligible') NOT NULL DEFAULT 'uncertain',
	`live_safe` boolean NOT NULL DEFAULT false,
	`vod_safe` boolean NOT NULL DEFAULT false,
	`attribution_required` boolean NOT NULL DEFAULT true,
	`attribution_text` varchar(1000),
	`proof_url` varchar(1024),
	`proof_storage_ref` varchar(512),
	`license_payload` json,
	`valid_from` timestamp,
	`valid_until` timestamp,
	`captured_by_user_id` varchar(36),
	`captured_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `music_license_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `music_license_snapshots_name_check` CHECK(trim(`music_license_snapshots`.`license_name`) <> ''),
	CONSTRAINT `music_license_snapshots_window_check` CHECK(`music_license_snapshots`.`valid_until` is null or `music_license_snapshots`.`valid_from` is null or `music_license_snapshots`.`valid_until` > `music_license_snapshots`.`valid_from`),
	CONSTRAINT `music_license_snapshots_attribution_check` CHECK(`music_license_snapshots`.`attribution_required` = false or (`music_license_snapshots`.`attribution_text` is not null and trim(`music_license_snapshots`.`attribution_text`) <> '')),
	CONSTRAINT `music_license_snapshots_eligible_safety_check` CHECK(`music_license_snapshots`.`rights_state` <> 'eligible' or `music_license_snapshots`.`live_safe` = true or `music_license_snapshots`.`vod_safe` = true)
);
--> statement-breakpoint
CREATE TABLE `music_play_history` (
	`id` varchar(36) NOT NULL,
	`track_id` varchar(36),
	`source_id` varchar(36),
	`request_id` varchar(36),
	`playlist_id` varchar(36),
	`stream_session_id` varchar(36),
	`stream_schedule_entry_id` varchar(36),
	`started_at` timestamp NOT NULL,
	`ended_at` timestamp,
	`outcome` enum('played','skipped','stopped','failed','blocked','admin_preview') NOT NULL,
	`outcome_reason` varchar(500),
	`public_visible` boolean NOT NULL DEFAULT true,
	`title_snapshot` varchar(191) NOT NULL,
	`artist_snapshot` varchar(191) NOT NULL,
	`duration_seconds_snapshot` int,
	`duration_played_seconds` int,
	`provider_key_snapshot` varchar(80) NOT NULL,
	`source_type_snapshot` enum('provider_catalog','local_audio','external_url','manual_reference') NOT NULL,
	`source_label_snapshot` varchar(191) NOT NULL,
	`source_external_id_snapshot` varchar(191),
	`source_url_snapshot` varchar(1024),
	`preview_url_snapshot` varchar(1024),
	`preview_mime_type_snapshot` varchar(191),
	`source_storage_ref_snapshot` varchar(512),
	`source_sha256_snapshot` varchar(64),
	`license_name_snapshot` varchar(191) NOT NULL,
	`license_kind_snapshot` enum('royalty-free','creative-commons','platform-library','direct-permission','public-domain','custom','unknown') NOT NULL,
	`license_url_snapshot` varchar(1024),
	`provider_policy_url_snapshot` varchar(1024),
	`policy_version_label_snapshot` varchar(191),
	`attribution_text_snapshot` varchar(1000),
	`rights_state_snapshot` enum('eligible','uncertain','ineligible') NOT NULL,
	`review_state_snapshot` enum('unreviewed','review','approved','restricted','rejected','blacklisted') NOT NULL,
	`live_safe_snapshot` boolean NOT NULL,
	`vod_safe_snapshot` boolean NOT NULL,
	`safety_tags_snapshot` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `music_play_history_id` PRIMARY KEY(`id`),
	CONSTRAINT `music_play_history_time_check` CHECK(`music_play_history`.`ended_at` is null or `music_play_history`.`ended_at` >= `music_play_history`.`started_at`),
	CONSTRAINT `music_play_history_duration_snapshot_check` CHECK(`music_play_history`.`duration_seconds_snapshot` is null or `music_play_history`.`duration_seconds_snapshot` > 0),
	CONSTRAINT `music_play_history_duration_played_check` CHECK(`music_play_history`.`duration_played_seconds` is null or `music_play_history`.`duration_played_seconds` >= 0),
	CONSTRAINT `music_play_history_title_snapshot_check` CHECK(trim(`music_play_history`.`title_snapshot`) <> ''),
	CONSTRAINT `music_play_history_artist_snapshot_check` CHECK(trim(`music_play_history`.`artist_snapshot`) <> ''),
	CONSTRAINT `music_play_history_provider_snapshot_check` CHECK(trim(`music_play_history`.`provider_key_snapshot`) <> ''),
	CONSTRAINT `music_play_history_source_snapshot_check` CHECK(trim(`music_play_history`.`source_label_snapshot`) <> ''),
	CONSTRAINT `music_play_history_source_sha256_snapshot_check` CHECK(`music_play_history`.`source_sha256_snapshot` is null or length(`music_play_history`.`source_sha256_snapshot`) = 64),
	CONSTRAINT `music_play_history_preview_snapshot_check` CHECK((
        (`music_play_history`.`preview_url_snapshot` is null and `music_play_history`.`preview_mime_type_snapshot` is null)
        or (
          `music_play_history`.`preview_url_snapshot` is not null
          and trim(`music_play_history`.`preview_url_snapshot`) <> ''
          and left(`music_play_history`.`preview_url_snapshot`, 1) <> '/'
          and lower(`music_play_history`.`preview_url_snapshot`) not like 'file:%'
        )
      )),
	CONSTRAINT `music_play_history_local_audio_snapshot_check` CHECK((
        `music_play_history`.`source_type_snapshot` <> 'local_audio'
        or (
          `music_play_history`.`source_storage_ref_snapshot` is not null
          and trim(`music_play_history`.`source_storage_ref_snapshot`) <> ''
          and left(`music_play_history`.`source_storage_ref_snapshot`, 1) <> '/'
          and lower(`music_play_history`.`source_storage_ref_snapshot`) not like 'file:%'
          and `music_play_history`.`source_sha256_snapshot` is not null
          and length(`music_play_history`.`source_sha256_snapshot`) = 64
          and `music_play_history`.`source_url_snapshot` is null
        )
      )),
	CONSTRAINT `music_play_history_license_snapshot_check` CHECK(trim(`music_play_history`.`license_name_snapshot`) <> ''),
	CONSTRAINT `music_play_history_admin_preview_public_check` CHECK(`music_play_history`.`outcome` <> 'admin_preview' or `music_play_history`.`public_visible` = false),
	CONSTRAINT `music_play_history_eligible_safety_check` CHECK(`music_play_history`.`rights_state_snapshot` <> 'eligible' or `music_play_history`.`live_safe_snapshot` = true or `music_play_history`.`vod_safe_snapshot` = true)
);
--> statement-breakpoint
CREATE TABLE `music_playlist_tracks` (
	`id` varchar(36) NOT NULL,
	`playlist_id` varchar(36) NOT NULL,
	`track_id` varchar(36) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`added_by_user_id` varchar(36),
	`added_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `music_playlist_tracks_id` PRIMARY KEY(`id`),
	CONSTRAINT `music_playlist_tracks_playlist_track_uidx` UNIQUE(`playlist_id`,`track_id`),
	CONSTRAINT `music_playlist_tracks_sort_order_check` CHECK(`music_playlist_tracks`.`sort_order` >= 0)
);
--> statement-breakpoint
CREATE TABLE `music_playlists` (
	`id` varchar(36) NOT NULL,
	`slug` varchar(191) NOT NULL,
	`title` varchar(191) NOT NULL,
	`description` text,
	`visibility` enum('private','unlisted','public') NOT NULL DEFAULT 'private',
	`review_state` enum('draft','review','approved','restricted','archived') NOT NULL DEFAULT 'draft',
	`created_by_user_id` varchar(36),
	`updated_by_user_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `music_playlists_id` PRIMARY KEY(`id`),
	CONSTRAINT `music_playlists_slug_uidx` UNIQUE(`slug`),
	CONSTRAINT `music_playlists_slug_check` CHECK(trim(`music_playlists`.`slug`) <> ''),
	CONSTRAINT `music_playlists_title_check` CHECK(trim(`music_playlists`.`title`) <> '')
);
--> statement-breakpoint
CREATE TABLE `music_provider_policies` (
	`id` varchar(36) NOT NULL,
	`provider_key` varchar(80) NOT NULL,
	`display_name` varchar(191) NOT NULL,
	`provider_type` enum('local','catalog','platform','artist-direct','manual','other') NOT NULL DEFAULT 'catalog',
	`provider_status` enum('allowed','limited','blocked','disabled') NOT NULL DEFAULT 'limited',
	`rights_state` enum('eligible','uncertain','ineligible') NOT NULL DEFAULT 'uncertain',
	`public_requests_enabled` boolean NOT NULL DEFAULT false,
	`public_playback_enabled` boolean NOT NULL DEFAULT false,
	`default_live_safe` boolean NOT NULL DEFAULT false,
	`default_vod_safe` boolean NOT NULL DEFAULT false,
	`attribution_required` boolean NOT NULL DEFAULT true,
	`local_cache_allowed` boolean NOT NULL DEFAULT false,
	`policy_url` varchar(1024),
	`terms_url` varchar(1024),
	`notes_private` text,
	`effective_from` timestamp NOT NULL DEFAULT (now()),
	`effective_until` timestamp,
	`created_by_user_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `music_provider_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `music_provider_policies_provider_key_unique` UNIQUE(`provider_key`),
	CONSTRAINT `music_provider_policies_key_check` CHECK(trim(`music_provider_policies`.`provider_key`) <> ''),
	CONSTRAINT `music_provider_policies_blocked_key_check` CHECK(lower(trim(`music_provider_policies`.`provider_key`)) <> 'spotify'),
	CONSTRAINT `music_provider_policies_name_check` CHECK(trim(`music_provider_policies`.`display_name`) <> ''),
	CONSTRAINT `music_provider_policies_window_check` CHECK(`music_provider_policies`.`effective_until` is null or `music_provider_policies`.`effective_until` > `music_provider_policies`.`effective_from`),
	CONSTRAINT `music_provider_policies_blocked_public_check` CHECK(`music_provider_policies`.`provider_status` <> 'blocked' or (`music_provider_policies`.`public_requests_enabled` = false and `music_provider_policies`.`public_playback_enabled` = false)),
	CONSTRAINT `music_provider_policies_eligible_safety_check` CHECK((
        `music_provider_policies`.`rights_state` <> 'eligible'
        or `music_provider_policies`.`provider_status` <> 'allowed'
        or (`music_provider_policies`.`public_requests_enabled` = false and `music_provider_policies`.`public_playback_enabled` = false)
        or `music_provider_policies`.`default_live_safe` = true
        or `music_provider_policies`.`default_vod_safe` = true
      ))
);
--> statement-breakpoint
CREATE TABLE `music_review_events` (
	`id` varchar(36) NOT NULL,
	`queue_id` varchar(36),
	`track_id` varchar(36),
	`source_id` varchar(36),
	`actor_user_id` varchar(36),
	`event_kind` enum('queue_created','queue_resolved','note_added','rights_state_changed','review_state_changed','approved','restricted','rejected','blacklisted','blacklist_revoked','skip_logged') NOT NULL,
	`previous_rights_state` enum('eligible','uncertain','ineligible'),
	`new_rights_state` enum('eligible','uncertain','ineligible'),
	`previous_review_state` enum('unreviewed','review','approved','restricted','rejected','blacklisted'),
	`new_review_state` enum('unreviewed','review','approved','restricted','rejected','blacklisted'),
	`note` varchar(1000),
	`event_payload` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `music_review_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `music_review_events_rights_change_check` CHECK(`music_review_events`.`event_kind` <> 'rights_state_changed' or `music_review_events`.`new_rights_state` is not null),
	CONSTRAINT `music_review_events_review_change_check` CHECK((
        `music_review_events`.`event_kind` <> 'review_state_changed'
        or `music_review_events`.`new_review_state` is not null
      )),
	CONSTRAINT `music_review_events_terminal_review_check` CHECK((
        (`music_review_events`.`event_kind` <> 'approved' or `music_review_events`.`new_review_state` = 'approved')
        and (`music_review_events`.`event_kind` <> 'restricted' or `music_review_events`.`new_review_state` = 'restricted')
        and (`music_review_events`.`event_kind` <> 'rejected' or `music_review_events`.`new_review_state` = 'rejected')
        and (`music_review_events`.`event_kind` <> 'blacklisted' or `music_review_events`.`new_review_state` = 'blacklisted')
      ))
);
--> statement-breakpoint
CREATE TABLE `music_review_queue` (
	`id` varchar(36) NOT NULL,
	`track_id` varchar(36),
	`source_id` varchar(36),
	`request_id` varchar(36),
	`play_history_id` varchar(36),
	`queue_kind` enum('manual_review','skip_review','rights_uncertain','blacklist_review','provider_policy','user_report') NOT NULL,
	`status` enum('open','in_review','resolved','dismissed') NOT NULL DEFAULT 'open',
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`reason_code` enum('skip','blacklist','rights_uncertain','metadata','safety','provider_policy','user_report','admin') NOT NULL,
	`summary` varchar(500) NOT NULL,
	`details` text,
	`created_by_user_id` varchar(36),
	`assigned_to_user_id` varchar(36),
	`resolved_by_user_id` varchar(36),
	`resolved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `music_review_queue_id` PRIMARY KEY(`id`),
	CONSTRAINT `music_review_queue_summary_check` CHECK(trim(`music_review_queue`.`summary`) <> ''),
	CONSTRAINT `music_review_queue_skip_check` CHECK(`music_review_queue`.`queue_kind` <> 'skip_review' or (`music_review_queue`.`reason_code` = 'skip' and `music_review_queue`.`play_history_id` is not null)),
	CONSTRAINT `music_review_queue_resolution_check` CHECK((
        (`music_review_queue`.`status` in ('open', 'in_review') and `music_review_queue`.`resolved_at` is null and `music_review_queue`.`resolved_by_user_id` is null)
        or
        (`music_review_queue`.`status` in ('resolved', 'dismissed') and `music_review_queue`.`resolved_at` is not null and `music_review_queue`.`resolved_by_user_id` is not null)
      ))
);
--> statement-breakpoint
CREATE TABLE `music_track_requests` (
	`id` varchar(36) NOT NULL,
	`track_id` varchar(36),
	`source_id` varchar(36),
	`requested_by_user_id` varchar(36),
	`anonymous_request_bucket_id` varchar(36),
	`anonymous_daily_hmac` varchar(64),
	`amsterdam_date` date,
	`request_source` enum('member','anonymous','admin') NOT NULL,
	`status` enum('pending','accepted','played','skipped','rejected','expired','cancelled') NOT NULL DEFAULT 'pending',
	`request_text` varchar(500),
	`provider_key` varchar(80),
	`stream_session_id` varchar(36),
	`outcome_reason` varchar(500),
	`created_by_user_id` varchar(36),
	`resolved_by_user_id` varchar(36),
	`resolved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `music_track_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `music_track_requests_anonymous_hmac_check` CHECK(`music_track_requests`.`anonymous_daily_hmac` is null or length(`music_track_requests`.`anonymous_daily_hmac`) = 64),
	CONSTRAINT `music_track_requests_identity_check` CHECK((
        (
          `music_track_requests`.`request_source` = 'member'
          and `music_track_requests`.`requested_by_user_id` is not null
          and `music_track_requests`.`anonymous_request_bucket_id` is null
          and `music_track_requests`.`anonymous_daily_hmac` is null
          and `music_track_requests`.`amsterdam_date` is null
        )
        or
        (
          `music_track_requests`.`request_source` = 'anonymous'
          and `music_track_requests`.`requested_by_user_id` is null
          and `music_track_requests`.`anonymous_request_bucket_id` is not null
          and `music_track_requests`.`anonymous_daily_hmac` is not null
          and length(`music_track_requests`.`anonymous_daily_hmac`) = 64
          and `music_track_requests`.`amsterdam_date` is not null
        )
        or
        (
          `music_track_requests`.`request_source` = 'admin'
          and `music_track_requests`.`anonymous_request_bucket_id` is null
          and `music_track_requests`.`anonymous_daily_hmac` is null
          and `music_track_requests`.`amsterdam_date` is null
        )
      )),
	CONSTRAINT `music_track_requests_resolution_check` CHECK((
        (`music_track_requests`.`status` in ('pending', 'accepted') and `music_track_requests`.`resolved_at` is null)
        or
        (`music_track_requests`.`status` not in ('pending', 'accepted') and `music_track_requests`.`resolved_at` is not null)
      ))
);
--> statement-breakpoint
CREATE TABLE `music_track_sources` (
	`id` varchar(36) NOT NULL,
	`track_id` varchar(36) NOT NULL,
	`provider_policy_id` varchar(36),
	`provider_key` varchar(80) NOT NULL,
	`source_type` enum('provider_catalog','local_audio','external_url','manual_reference') NOT NULL,
	`source_label` varchar(191) NOT NULL,
	`source_external_id` varchar(191),
	`source_url` varchar(1024),
	`preview_url` varchar(1024),
	`storage_ref` varchar(512),
	`sha256` varchar(64),
	`mime_type` varchar(120),
	`preview_mime_type` varchar(191),
	`duration_seconds` int,
	`rights_state` enum('eligible','uncertain','ineligible') NOT NULL DEFAULT 'uncertain',
	`availability_status` enum('available','unavailable','removed','error') NOT NULL DEFAULT 'available',
	`attribution_text` varchar(1000),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `music_track_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `music_track_sources_external_uidx` UNIQUE(`provider_key`,`source_external_id`),
	CONSTRAINT `music_track_sources_provider_key_check` CHECK(trim(`music_track_sources`.`provider_key`) <> ''),
	CONSTRAINT `music_track_sources_blocked_key_check` CHECK(lower(trim(`music_track_sources`.`provider_key`)) <> 'spotify'),
	CONSTRAINT `music_track_sources_label_check` CHECK(trim(`music_track_sources`.`source_label`) <> ''),
	CONSTRAINT `music_track_sources_duration_check` CHECK(`music_track_sources`.`duration_seconds` is null or `music_track_sources`.`duration_seconds` > 0),
	CONSTRAINT `music_track_sources_sha256_check` CHECK(`music_track_sources`.`sha256` is null or length(`music_track_sources`.`sha256`) = 64),
	CONSTRAINT `music_track_sources_preview_check` CHECK((
        (`music_track_sources`.`preview_url` is null and `music_track_sources`.`preview_mime_type` is null)
        or (
          `music_track_sources`.`preview_url` is not null
          and trim(`music_track_sources`.`preview_url`) <> ''
          and left(`music_track_sources`.`preview_url`, 1) <> '/'
          and lower(`music_track_sources`.`preview_url`) not like 'file:%'
        )
      )),
	CONSTRAINT `music_track_sources_local_audio_check` CHECK((
        `music_track_sources`.`source_type` <> 'local_audio'
        or (
          `music_track_sources`.`storage_ref` is not null
          and trim(`music_track_sources`.`storage_ref`) <> ''
          and left(`music_track_sources`.`storage_ref`, 1) <> '/'
          and lower(`music_track_sources`.`storage_ref`) not like 'file:%'
          and `music_track_sources`.`sha256` is not null
          and length(`music_track_sources`.`sha256`) = 64
          and `music_track_sources`.`source_url` is null
        )
      ))
);
--> statement-breakpoint
CREATE TABLE `music_tracks` (
	`id` varchar(36) NOT NULL,
	`slug` varchar(191) NOT NULL,
	`title` varchar(191) NOT NULL,
	`artist` varchar(191) NOT NULL,
	`album` varchar(191),
	`duration_seconds` int,
	`isrc` varchar(32),
	`normalized_title_artist_key` varchar(191),
	`rights_state` enum('eligible','uncertain','ineligible') NOT NULL DEFAULT 'uncertain',
	`review_state` enum('unreviewed','review','approved','restricted','rejected','blacklisted') NOT NULL DEFAULT 'unreviewed',
	`live_safe` boolean NOT NULL DEFAULT false,
	`vod_safe` boolean NOT NULL DEFAULT false,
	`explicit_content` boolean NOT NULL DEFAULT false,
	`instrumental` boolean NOT NULL DEFAULT false,
	`safety_tags` json NOT NULL,
	`notes_private` text,
	`created_by_user_id` varchar(36),
	`updated_by_user_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `music_tracks_id` PRIMARY KEY(`id`),
	CONSTRAINT `music_tracks_slug_uidx` UNIQUE(`slug`),
	CONSTRAINT `music_tracks_slug_check` CHECK(trim(`music_tracks`.`slug`) <> ''),
	CONSTRAINT `music_tracks_title_check` CHECK(trim(`music_tracks`.`title`) <> ''),
	CONSTRAINT `music_tracks_artist_check` CHECK(trim(`music_tracks`.`artist`) <> ''),
	CONSTRAINT `music_tracks_duration_check` CHECK(`music_tracks`.`duration_seconds` is null or `music_tracks`.`duration_seconds` > 0),
	CONSTRAINT `music_tracks_eligible_safety_check` CHECK((
        `music_tracks`.`rights_state` <> 'eligible'
        or `music_tracks`.`review_state` in ('review', 'restricted', 'rejected', 'blacklisted')
        or `music_tracks`.`live_safe` = true
        or `music_tracks`.`vod_safe` = true
      ))
);
--> statement-breakpoint
CREATE TABLE `music_user_ranked_picks` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`track_id` varchar(36) NOT NULL,
	`rank` int NOT NULL,
	`status` enum('active','paused','removed') NOT NULL DEFAULT 'active',
	`note` varchar(280),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `music_user_ranked_picks_id` PRIMARY KEY(`id`),
	CONSTRAINT `music_user_ranked_picks_user_track_uidx` UNIQUE(`user_id`,`track_id`),
	CONSTRAINT `music_user_ranked_picks_user_rank_uidx` UNIQUE(`user_id`,`rank`),
	CONSTRAINT `music_user_ranked_picks_rank_check` CHECK(`music_user_ranked_picks`.`rank` > 0 and `music_user_ranked_picks`.`rank` <= 1000)
);
--> statement-breakpoint
CREATE INDEX `music_anonymous_request_buckets_date_idx` ON `music_anonymous_request_buckets` (`amsterdam_date`);--> statement-breakpoint
CREATE INDEX `music_anonymous_request_buckets_blocked_idx` ON `music_anonymous_request_buckets` (`blocked_until`);--> statement-breakpoint
CREATE INDEX `music_blacklist_entries_scope_value_idx` ON `music_blacklist_entries` (`scope`,`normalized_value`);--> statement-breakpoint
CREATE INDEX `music_blacklist_entries_track_idx` ON `music_blacklist_entries` (`track_id`,`revoked_at`);--> statement-breakpoint
CREATE INDEX `music_blacklist_entries_source_idx` ON `music_blacklist_entries` (`source_id`,`revoked_at`);--> statement-breakpoint
CREATE INDEX `music_blacklist_entries_provider_idx` ON `music_blacklist_entries` (`provider_key`,`revoked_at`);--> statement-breakpoint
CREATE INDEX `music_license_snapshots_source_captured_idx` ON `music_license_snapshots` (`source_id`,`captured_at`);--> statement-breakpoint
CREATE INDEX `music_license_snapshots_track_idx` ON `music_license_snapshots` (`track_id`,`captured_at`);--> statement-breakpoint
CREATE INDEX `music_license_snapshots_rights_idx` ON `music_license_snapshots` (`rights_state`,`captured_at`);--> statement-breakpoint
CREATE INDEX `music_license_snapshots_live_idx` ON `music_license_snapshots` (`rights_state`,`live_safe`,`captured_at`);--> statement-breakpoint
CREATE INDEX `music_license_snapshots_vod_idx` ON `music_license_snapshots` (`rights_state`,`vod_safe`,`captured_at`);--> statement-breakpoint
CREATE INDEX `music_license_snapshots_policy_idx` ON `music_license_snapshots` (`provider_policy_id`);--> statement-breakpoint
CREATE INDEX `music_play_history_started_idx` ON `music_play_history` (`started_at`);--> statement-breakpoint
CREATE INDEX `music_play_history_public_idx` ON `music_play_history` (`public_visible`,`started_at`);--> statement-breakpoint
CREATE INDEX `music_play_history_track_idx` ON `music_play_history` (`track_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `music_play_history_request_idx` ON `music_play_history` (`request_id`);--> statement-breakpoint
CREATE INDEX `music_play_history_stream_idx` ON `music_play_history` (`stream_session_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `music_play_history_outcome_idx` ON `music_play_history` (`outcome`,`started_at`);--> statement-breakpoint
CREATE INDEX `music_play_history_live_safety_idx` ON `music_play_history` (`live_safe_snapshot`,`started_at`);--> statement-breakpoint
CREATE INDEX `music_play_history_vod_safety_idx` ON `music_play_history` (`vod_safe_snapshot`,`started_at`);--> statement-breakpoint
CREATE INDEX `music_playlist_tracks_playlist_order_idx` ON `music_playlist_tracks` (`playlist_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `music_playlist_tracks_track_idx` ON `music_playlist_tracks` (`track_id`);--> statement-breakpoint
CREATE INDEX `music_playlists_public_idx` ON `music_playlists` (`visibility`,`review_state`,`updated_at`);--> statement-breakpoint
CREATE INDEX `music_provider_policies_public_idx` ON `music_provider_policies` (`provider_status`,`public_requests_enabled`,`public_playback_enabled`);--> statement-breakpoint
CREATE INDEX `music_provider_policies_rights_idx` ON `music_provider_policies` (`rights_state`,`provider_status`);--> statement-breakpoint
CREATE INDEX `music_provider_policies_live_catalog_idx` ON `music_provider_policies` (`provider_status`,`rights_state`,`default_live_safe`);--> statement-breakpoint
CREATE INDEX `music_provider_policies_vod_catalog_idx` ON `music_provider_policies` (`provider_status`,`rights_state`,`default_vod_safe`);--> statement-breakpoint
CREATE INDEX `music_provider_policies_effective_idx` ON `music_provider_policies` (`provider_key`,`effective_from`,`effective_until`);--> statement-breakpoint
CREATE INDEX `music_review_events_queue_created_idx` ON `music_review_events` (`queue_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `music_review_events_track_created_idx` ON `music_review_events` (`track_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `music_review_events_source_created_idx` ON `music_review_events` (`source_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `music_review_events_actor_created_idx` ON `music_review_events` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `music_review_events_kind_created_idx` ON `music_review_events` (`event_kind`,`created_at`);--> statement-breakpoint
CREATE INDEX `music_review_queue_status_priority_idx` ON `music_review_queue` (`status`,`priority`,`created_at`);--> statement-breakpoint
CREATE INDEX `music_review_queue_track_status_idx` ON `music_review_queue` (`track_id`,`status`);--> statement-breakpoint
CREATE INDEX `music_review_queue_source_idx` ON `music_review_queue` (`source_id`);--> statement-breakpoint
CREATE INDEX `music_review_queue_request_idx` ON `music_review_queue` (`request_id`);--> statement-breakpoint
CREATE INDEX `music_review_queue_play_history_idx` ON `music_review_queue` (`play_history_id`);--> statement-breakpoint
CREATE INDEX `music_review_queue_assignee_idx` ON `music_review_queue` (`assigned_to_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `music_review_queue_reason_idx` ON `music_review_queue` (`reason_code`,`created_at`);--> statement-breakpoint
CREATE INDEX `music_track_requests_status_created_idx` ON `music_track_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `music_track_requests_track_status_idx` ON `music_track_requests` (`track_id`,`status`);--> statement-breakpoint
CREATE INDEX `music_track_requests_user_created_idx` ON `music_track_requests` (`requested_by_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `music_track_requests_anonymous_idx` ON `music_track_requests` (`anonymous_daily_hmac`,`amsterdam_date`);--> statement-breakpoint
CREATE INDEX `music_track_requests_bucket_idx` ON `music_track_requests` (`anonymous_request_bucket_id`);--> statement-breakpoint
CREATE INDEX `music_track_requests_stream_idx` ON `music_track_requests` (`stream_session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `music_track_sources_track_idx` ON `music_track_sources` (`track_id`);--> statement-breakpoint
CREATE INDEX `music_track_sources_provider_idx` ON `music_track_sources` (`provider_key`,`availability_status`);--> statement-breakpoint
CREATE INDEX `music_track_sources_rights_idx` ON `music_track_sources` (`rights_state`,`availability_status`);--> statement-breakpoint
CREATE INDEX `music_track_sources_policy_idx` ON `music_track_sources` (`provider_policy_id`);--> statement-breakpoint
CREATE INDEX `music_tracks_public_candidate_idx` ON `music_tracks` (`rights_state`,`review_state`,`created_at`);--> statement-breakpoint
CREATE INDEX `music_tracks_live_catalog_idx` ON `music_tracks` (`rights_state`,`live_safe`,`review_state`,`created_at`);--> statement-breakpoint
CREATE INDEX `music_tracks_vod_catalog_idx` ON `music_tracks` (`rights_state`,`vod_safe`,`review_state`,`created_at`);--> statement-breakpoint
CREATE INDEX `music_tracks_review_idx` ON `music_tracks` (`review_state`,`updated_at`);--> statement-breakpoint
CREATE INDEX `music_tracks_title_artist_idx` ON `music_tracks` (`title`,`artist`);--> statement-breakpoint
CREATE INDEX `music_tracks_normalized_key_idx` ON `music_tracks` (`normalized_title_artist_key`);--> statement-breakpoint
CREATE INDEX `music_user_ranked_picks_track_idx` ON `music_user_ranked_picks` (`track_id`);--> statement-breakpoint
CREATE INDEX `music_user_ranked_picks_status_idx` ON `music_user_ranked_picks` (`status`,`updated_at`);