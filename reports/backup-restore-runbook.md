# Backup, Export, and Restore Runbook

Updated: 2026-07-09

Status: Phase E1 planning and inventory only. This runbook is for dev/staging-safe verification of the non-provider foundation work. It does not approve production backup automation, destructive restore, secret handling, provider writes, money behavior, or server-state changes.

## Scope And Boundaries

Use this document to prove that current app-owned data can be exported and restored in a disposable dev/staging database before production release work starts.

Hard boundaries:

- Do not inspect, print, copy into docs, or commit `.env` values, provider credentials, raw OAuth tokens, raw URL tokens, database passwords, VAPID private keys, or Cloudflare secrets.
- Do not run production exports or restores from this worker scope.
- Do not automate production backups from this runbook.
- Do not run destructive restore commands against a shared or production database.
- Do not treat backup restore as a normal user-facing undo feature. Backups are for disaster recovery and rare owner-reviewed improper-deletion recovery.
- Do not make money-ledger retention decisions until the money phase explicitly approves ledger, accounting, correction, refund, chargeback, export, and legal retention policy.

## Current Recovery Inventory

The current app-owned recovery surface is primarily the MySQL database represented by `packages/database/src/*.schema.ts` and the Drizzle migration history in `packages/database/drizzle/`.

### Critical App Data

| Area | Current tables / artifacts | Restore priority | Notes |
| --- | --- | --- | --- |
| Schema and migration history | `packages/database/drizzle/*.sql`, `packages/database/drizzle/meta/*.json` | Required | Keep in git. A data backup without the matching migration sequence is not enough for reliable restore. |
| Core domain users | `users` | Required | Contains display/profile visibility, avatar URL references, and deletion markers. Deleted-user handling must respect privacy erasure rules. |
| Auth and linked identity | `auth_users`, `auth_sessions`, `auth_accounts`, `auth_verifications`, `auth_user_links`, `linked_accounts` | Required, sensitive | Contains account/session/OAuth token-shaped data. Export files must be encrypted and access-limited. Restore tests should use dev accounts only. |
| Roles, grants, and admin authority | `role_rank_paths`, `roles`, `user_roles`, `role_grant_audit_logs` | Required | Restores must preserve explicit owner assignment and grant audit history. Never rely on first-login promotion after restore. |
| Scoped access and dev auth tokens | `url_access_tokens`, `dev_auth_tokens` | Required, sensitive | Raw token values are not stored, but hashes and active/revoked state are security-sensitive. Restored dev/staging tokens should normally be rotated after restore verification. |
| Provider runtime credential records | `provider_runtime_credentials`, `provider_channel_identities` | Required, highly sensitive | Current dev work includes read-only provider credentials/channel selection. Production encryption/key policy is not decided. Restore tests must not expose raw tokens in logs. |
| Push subscriptions and notifications | `system_notifications`, `notification_push_subscriptions` | Required | Notification rows are private system/admin state. Push endpoints/keys are sensitive enough to encrypt backups. |
| Content pages | `content_pages` | Required | Page Creator content, route ownership, draft/published state, and preview-before-publish rules must survive restore. |
| Creator links | `creator_links` | Required | Public Creator Hub link state and unavailable support-link decisions must restore exactly. |
| Projects and updates | `projects`, `project_milestones`, `project_items`, `project_item_links`, `project_updates` | Required | Includes public project data, admin drafts, updates, item links, and future money-adjacent placeholders. |
| Stream schedule/session state | `stream_sessions`, `stream_schedule_entries` | Required | Manual schedule, stream focus links, cancellation state, and related public display state. |
| Overlay and Action Panel state | `overlay_states`, `overlay_events`, `action_items`, `action_item_history` | Required | Overlay state and owner decision history are operationally important; action history should remain append-only. |
| Event routing foundation | `event_routing_rules`, `event_user_opt_outs`, `event_history`, `event_approval_queue`, `event_cooldown_state`, `event_replay_sessions`, `event_replay_events` | Required | Includes opt-outs, event history/audit, pending approvals, cooldowns, and resettable simulated/test rows. |
| Provider intake ledger | `provider_event_intake_logs` | Required | Append-only pre-routing provider intake records with redacted payloads. High-volume retention and pruning policy is still open. |
| Moderation state and audit | `moderation_audit_logs`, `moderation_active_states` | Required | Current moderation is local/manual-first, with fake/local and provider-shaped future fields. Audit and active-state restore must preserve revocation/review context. |
| Value-source and future accounting foundation | `value_sources` plus future money tables | Required when money opens | Current money behavior is not production-live, but future ledger/accounting tables must be treated as immutable and separately retained once approved. |
| App metadata | `app_metadata` | Useful | Version/marker data can help verify restore identity. |

### App-Owned File And Artifact Data

| Area | Current state | Backup treatment |
| --- | --- | --- |
| Uploaded assets | No app-owned upload bucket or local upload table was found in this inventory pass. Profile images are external URL references today. | Revisit before production if avatars, page media, project files, audio clips, or R2/local upload storage are added. |
| Generated smoke and QA outputs | `reports/visual-qa/**`, smoke summaries, and report docs are git/workspace artifacts. | Keep useful reports in git when they are intended history. Do not include ignored token reference files. |
| Local private URL references | `reports/usable-urls.md` is intentionally ignored/local. | Do not back up into repo artifacts or shared export bundles. Rotate tokens if copied outside the intended local machine. |
| Static app assets | Source-controlled app assets and generated manifests/icons. | Covered by git/build artifact recovery, not database export. |
| Runtime caches/in-memory state | Fake/local chat history and immediate moderation runtime caches can be in memory. | Not currently recoverable after process restart unless represented by durable tables. Treat as expected loss unless a future slice adds persistence. |

## Manual Dev Export Procedure

Only use this against a disposable local/dev/staging database selected by the operator. Credentials must come from the operator's shell, password manager, or temporary local client config, never from committed docs or copied terminal output.

1. Confirm target environment.
   - Run `git status --short --branch`.
   - Confirm the database host/name is dev or staging, not production.
   - Confirm no `.env` values will be printed or pasted into the report.

2. Create a dated local export directory outside tracked source, for example:

   ```bash
   mkdir -p /tmp/maiks-yt-backup-smoke/2026-07-09
   chmod 700 /tmp/maiks-yt-backup-smoke/2026-07-09
   ```

3. Export schema and data with a MySQL-native dump tool.
   - Use a local `--defaults-extra-file` or interactive credential prompt so secrets do not appear in shell history.
   - Include routines/triggers only if the environment uses them.
   - Prefer a transactionally consistent export for InnoDB tables.

   Example shape, with paths and credentials supplied locally:

   ```bash
   mysqldump --defaults-extra-file=/path/to/local-dev-client.cnf \
     --single-transaction --quick --routines --triggers \
     --databases maiks_yt_dev \
     > /tmp/maiks-yt-backup-smoke/2026-07-09/maiks_yt_dev.sql
   ```

4. Record export metadata without secrets.
   - Git commit SHA and branch/detached state.
   - Drizzle latest migration file present in the repo.
   - Database name/environment label.
   - Export started/finished timestamps.
   - Dump file size and checksum.
   - Table row counts for the inventory groups above.

   Example:

   ```bash
   sha256sum /tmp/maiks-yt-backup-smoke/2026-07-09/maiks_yt_dev.sql \
     > /tmp/maiks-yt-backup-smoke/2026-07-09/maiks_yt_dev.sql.sha256
   ```

5. Encrypt the export before it leaves the machine or is retained beyond the immediate test window.
   - Encryption tool, key owner, rotation process, and storage location still need Michael's decision.
   - Until that decision exists, treat manual exports as short-lived local test artifacts and delete them after restore verification.

## Manual Restore Verification Procedure

Run this only into a newly created disposable database. Never restore over a shared dev, staging, or production database.

1. Create an empty restore target with a name that makes deletion safe and obvious, such as `maiks_yt_restore_smoke_20260709`.

2. Restore the dump into that empty target using local credentials that are not printed:

   ```bash
   mysql --defaults-extra-file=/path/to/local-restore-client.cnf \
     < /tmp/maiks-yt-backup-smoke/2026-07-09/maiks_yt_dev.sql
   ```

3. Verify migration compatibility.
   - Confirm the restored schema has the expected current tables.
   - Run application checks against the restore target only if the app can be pointed at the disposable database without editing committed config.
   - Do not apply new migrations as part of this restore test unless the test explicitly covers migration-forward restore.

4. Verify table counts and key samples.
   - Compare counts for every table in the inventory.
   - Spot-check public content: one published page, one draft page, one creator link, one public project, one project update, and one schedule entry.
   - Spot-check private/admin state: one role grant, one action item history row, one notification, one active/revoked URL token hash, and one provider channel identity.
   - Spot-check event/moderation state: one routing rule, one opt-out, one provider intake row if available, one event history row, one moderation audit row, and one active moderation state if available.
   - Spot-check privacy: deleted users remain deleted/anonymized exactly as represented in the source database.

5. Verify app-level behavior with dev data if a disposable app instance can be pointed at the restored database.
   - Public `/`, `/links`, `/projects`, `/schedule`, and a published `content_pages` path render without draft leakage.
   - Owner-gated admin pages deny unauthenticated access.
   - Owner-gated admin pages work only with a deliberately minted short-lived dev/staging owner token, not with old raw token values.
   - `/tools/notifications` can read current private notification state in the test instance.
   - Provider intake health surfaces can read summaries without sending provider writes.
   - Event Routing simulated/test rows remain clearly test/simulated/resettable where expected.

6. Clean up.
   - Drop the disposable restore database after verification.
   - Delete short-lived unencrypted dumps.
   - Record the verification result in a report without secrets, raw tokens, provider payloads, or personal data samples.

## Rare Improper-Deletion Recovery Drill

This is for owner-reviewed recovery after admin abuse, account compromise, or severe operator mistake. It is not a normal account-restore promise.

Dev/staging drill:

1. Use a disposable restored database, not the live dev database.
2. Identify the affected domain user, auth link, linked accounts, role grants, content/project/schedule references, event history, moderation state, and notification records by IDs only.
3. Decide whether recovery is allowed under the privacy policy and deletion intent.
4. Restore only the minimum records needed to correct the improper deletion.
5. Preserve audit context showing who approved recovery, what source backup was used, and what was restored.
6. Rotate sessions, URL tokens, dev auth tokens, and provider credentials after any account/security restore.
7. If the original action was an intentional user deletion, do not use backups to silently reverse it. Deleted personal data may exist in older backups only until backup retention naturally rotates it out.

Open gate: Michael must decide who can approve rare recovery, how many approvals are needed, whether the user is notified, and how restored data interacts with account deletion/anonymization promises.

## Retention, Encryption, Access, And Ownership Decisions

Michael/coordinator decisions still required before production backup work:

- Backup frequency for database exports.
- Recovery point objective and recovery time objective.
- Backup target: local backup database, separate disk, off-host storage, or both.
- Encryption method, key owner, key rotation, and emergency key access.
- Which operator role can create backups.
- Which operator role can restore backups.
- Whether restore requires two-person approval.
- How backup access is audited.
- How long normal database backups are retained.
- How long high-volume provider intake/event history rows are retained.
- How long chat/moderation logs are retained.
- How account deletion/anonymization interacts with backup retention.
- Whether auth/session/token tables are restored as-is or rotated after every restore.
- Whether provider runtime credentials are restored, revoked, or re-consented after a restore.
- How future money ledger/accounting tables are retained, exported, and corrected without destructive edits.

Until these decisions are approved, production backup automation remains blocked.

## Backup Health Warnings

Future backup health checks should feed the existing notification panel as failures only.

Expected warning behavior:

- Healthy backup checks stay quiet.
- A missed backup, failed dump, failed encryption, failed upload/copy, failed checksum, stale latest backup, or failed restore drill creates a `warning` or `critical` system notification.
- Duplicate failures should be suppressed by stable failure signature, matching the current dev smoke notification pattern.
- Recovery-after-failure may create a single informational recovery note if the previous run had alerted.
- Backup health checks should not include dump contents, credentials, raw file paths with secrets, raw provider payloads, raw tokens, or personal-data samples in notification bodies.
- Backup health should be distinguishable from provider, moderation, money, and normal dev smoke alerts. If `system_notifications.source` still has no backup-specific value, use a stable title/signature prefix under the existing `system` source until a schema-approved notification source is added.

Open implementation gate: this runbook does not add backup-health code. A later slice can add a dev/staging-only smoke check after retention/encryption/export shape is approved.

## Production Readiness Gates

Do not open production backup automation until all of these are true:

- Manual dev/staging export and restore drill has passed and is recorded.
- Retention and encryption decisions are approved.
- Restore owner and approval path are approved.
- Secrets/key storage policy is approved.
- Account deletion/privacy retention language is approved.
- Money ledger retention/export/correction rules are approved before real money tables exist.
- Destructive restore procedure has a dry-run and confirmation path.
- Backup failure notifications are failure-only and owner-visible.
- Production restore has rollback and post-restore smoke steps.

## Current Gaps

- No production backup automation exists in this slice.
- No encryption/key policy has been approved.
- No restore owner/two-person approval policy has been approved.
- No app-owned upload/media storage was found, but future media features need a separate asset backup plan.
- Runtime in-memory fake/local chat and immediate moderation caches are not fully recoverable unless represented in durable tables.
- Provider runtime credentials exist in the database shape and are sensitive; production storage/encryption/re-consent rules are not decided.
- Future real money tables do not exist yet, so ledger retention/export/correction policy remains a money-phase blocker.
