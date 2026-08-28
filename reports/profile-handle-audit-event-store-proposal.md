# Profile handle audit event-store proposal

Status: design proposal for review only. This file does not generate SQL, edit schema, apply a migration, backfill data, reserve `maiks`, assign a live handle, expose private identity data, change auth/provider behavior, deploy, or touch live services.

## Target proof

- Working target proved before editing: `/home/michael/Documents/Codex/maiks-yt-production`.
- Git top-level proved before editing: `/home/michael/Documents/Codex/maiks-yt-production`.
- Branch proved before editing: `production`.
- Starting HEAD proved before editing: `06aded612e34c0908146fa72e86f81e933ddcf63`.
- Remote proved before editing: `https://github.com/Maiks-AI-Projects/maiks-yt.git`.
- Write scope: this report only.
- Dirty state before editing: none observed.

## Sources checked

- Current request and acceptance criteria.
- `AGENTS.md`: production is the sole forward-development line; schema-affecting work needs backup, migration review, rollback procedure, and state separation.
- `reports/current-work.md`: records `/profiles/maiks`, one-year retired-handle reuse, manual Owner assignment for first handles, and the approved private-profile projection.
- `reports/next-agent-tasks.md`: migration generation is still a separate approval gate; live account changes and provider behavior remain separate.
- `TODO.md`: profile work remains blocked on audit storage, the `maiks` reservation data action, public image routing, and protected backup/restore proof.
- `reports/production-public-copy-and-profile-decisions.md`: confirms `/profiles/maiks`, one-year reuse, manual Owner assignment, searchable private profiles, no private image, and no migration/application authorization.
- `reports/profile-handle-read-model-schema-proposal.md`: proposes one canonical `profile_handles` table and explicitly blocks transitions until this audit/event-store gate is reviewed.
- Existing audit/history code in `packages/database/src/database-community.schema.ts`, `packages/database/src/database-events.schema.ts`, `packages/database/src/database-streaming.schema.ts`, `packages/database/src/database-money.schema.ts`, and the matching API store services for role grants, Event Routing, provider intake, and streamer-chat moderation.
- `reports/backup-restore-runbook.md` and `reports/production-readiness-checklist.md`: production schema changes need protected backup, restore proof, migration rehearsal, rollback decisions, and no worker-generated production migrations.

## Existing patterns

Reusable pieces:

- `role_grant_audit_logs` is the closest reusable transaction pattern. Grant/update/revoke changes mutate current `user_roles` state and insert audit in one transaction. The profile-handle store should reuse that rule, not its exact columns.
- `event_history`, `event_approval_queue`, and `event_cooldown_state` show how a user-visible decision can insert append-only history and related state atomically. The transaction shape is reusable, but the routing destinations and provider actor fields are not.
- `provider_event_intake_logs` is useful precedent for append-only intake, finite processing outcome, redacted payload, and provider-source dedupe. Profile handles should reuse the dedupe idea, not the provider fields.
- `moderation_audit_logs` plus `moderation_active_states` is useful precedent for separating current effect from action history. Its source/action/outcome discipline is reusable. Its provider action columns, target external ids, and moderation-specific reset flags are not.
- `money_ledger_transactions` is precedent for correction instead of destructive rewrite. It is not reusable for profile handles because money retention and legal accounting rules are a separate high-risk gate.

Precedent only:

- `action_item_history` records decision history with previous/new status and actor identity. It is too workflow-specific for profile handles.
- Current `event_history` includes `actorExternalId` and provider display fields. Those are not allowed in profile-handle public or browser DTOs.
- Moderation audit currently exposes some safe rows to the control window. Profile-handle audit must start stricter: no public/browser exposure, and only a minimized Owner operator projection after separate runtime review.

No existing table is a reviewed profile-handle audit/event store. Do not reuse a generic history table as a shortcut.

## Append-only boundary

The first migration/runtime contract must make the audit store enforceably append-only, not just "append-only by convention".

Preferred deployment shape:

- Use a dedicated application DB writer account for profile-handle mutations.
- Grant that account `INSERT` on `profile_handle_operations` and `profile_handle_transition_events`.
- Do not grant ordinary `UPDATE` or `DELETE` on those tables to the runtime account.
- Keep migration/maintenance privileges outside the normal application runtime.

Fallback shape if the deployment cannot provide a separate privilege boundary:

- Add reviewed `BEFORE UPDATE` and `BEFORE DELETE` rejection triggers to both audit tables.
- Treat any maintenance redaction as a separate reviewed migration or maintenance task that temporarily uses a controlled privilege path and writes a superseding/redaction operation.

No normal repository API may update or delete profile-handle audit rows. Corrections are new superseding events under a new operation. If the exact DB account or trigger mechanism cannot be guaranteed for the planned deployment, migration generation must stop.

## Operation record

Add a dedicated append-only `profile_handle_operations` style table in a later migration-generation task. The name is proposed, not authorized SQL.

The operation record is one row per Owner command that safely reaches durable profile-handle audit. It owns idempotency and command outcome. Detail events live under it and describe each canonical handle row touched.

Minimum fields:

| Field | Purpose |
| --- | --- |
| `id` | Internal operation id. Never public or browser-visible. |
| `operation_version` | Starts at `1`; lets future readers parse old rows. |
| `idempotency_key` | Required stable key for retries of the same Owner command. Unique in this table. |
| `request_fingerprint_sha256` | Hash of the normalized command shape, used to detect reused idempotency keys with different input. No raw request body. |
| `operation_type` | Finite command type listed below. |
| `operation_outcome` | Finite operation outcome listed below. |
| `expected_detail_count` | Exact number of detail rows required for this operation. Successful multi-row operations must match this count. |
| `actor_kind` | First release value is only `owner`. |
| `actor_user_id_snapshot` | Internal domain `users.id` string snapshot for the Owner actor. Required. No foreign key. |
| `actor_authority_snapshot` | First release value is only `owner`. |
| `subject_user_id_snapshot` | Nullable internal domain `users.id` string snapshot for the affected account. No foreign key. Null for pure reservations. |
| `subject_boundary` | Finite subject category: user handle, reserved handle, retired handle, or safely normalized missing subject. |
| `reason_code` | Finite internal reason. Do not rely on free text for policy. |
| `operator_note` | Optional bounded Owner note for manual operations. Internal only. |
| `requested_at` | One database timestamp captured inside the transaction. |
| `replay_result` | Finite stored replay response for same-key, same-fingerprint retries. |
| `created_at` | Insert timestamp for the operation row. Normally matches `requested_at` for synchronous writes. |

The user-id snapshots must use the same character set and collation as `users.id`, currently `utf8mb4_general_ci` from the recorded production preflight. They are identity snapshots, not relational ownership. Do not add foreign keys to `users`, do not cascade account deletion into audit rows, and do not imply that hard deletion removes historical evidence. Browser and public projections must never expose these snapshots. Future pseudonymization or note redaction needs a separate reviewed superseding/redaction process.

## Detail event record

Add a dedicated append-only `profile_handle_transition_events` style table in the same later migration-generation task. The name is proposed, not authorized SQL.

The detail event is one row per canonical `profile_handles` row touched by a durable operation. Multi-row operations, such as rename or reservation change, write multiple ordered detail rows under the same operation header. Rejected operations write detail rows only when the normalized command has a safe concrete handle snapshot; otherwise they remain header-only or log-only as described below.

Minimum fields:

| Field | Purpose |
| --- | --- |
| `id` | Internal audit event id. Never public or browser-visible. |
| `operation_id` | Internal reference to the operation header. The migration may enforce a foreign key to `profile_handle_operations`, but not to `users`. |
| `event_sequence` | Positive ordered number inside the operation, usually `1` or `2`. |
| `transition_type` | Finite row-level transition type listed below. |
| `detail_outcome` | Mirrors the operation outcome for this detail row. |
| `handle` | Canonical handle for this row. Use `ascii_bin` so route identity stays byte-stable and case policy stays explicit. |
| `related_handle` | Optional other canonical handle for rename or reservation change. Use the same handle collation. |
| `prior_state` | `none`, `active`, `reserved`, or `retired`, as locked/read from canonical state. |
| `prior_user_id_snapshot` | Internal domain `users.id` snapshot from the prior canonical row when present. No foreign key. |
| `prior_transition_kind` | Existing canonical handle transition kind when a prior row exists. |
| `prior_reusable_after` | Prior retired reuse timestamp when present. |
| `new_state` | `none`, `active`, `reserved`, or `retired`, or the unchanged prior state for a rejected attempt. |
| `new_user_id_snapshot` | Internal domain `users.id` snapshot after the transition when present. No foreign key. |
| `new_transition_kind` | New canonical handle transition kind when a row is written. |
| `new_reusable_after` | New retired reuse timestamp when present. |
| `occurred_at` | One database timestamp captured inside the transaction and shared with the canonical mutation. |
| `created_at` | Insert timestamp for the audit row. Normally matches `occurred_at` for synchronous writes. |

Do not add auth user ids, Better Auth account ids, auth session ids, provider account ids, provider usernames, provider channel ids, OAuth scope lists, token hashes, IP addresses, user agents, emails, raw request bodies, raw errors, Cloudflare/Docker/deployment data, money ids, moderation ids, or public DTO ids to either table.

## Finite values

`operation_type`:

- `owner_reserve_handle`
- `owner_release_reservation`
- `owner_change_reservation`
- `owner_assign_handle`
- `owner_rename_handle`
- `owner_retire_handle`
- `owner_reuse_retired_handle`

`transition_type`:

- `owner_reserved`
- `reservation_released`
- `reservation_changed_from`
- `reservation_changed_to`
- `owner_assigned`
- `expired_reuse_assigned`
- `renamed_from`
- `renamed_to`
- `manual_retired`

`operation_outcome` and `detail_outcome`:

- `applied`
- `denied`
- `invalid`
- `not_found`
- `conflict`
- `stale`

`prior_state` and `new_state`:

- `none`
- `active`
- `reserved`
- `retired`

`actor_kind`:

- `owner`

`actor_authority_snapshot`:

- `owner`

`replay_result`:

- `stored_applied`
- `stored_denied`
- `stored_invalid`
- `stored_not_found`
- `stored_conflict`
- `stored_stale`

First release mutation authority is Owner-only. There is no `system` actor, helper/admin actor, provider actor, startup seed actor, self-claim actor, or account-deletion actor in the first-release schema. User deletion and profile erasure do not ship until their profile-handle audit contract is separately reviewed and migrated.

## State snapshots

Each event row must copy the canonical state that was actually locked and the state that was actually written.

- Owner reservation: `expected_detail_count = 1`; one `owner_reserved` detail records the requested canonical handle moving from `none` to `reserved` with `new_transition_kind = owner_reserved`.
- New assignment with no existing handle row: `prior_state = none`, `new_state = active`, `new_transition_kind = owner_assigned`.
- Reserved `maiks` assignment to Michael's proven domain user: `prior_state = reserved`, `new_state = active`, `new_transition_kind = owner_assigned`.
- Expired retired reuse: `prior_state = retired`, `new_state = active`, `new_transition_kind = expired_reuse_assigned`.
- Rename: one `renamed_from` row records old handle `active` to `retired`; one `renamed_to` row records target handle `none`, `reserved`, or expired `retired` to `active`.
- Reservation change: one `reservation_changed_from` row records old reserved handle to `none`; one `reservation_changed_to` row records new handle `none` to `reserved`.
- Reservation release: one `reservation_released` row records reserved handle to `none`.
- Owner retirement: `expected_detail_count = 1`; one `manual_retired` detail records the active handle moving to `retired`, clears user ownership in canonical state, sets canonical `retired_at` and `reusable_after`, and writes the upstream canonical `new_transition_kind = admin_retired`. Do not write `manual_retired` as the canonical transition kind.

Rejected attempts keep `new_state` equal to the observed prior state unless no row existed, in which case both states are `none`. They still use the requested `transition_type` and a finite non-`applied` outcome.

## First-release operation detail mapping

Applied first-release operations must use this exact cardinality. Replay must verify the stored detail row count equals the operation header's `expected_detail_count`.

| Operation type | `expected_detail_count` | Required detail rows |
| --- | ---: | --- |
| `owner_reserve_handle` | 1 | `owner_reserved`: requested canonical handle `none` to `reserved`; `new_transition_kind = owner_reserved`. |
| `owner_release_reservation` | 1 | `reservation_released`: reserved handle `reserved` to `none`. |
| `owner_change_reservation` | 2 | `reservation_changed_from`: old reserved handle `reserved` to `none`; `reservation_changed_to`: new canonical handle `none` to `reserved`. |
| `owner_assign_handle` | 1 | `owner_assigned`: target handle `none` or `reserved` to `active`; `new_transition_kind = owner_assigned`. |
| `owner_rename_handle` | 2 | `renamed_from`: old active handle `active` to `retired`; `renamed_to`: target handle `none`, `reserved`, or expired `retired` to `active`. |
| `owner_retire_handle` | 1 | `manual_retired`: active handle `active` to `retired`; canonical state clears user ownership, sets `retired_at` and `reusable_after`, and uses `new_transition_kind = admin_retired`. |
| `owner_reuse_retired_handle` | 1 | `expired_reuse_assigned`: expired retired handle `retired` to `active`; `new_transition_kind = expired_reuse_assigned`. |

## Atomicity rule

Successful profile-handle transitions must commit the operation header, exact detail rows, and canonical `profile_handles` mutation in one MariaDB transaction. None may succeed alone.

Required behavior:

1. Normalize and validate handle input before opening the transaction.
2. Resolve the Owner actor to one domain `users.id` through the existing auth link boundary before any mutation.
3. Begin one transaction.
4. Lock the target domain user, existing user handle row, and target handle row with the same deterministic locking order proposed by the read-model schema gate.
5. Capture one database timestamp as `transition_at`.
6. Insert the operation header with its idempotency key, request fingerprint, expected detail count, and stored replay result.
7. Write complete canonical `profile_handles` state changes.
8. Insert the matching detail event row or rows with the same `transition_at`.
9. Require exact affected-row counts for the operation insert, every canonical write, and every detail insert.
10. Commit only after all required writes succeed. Roll back on any missing row, stale row, idempotency collision, check failure, audit insert failure, or affected-row mismatch.

If any audit insert fails, the profile-handle mutation must roll back. If the profile-handle mutation fails after validation, the transaction may insert a durable rejected operation only if no canonical row mutation has succeeded in that transaction and the rejection is a safe precondition result, not an infrastructure failure. Do not commit a partial canonical state just to preserve audit.

## Concurrency and idempotency

- The caller supplies or the server creates an idempotency key before mutation. It must be stable for retries of the same user-level command.
- The canonical request fingerprint is computed from normalized transition type, handle, related handle, subject domain user id when resolved, actor domain user id, and reason code. It must not include free text notes, auth ids, provider ids, tokens, or raw request bodies.
- Repeating the same key with the same fingerprint is a pure replay of the stored operation. It returns the operation's stored replay result, verifies that the stored detail count matches `expected_detail_count`, and performs no canonical mutation, operation insert, detail insert, or duplicate outcome.
- Repeating the same key with a different fingerprint is rejected before mutation. It must not insert a new operation row, detail row, or rejected row using the colliding idempotency key.
- For multi-row transitions, uniqueness must prevent duplicate `(operation_id, event_sequence)` rows and duplicate `(operation_id, handle, transition_type)` rows.
- Concurrent assignment, rename, reservation change, and reuse attempts serialize on the same locked `profile_handles` rows. At most one can commit.
- Deadlock or lock-wait timeout returns a sanitized operational failure outside profile-handle audit unless a safe durable rejected operation was already committed before the infrastructure failure. The caller may safely retry with the same idempotency key.
- A retry after an unknown client timeout must re-read by idempotency key before doing any new write.

## Failed-attempt handling

Durable rejected-operation rows are useful, but they are also a privacy footgun. Keep the first release strict.

Record rejected operations only after the server has resolved an authenticated Owner actor and normalized the requested handle enough to store the canonical handle or a safe rejection marker. Do not write durable profile-handle audit rows for anonymous requests, malformed auth, CSRF failures, non-Owner authority, raw provider callbacks, malformed pre-normalization input, persistence outages, or requests where storing the submitted value would preserve personal data or attack text.

Those excluded failures belong in sanitized security or operational logging, with no profile-handle operation row. A database failure cannot promise a durable failed audit row. Return a safe generic failure and alert through the normal operator path later.

Durable rejected operation outcomes:

- `invalid`: authenticated Owner command passed safe normalization but names an unsupported operation or fails finite domain validation.
- `denied`: authenticated Owner command tries to use a capability outside first-release authority.
- `not_found`: subject domain user or handle row required by the command does not exist.
- `conflict`: requested handle is active, reserved without the required reviewed data action, or retired but not reusable.
- `stale`: locked state no longer matches the command's expected prior state.

Same-key same-fingerprint replay is not an outcome. It returns the stored replay result. Same-key different-fingerprint collision is rejected before durable profile-handle audit and should be visible only through sanitized security or operational logging.

## Reason and note policy

Use a finite `reason_code` for every event. The first set should be small:

- `owner_brand_reservation`
- `owner_manual_assignment`
- `owner_manual_rename`
- `owner_manual_retirement`
- `reservation_cleanup`
- `invalid_request`
- `authority_denied`
- `handle_unavailable`
- `concurrency_retry`

`operator_note` is optional, internal, trimmed, and capped at 280 characters. It must reject control characters and must not contain emails, raw auth ids, provider ids, usernames from providers, token material, IP addresses, database ids from other tables, URLs with secrets, payment references, medical/private profile details, or raw error text. If an operation needs richer evidence, create a separate reviewed internal evidence store later. Do not turn this audit table into a dump for arbitrary support notes.

## Privacy boundaries

- Profile handle is the public route identity. Domain user id, auth id, provider id, linked-account id, role id, support id, moderation id, event id, and money id are not public profile identifiers.
- The audit table is internal database state. Public profile detail, public search, public profile image, RSS, sitemap, and anonymous API responses must never include audit ids, subject ids, actor ids, auth ids, provider ids, notes, reason codes, or event rows.
- Browser DTOs must stay minimized. If an Owner operator view is later built, it must use an opaque audit reference and a safe projection.
- Auth linkage stays outside this table. Resolve `auth_user_links` before mutation, store only internal domain `users.id` snapshots with no foreign keys to `users`, and never copy Better Auth ids, sessions, account ids, emails, or OAuth data into profile-handle audit.
- Provider identities stay outside this table. Do not infer handle ownership from provider email, username, account ordering, channel name, or OAuth account.
- Deleted or anonymized accounts must project as deleted/anonymous in operator views. Do not recover a public identity from audit history, and do not claim account hard deletion removes historical audit evidence.

## Safe operator projection

A future Owner-only operator projection may show:

- Opaque audit reference.
- Timestamp.
- Transition type and outcome.
- Handle and related handle.
- Prior/new finite state labels.
- Subject account display name only when the account is non-deleted and the viewer has Owner authority.
- Actor display name only when the actor is a current non-deleted domain user and the viewer has Owner authority.
- Finite reason label.
- Redacted note, if present and safe.

It must not show:

- Raw audit event id.
- Domain user ids.
- Auth user/account/session ids.
- Provider account/channel/message/user ids.
- Emails.
- Token hashes or token values.
- IP address or user agent.
- Raw SQL errors, driver errors, stack traces, request bodies, or payload JSON.
- Moderation, money, provider, support, deployment, or secret references.

The first migration slice does not need to add this projection. It is listed here so reviewers can block unsafe browser contracts later.

## Retention, redaction, and deletion

Default rule: profile-handle operation and detail rows are append-only. Normal app flows must not update or delete them.

Minimum retention:

- Retain reservation, assignment, rename, retirement, release, and reuse events while the related handle is active, reserved, or retired.
- Retain retirement and reuse evidence for at least the one-year reuse hold plus the reviewer-approved dispute/recovery window.
- Retain durable rejected Owner operations long enough to diagnose abuse or operator mistakes, but shorter than successful transition history unless the reviewer approves otherwise.

Redaction rules:

- Design the row so ordinary redaction is unnecessary: no auth ids, provider ids, emails, tokens, IP addresses, raw errors, or raw payloads.
- Notes are the only likely redaction target. If note redaction is needed, it must be a separate Owner-reviewed maintenance action that records what was redacted and why without exposing the original text.
- Do not silently rewrite state snapshots. If a privacy/legal decision requires stronger redaction of domain user ids, stop and design the superseding/redaction operation before broad user-facing handle mutations ship.

Deletion rules:

- First release does not ship user deletion, profile erasure, or account-deletion handle retirement. Those paths require a separately reviewed future extension and migration.
- Future account deletion/anonymization must not delete profile-handle operation or detail rows as part of the normal app path.
- Public and browser projections must treat deleted users as deleted even when old audit rows contain internal domain user-id snapshots.
- Backups may retain older audit rows until approved backup retention naturally expires. This must be reflected in user-facing deletion/privacy wording before wider profile access expands.

Unresolved decision: exact retention duration and whether future domain user-id snapshots are ever pseudonymized after account deletion still need Owner/coordinator approval. Any pseudonymization must be a separately reviewed superseding/redaction process, not a normal update/delete.

## Backup, restore, and migration gates

Before migration generation:

- This design must be reviewed and approved.
- The `profile_handles` read-model proposal must remain approved or be updated in the same review trail.
- The planned deployment must prove either the dedicated DB writer privilege boundary or the reviewed trigger-based update/delete rejection boundary.
- No one may generate SQL, Drizzle schema, migration files, migration snapshots, seed data, or backfill scripts from this docs-only slice.

Before migration application:

- Generate the schema only in a separate explicitly assigned migration-generation task.
- Review generated SQL for finite enums, operation/detail separation, append-only enforcement, idempotency uniqueness, exact detail-count checks, explicit collations where needed, timestamp precision, no provider/auth fields, no user foreign keys, no user cascades, and no accidental public schema coupling.
- Create a protected production backup with secret-free metadata.
- Prove restore into a disposable non-production database.
- Rehearse migration and rollback against disposable data.
- Record rollback stance for both schema and data.
- Obtain separate migration-application approval.

Before live data actions:

- Prove Michael's production domain user through the Owner-account mapping gate. Do not infer it from email, provider account, row order, or first login.
- Reserve `maiks` through a separate reviewed data action after schema application. Do not seed it in the schema migration.
- Assign `maiks` through a later reviewed Owner-only data action after the reservation exists.
- Keep existing accounts without handles until manual Owner assignment.

Before rollout:

- Implement runtime mutation code only in a later assigned implementation slice.
- Keep public search/detail API and UI separate from mutation/audit work.
- Verify public/browser DTOs with strict parsers that reject raw ids and extra fields.
- Verify transaction rollback when operation insert, detail insert, or canonical mutation fails.
- Verify concurrency with two attempted assignments for the same handle and two attempted handles for the same user.
- Verify idempotent retry with same key and same fingerprint as pure replay, then key reuse with different fingerprint as a pre-mutation collision rejection with no new operation row.
- Verify backup/restore evidence references the exact migration.

## Delivery states

| Area | State |
| --- | --- |
| Design | Proposed in this report. |
| Approval | Not approved by this report. Needs reviewer/coordinator approval. |
| Implementation | Not started. No runtime code authorized here. |
| Integration | Not started. No API, Web, Admin, or public profile integration authorized here. |
| Deployment | Not deployed. No service, schema, or live database change was made. |
| Verification | Limited to document checks requested for this slice. Real database, migration, browser, API, concurrency, backup, restore, and live-account verification remain future gates. |

## Stop conditions

Stop before migration generation if any of these is true:

- Reviewer has not approved this audit/event-store proposal.
- The read-model proposal changes in a way that changes `profile_handles` state, transition kind, collation, or transaction behavior.
- The migration task would need to edit auth, provider, money, moderation enforcement, secrets, Docker, Cloudflare, deployment, or production configuration.
- The generated shape would include auth ids, provider ids, emails, token material, IP addresses, user agents, public DTO ids, or raw request/error payloads.
- The planned deployment cannot guarantee either a dedicated DB writer privilege boundary or reviewed `BEFORE UPDATE`/`BEFORE DELETE` rejection triggers for operation and detail audit tables.
- Drizzle cannot express required uniqueness, finite enum values, timestamp precision, append-only enforcement, no user foreign keys/cascades, or exact charset/collation rules without reviewed SQL adjustment.
- Retention/redaction/deletion policy is required for the specific rollout and remains undecided.

Stop before migration application if any of these is true:

- Protected backup, disposable restore proof, migration rehearsal, or rollback stance is missing.
- Production target, MariaDB version, migration ledger, `users.id` definition, isolation level, or timestamp behavior changed since the recorded preflight and has not been rechecked.
- The migration includes seed data, reserves `maiks`, assigns a handle, backfills users, or changes live account data.
- The reviewer cannot prove migration order after the current ledger.

Stop before any profile-handle transition ships if any of these is true:

- Operation header, exact detail rows, and canonical `profile_handles` mutation are not atomic.
- Rejected-operation behavior is not finite, Owner-authenticated, safely normalized, and privacy-safe.
- Idempotency and concurrency tests are missing.
- Public/browser DTO tests do not reject raw ids and extra fields.
- Mutation authority is broader than Owner-only in the first release.
- Michael's domain user has not been proven for `maiks` assignment.
- Operator projection exposes raw internal ids, auth/provider ids, or unsafe notes.
- Runtime code includes user deletion, profile erasure, account-deletion handle retirement, system actors, provider-driven assignment, self-claim, or delegated helper/admin mutation.

## Unresolved decisions

- Exact retention duration for successful operations and durable rejected Owner operations.
- Whether or when future domain user-id snapshots are pseudonymized after account deletion, and who approves that separate superseding/redaction action.
- Exact opaque-reference format for a future Owner audit browser projection.
- Exact endpoint-to-reason-code mapping when runtime commands are split into concrete endpoints.

## Explicit non-goals

- No SQL, Drizzle schema, migration, snapshot, seed, or backfill generation.
- No runtime mutation service.
- No public profile API, profile image route, search integration, or UI replacement.
- No self-service handle claim, rename, or first-login assignment.
- No delegated admin/helper/moderator assignment.
- No provider-derived handle import.
- No auth, money, moderation enforcement, provider integration, secret, Docker, Cloudflare, deployment, database, account, or live-service change.
