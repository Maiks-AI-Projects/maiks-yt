# Profile handle read model schema proposal

Status: proposal for review only. This does not generate SQL, edit schema, apply a migration, backfill data, change live accounts, publish private information, deploy, or change auth/provider behavior.

## Target proof

- Working target proved before editing: `/home/michael/Documents/Codex/maiks-yt-production`.
- Git top-level proved before editing: `/home/michael/Documents/Codex/maiks-yt-production`.
- Branch proved before editing: `production`.
- Write scope: this report only.
- Nearby dirty state observed but not touched: `reports/current-work.md`.

## Sources checked

- Current request and senior-review blockers.
- `reports/current-work.md`: Michael selected `/profiles/maiks`, one-year retired-handle reuse, manual Owner assignment for first handles, and the approved private projection.
- `reports/next-agent-tasks.md`: submission authorizes a schema and migration proposal for review only, not migration generation, application, or backfill.
- `TODO.md`: real profiles still need a stable-handle gate before replacing static profile examples.
- `packages/database/src/database-core.schema.ts`: `users` currently owns `id`, `display_name`, `profile_visibility`, `avatar_url`, `deleted_at`, and timestamps.
- `packages/database/src/database-auth.schema.ts`: Better Auth rows, domain user links, and linked provider accounts are separate from public profile reads.

## Approved decisions preserved

- Michael's permanent public profile address is `/profiles/maiks`.
- Retired profile handles may be reused only after one year.
- Existing accounts receive their first handle only when the Owner assigns it manually.
- Private accounts remain searchable.
- A private profile displays only the account name and exact text `This account is set to private`.
- A private profile displays no profile image.
- Profile handle is the public route identity. It is not an auth user id, provider account id, provider username, role, support identity, moderation identity, or linked-account identity.

## Corrected model

Use one canonical `profile_handles` table. Do not add `users.profile_handle`. Do not add a separate lock table.

The senior-review issue with the old split model was real: active handle on `users` and unavailable handle in a lock table cannot make the database enforce one finite state for one handle. The corrected model stores active, reserved, and retired handles in one row keyed by the handle itself.

Public profile reads join canonical active handles to non-deleted domain users:

```sql
select
  ph.handle,
  u.display_name,
  u.profile_visibility,
  u.avatar_url
from profile_handles ph
join users u on u.id = ph.user_id
where ph.handle = ?
  and ph.state = 'active'
  and u.deleted_at is null;
```

The public DTO must not include `u.id`, auth ids, provider ids, linked-account ids, role ids, support records, moderation records, event ids, or money records.

## Minimal persistence shape

Add only profile-handle persistence:

- `handle`: canonical public route segment and primary key.
- `state`: finite state, `active`, `reserved`, or `retired`.
- `user_id`: nullable domain `users.id`, unique when present, and present only for `active`.
- `reserved_at`: set only for reserved handles.
- `assigned_at`: set only for active handles.
- `retired_at`: set only for retired handles.
- `reusable_after`: set only for retired handles, at least one year after `retired_at`.
- `transition_kind`: finite internal reason for the current state.
- `operator_user_id`: nullable internal audit pointer to the domain user who approved or performed the transition. It is justified because first assignment, `maiks` reservation, rename, deletion retirement, and manual retirement are reviewed operator actions. It must never appear in public profile/search/image responses.
- `created_at` and `updated_at`.

Do not add linked identities, recognition, perks, provider rows, game names, moderation records, money fields, or consent fields in this slice.

## Concrete DDL intent

This is DDL intent for the later migration-generation task. It is not authorization to generate or apply the migration.

```sql
create table profile_handles (
  handle varchar(32) character set ascii collate ascii_bin not null,
  state enum('active', 'reserved', 'retired') not null,
  user_id varchar(36) character set utf8mb4 collate utf8mb4_general_ci null,
  reserved_at timestamp null,
  assigned_at timestamp null,
  retired_at timestamp null,
  reusable_after timestamp null,
  transition_kind enum(
    'owner_reserved',
    'policy_reserved',
    'owner_assigned',
    'expired_reuse_assigned',
    'renamed',
    'deleted_user',
    'admin_retired'
  ) not null,
  operator_user_id varchar(36) character set utf8mb4 collate utf8mb4_general_ci null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  primary key (handle),
  unique key profile_handles_user_id_uidx (user_id),
  key profile_handles_state_reusable_idx (state, reusable_after),
  key profile_handles_user_state_idx (user_id, state),
  constraint profile_handles_handle_ascii_check check (
    handle regexp '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'
    and handle not regexp '--'
    and handle = lower(handle)
  ),
  constraint profile_handles_state_shape_check check (
    (
      state = 'active'
      and user_id is not null
      and reserved_at is null
      and assigned_at is not null
      and retired_at is null
      and reusable_after is null
      and transition_kind in ('owner_assigned', 'expired_reuse_assigned')
    )
    or (
      state = 'reserved'
      and user_id is null
      and reserved_at is not null
      and assigned_at is null
      and retired_at is null
      and reusable_after is null
      and transition_kind in ('owner_reserved', 'policy_reserved')
    )
    or (
      state = 'retired'
      and user_id is null
      and reserved_at is null
      and assigned_at is null
      and retired_at is not null
      and reusable_after is not null
      and reusable_after >= retired_at + interval 1 year
      and transition_kind in ('renamed', 'deleted_user', 'admin_retired')
    )
  )
) engine = InnoDB default character set utf8mb4 collate utf8mb4_general_ci;
```

DDL notes:

- `character set ascii collate ascii_bin` is part of the proposal, not a nice-to-have. It keeps handle equality byte-oriented for the allowed ASCII set and makes case-only variants collide after normalization.
- `user_id` and the proposed `operator_user_id` explicitly use `character set utf8mb4 collate utf8mb4_general_ci` to match production `users.id`. Do not let either column inherit the handle collation or another table/database default.
- `engine = InnoDB default character set utf8mb4 collate utf8mb4_general_ci` is explicit. The handle column remains the deliberate per-column `ascii_bin` exception.
- `varchar(32)` is the stored handle length. Domain normalization accepts 3 to 32 characters after removing one optional leading `@`.
- The primary key on `handle` makes one state row authoritative.
- `unique key profile_handles_user_id_uidx (user_id)` allows many `NULL` values in MariaDB while limiting a domain user to one active handle. The state check prevents reserved or retired rows from carrying a `user_id`.
- The one-year hold is both a database check and a domain rule. The domain rule must compute `reusable_after` as `retired_at + interval 1 year` or later.
- If Drizzle cannot express the engine, table default, per-column charset/collation, nullable unique key, or check clauses exactly, the migration-generation task must stop for reviewed SQL adjustment. It must not silently emit inherited-collation identifier columns or a default-collation handle.

## Completed MariaDB preflight

The coordinator completed the production MariaDB preflight before this revision. This report records the supplied result; this proposal task did not reconnect to or modify the database.

- Production runs MariaDB `10.11.16` and enforces `CHECK` constraints.
- The `ascii_bin` collation is available.
- Nullable `UNIQUE` behavior and the proposed `SELECT ... FOR UPDATE` locking pattern are compatible with the production server.
- The transaction isolation level is `REPEATABLE-READ`.
- The system time zone and observed current timestamps are UTC.
- Existing production timestamp columns use precision `0`. The proposed unqualified `timestamp` columns therefore match existing precision.
- Production `users.id` uses `utf8mb4_general_ci`. Both proposed user-reference columns must use `character set utf8mb4 collate utf8mb4_general_ci` explicitly.
- No `profile_handles` table, `profile_handle_locks` table, or `users.profile_handle` column exists.
- A session-temporary inherited-collation join probe reproduced `ERROR 1267`, proving that inherited incompatible collations can break the proposed user join.
- The preflight left no persistent preflight table behind.

This closes the version, check-enforcement, collation-availability, nullable-unique, locking, isolation, timezone, timestamp-precision, and conflicting-schema preflight questions. It does not authorize migration generation or application. If the production target, MariaDB version, `users.id` definition, isolation level, or relevant server settings change before migration generation, stop and repeat the read-only preflight.

## Handle normalization and reserved words

Owner/admin input normalization:

1. Trim surrounding ASCII whitespace.
2. Accept one optional leading `@`, then discard it.
3. Lowercase ASCII A through Z.
4. Reject anything outside lowercase ASCII letters, digits, and hyphen.
5. Reject percent encoding, slash, backslash, period, underscore, spaces, query/hash characters, Unicode, control characters, and invisible formatting characters.
6. Reject handles shorter than 3 or longer than 32 characters after normalization.
7. Reject leading hyphen, trailing hyphen, and consecutive hyphens.
8. Reject values that would normalize to a different stored URL segment.

Reserved route and operational words:

- `account`
- `admin`
- `api`
- `auth`
- `games`
- `image`
- `images`
- `maiks`, except for the approved Owner reservation and assignment
- `me`
- `new`
- `privacy`
- `projects`
- `schedule`
- `search`
- `settings`
- `support`
- `tools`
- `updates`

`Maiks`, `maiks`, and `@maiks` all normalize to `maiks` and collide.

## State invariants

`active`:

- `user_id` is present and unique.
- `assigned_at` is present.
- `reserved_at`, `retired_at`, and `reusable_after` are null.
- `transition_kind` is `owner_assigned` or `expired_reuse_assigned`.
- Public lookup may join this row to `users` only when `users.deleted_at is null`.

`reserved`:

- `user_id` is null.
- `reserved_at` is present.
- `assigned_at`, `retired_at`, and `reusable_after` are null.
- `transition_kind` is `owner_reserved` or `policy_reserved`.
- The row blocks assignment except through a reviewed data action. `maiks` starts here only after that data action is approved.

`retired`:

- `user_id` is null.
- `retired_at` is present.
- `reusable_after` is present and at least one year after `retired_at`.
- `reserved_at` and `assigned_at` are null.
- `transition_kind` is `renamed`, `deleted_user`, or `admin_retired`.
- Public profile lookup by the handle returns not found while retired.

No separate deleted state is needed. Deletion is a typed transition that moves an active handle to `retired` with `transition_kind = 'deleted_user'`, clears `user_id`, and sets the one-year reuse lock.

## Transaction and locking protocol

All handle mutations must use one MariaDB transaction. On any failure, roll back the whole transaction. No handler may update `users` and `profile_handles` in separate commits. Each insert or update that changes state must write every state-constrained column in one SQL statement. Do not update `state` first and repair timestamps or ownership in a later statement; MariaDB evaluates the row check for each statement.

Assignment to a user with no current handle:

1. Normalize and validate the requested handle before opening the transaction.
2. Begin a transaction.
3. Lock the target domain user with `select ... from users where id = ? for update`; reject if missing or deleted.
4. Lock any current handle for the target user with `select ... from profile_handles where user_id = ? for update`; reject if one exists.
5. Lock the requested handle row with `select ... from profile_handles where handle = ? for update`.
6. Capture one database timestamp as `transition_at` for all timestamp values written by this transition.
7. If no row exists, insert one complete `active` row in one statement: `state = 'active'`, `user_id = target_user_id`, `assigned_at = transition_at`, `reserved_at = null`, `retired_at = null`, `reusable_after = null`, `transition_kind = 'owner_assigned'`, and `operator_user_id = acting_operator_user_id` under the current audit-column proposal.
8. If the row is `reserved`, allow assignment only through the matching reviewed data action. For `maiks`, the target must be Michael's proven domain user. Update the locked row in one statement: set `state = 'active'`, set `user_id = target_user_id`, set `assigned_at = transition_at`, clear `reserved_at`, `retired_at`, and `reusable_after`, set `transition_kind = 'owner_assigned'`, and set `operator_user_id = acting_operator_user_id` under the current audit-column proposal.
9. If the row is `retired`, allow assignment only when the value read under the lock satisfies `reusable_after <= transition_at`. Update the locked row in one statement: set `state = 'active'`, set `user_id = target_user_id`, set `assigned_at = transition_at`, clear `reserved_at`, `retired_at`, and `reusable_after`, set `transition_kind = 'expired_reuse_assigned'`, and set `operator_user_id = acting_operator_user_id` under the current audit-column proposal.
10. If the row is active or unexpired retired, reject without writing.
11. Re-read or check the affected-row count as appropriate; require exactly one inserted or updated active row for the target user.
12. Commit. The insert or update statement writes the whole active state shape atomically, so no committed row can retain reservation or retirement timestamps.

Rename:

1. Normalize and validate the new handle.
2. Begin a transaction.
3. Lock the domain user with `for update`; reject if missing or deleted.
4. Lock the user's current active handle and the requested handle in deterministic `handle` sort order with `for update` to reduce deadlock risk.
5. Capture one database timestamp as `transition_at`. Update the old active handle row in one statement: set `state = 'retired'`, clear `user_id`, clear `reserved_at` and `assigned_at`, set `retired_at = transition_at`, set `reusable_after = transition_at + interval 1 year`, set `transition_kind = 'renamed'`, and set `operator_user_id = acting_operator_user_id` under the current audit-column proposal.
6. Insert or update the requested handle to `active` under the same complete-column rules as assignment. A new or reserved target uses `transition_kind = 'owner_assigned'`; an expired retired target uses `transition_kind = 'expired_reuse_assigned'`. In all cases, the same statement sets `user_id` and `assigned_at` and clears `reserved_at`, `retired_at`, and `reusable_after`.
7. Commit. If the requested handle is unavailable, roll back so the old handle remains active.

Deletion/anonymization:

1. Begin the existing account-deletion transaction.
2. Lock the domain user with `for update`.
3. Lock the user's active `profile_handles` row with `for update`.
4. If one exists, capture one database timestamp as `transition_at` and update it in one statement: set `state = 'retired'`, clear `user_id`, clear `reserved_at` and `assigned_at`, set `retired_at = transition_at`, set `reusable_after = transition_at + interval 1 year`, set `transition_kind = 'deleted_user'`, and set `operator_user_id = acting_operator_user_id` under the current audit-column proposal.
5. Clear `users.avatar_url`, set `users.profile_visibility = 'private'`, set `users.display_name = 'Anonymous user'`, and set `users.deleted_at`.
6. Commit.

Manual retirement without account deletion:

1. This operation accepts only an `active` handle. A reserved handle must use a separately named reservation release or reservation change action.
2. Read the active row's `user_id`, begin a transaction, lock that domain user with `for update`, then lock the handle row with `for update`. Recheck that the handle is still `active` and still belongs to that user; otherwise roll back and retry or reject.
3. Capture one database timestamp as `transition_at`.
4. Update the locked active row in one statement: set `state = 'retired'`, clear `user_id`, clear `reserved_at` and `assigned_at`, set `retired_at = transition_at`, set `reusable_after = transition_at + interval 1 year`, set `transition_kind = 'admin_retired'`, and set `operator_user_id = acting_operator_user_id` under the current audit-column proposal.
5. Require exactly one affected row and commit. The complete update satisfies the retired-state check in the statement that changes `state`.

Expired retired reuse:

- Do not delete retired rows in a cleanup job.
- The assignment transaction consumes an expired retired row with the exact atomic transition specified above: set `state = 'active'`, set `user_id = target_user_id`, set `assigned_at = transition_at`, clear `reserved_at`, `retired_at`, and `reusable_after`, set `transition_kind = 'expired_reuse_assigned'`, and set the reviewed transition audit metadata.
- Concurrent reuse attempts serialize on `select ... for update`; at most one transaction can commit because `handle` is the primary key and `user_id` is unique.

Reservation:

- Reservation is a reviewed data action, not a side effect of app startup.
- The `maiks` reservation captures one database timestamp as `transition_at` and inserts one complete `reserved` row in one statement: `handle = 'maiks'`, `state = 'reserved'`, `user_id = null`, `reserved_at = transition_at`, `assigned_at = null`, `retired_at = null`, `reusable_after = null`, `transition_kind = 'owner_reserved'`, and `operator_user_id = acting_operator_user_id` if the reviewer approves the audit column.
- `maiks` assignment is a later reviewed data action after Michael's domain user is proven by the Owner-account mapping gate.
- Do not infer Michael's user from first login, provider email, provider username, auth row ordering, or linked-account ordering.

Reservation release or change:

- These are explicitly named reservation actions. They never use `admin_retired` and never create a one-year retirement period for a handle that was not assigned.
- To release a reservation, begin a transaction, lock the handle row with `for update`, require `state = 'reserved'`, delete that reserved row, require exactly one affected row, and commit.
- To change a reservation, normalize both handles first. Begin a transaction and lock existing rows for the old and new handles in deterministic handle order. Require the old row to be `reserved` and the new handle to have no row. Capture one database timestamp as `transition_at`. Delete the old reserved row and insert the new complete reserved row in the same transaction with `state = 'reserved'`, `user_id = null`, `reserved_at = transition_at`, `assigned_at = null`, `retired_at = null`, `reusable_after = null`, the reservation's correct `transition_kind`, and the reviewed transition audit metadata. Commit only after both statements succeed.
- If any reservation precondition or write count fails, roll back. Each committed reservation row therefore has exactly the reserved-state column shape required by the DDL check.

## Public read projections

Profile detail route:

- Public route: `/profiles/:handle`.
- Lookup normalizes `:handle`, reads `profile_handles` where `state = 'active'`, and joins `users` where `deleted_at is null`.
- Deleted users, retired handles, reserved handles, malformed handles, and missing handles return not found.

Private profile detail:

- Account name from `users.display_name`.
- Exact private text: `This account is set to private`.
- No image.
- No linked accounts.
- No provider identities.
- No auth data.
- No recognition, roles, perks, support history, event history, moderation state, or verified game names.

Minimal profile detail:

- Handle.
- Account name.
- Profile visibility.
- Managed avatar only if the profile is not private and the existing managed-image privacy rule allows it.
- No linked accounts or provider identity.

Public profile detail:

- Same as minimal for this schema slice.
- Rich public profile fields, linked identities, recognition, perks, and verified game names require separate approved persistence and consent rules.

Search result:

- Search includes non-deleted users with active handles, including private users.
- Search matches handle and account name only in the first slice.
- Private results render only the account name and exact private text, with no image.
- Deleted users, accounts without active handles, reserved handles, and retired handles are absent.
- Provider usernames, provider display names, linked game names, roles, perks, recognition, and moderation state are not searchable until their own public read models are reviewed.

## Profile image route

The current raw-id-shaped public image route must not be used for real public profiles.

Allowed future directions:

- Handle-based image route, for example `/profiles/:handle/image`.
- Opaque image reference route, where the opaque reference cannot be reversed to a domain user id, auth id, provider id, linked-account id, or storage path.

Rules:

- Private profiles return no image field and the UI must not request a private profile image.
- Anonymous or non-owner private image reads keep the indistinguishable private no-store `404` behavior.
- Owner-private image access remains an authenticated owner path, not a public profile path.
- No public profile/image response may expose raw domain ids, Better Auth ids, provider account ids, linked-account ids, token material, storage paths, or audit ids.

## `/profiles/maiks`

- Normalize Michael's selected address to `maiks`.
- Reserve `maiks` through a reviewed data action before any general assignment or claim path can exist.
- Assign `maiks` only through a later reviewed data action after Michael's production domain user is proven.
- Keep the reservation and assignment separate from the schema migration unless the reviewer explicitly approves deterministic seed data.
- Until assignment and public profile runtime are reviewed, `/profiles/maiks` must not publish data from live account/provider tables.

## Migration and data sequencing

This is the proposed order for later approved work:

1. Review and approve this proposal.
2. Retain the completed MariaDB preflight evidence above. Repeat it if the production target or relevant server/schema settings change.
3. Add domain handle normalization, availability, transition, and projection tests without touching the database.
4. Only after separate migration-generation authorization, generate a migration for `profile_handles` only. Stop for review. Do not apply it from the generator task.
5. Review generated SQL for `InnoDB`, the explicit `utf8mb4_general_ci` table default and user-reference columns, exact handle `ascii_bin`, handle length, enforced state checks, nullable unique user ownership, timestamp precision, and unwanted changes.
6. Prove a protected database backup and disposable restore/staging migration path.
7. Apply the reviewed schema migration only through the coordinator migration gate.
8. Keep all existing users without handles.
9. Reserve `maiks` through a reviewed data operation, unless the reviewer explicitly approved deterministic seed data in the migration.
10. Implement the Owner/manual assignment workflow in a separate runtime task.
11. Run a separate reviewed data task to assign `maiks` to Michael's proven domain user.
12. Implement public search/detail API over `profile_handles` plus `users` projections.
13. Replace static `/profiles` demonstrations with production-styled pages that consume the public API.
14. Verify live behavior after deployment with signed-in Owner and anonymous paths.

## Explicit stop conditions

Stop before migration generation if any item below is true:

- Target provenance differs from `/home/michael/Documents/Codex/maiks-yt-production` on branch `production`.
- The reviewer rejects one canonical `profile_handles` table.
- A proposal or generated migration adds `users.profile_handle` or `profile_handle_locks`.
- The completed production preflight no longer matches the target MariaDB version, `users.id` definition, isolation level, timezone behavior, timestamp precision, or relevant server settings.
- Generated SQL omits `engine = InnoDB`, the `utf8mb4_general_ci` table default, explicit `utf8mb4_general_ci` on `user_id` or `operator_user_id`, handle `ascii_bin`, the nullable unique `user_id` key, or either enforced `CHECK` constraint.
- Drizzle cannot express the exact DDL intent and no reviewed SQL adjustment is prepared.
- The reviewer wants self-service handle claiming in the first slice. This proposal covers manual Owner assignment for existing accounts.
- The reviewer wants automatic first-handle backfill for existing non-deleted accounts. The approved decision says first handles are Owner-assigned.
- `/profiles/maiks` cannot be reserved before any public handle claim or assignment path ships.
- Any proposal, generated SQL, or migration would touch auth, money, moderation, provider identity or credential data, secrets, deployment or Docker/Cloudflare configuration, runtime code, `users.profile_handle`, `profile_handle_locks`, or unrelated reports.
- A preflight finds existing handle schema or production handle data that must be reconciled first.
- A preflight finds `maiks` already active or reserved for a non-owner purpose.
- Public profile/image design still uses raw domain, auth, provider, or linked-account ids.
- The migration cannot be reviewed against a protected backup and a disposable restore/staging database before production application.
- The rollback plan would require deleting live handle assignments without a preservation export.

## Rollback and data preservation

Before handle assignments exist:

- Roll back by reverting the reviewed migration, or leave the unused table in place if that is safer for production.
- No user data changes should exist except the reviewed `maiks` reservation if that separate data action has already run.

After handle assignments exist:

- Prefer runtime rollback first. Keep the schema and data in place while disabling the public profile API/UI.
- Do not drop `profile_handles` until active, reserved, and retired rows are exported to a protected operator backup and the reviewer accepts the data loss.
- If a bad assignment is found, use a reviewed correction transaction. If the handle was publicly active, retire it for one year unless the reviewer explicitly classifies the same transaction as an operator mistake that can be corrected without public exposure.
- Public lookup failures fail closed to not found.
- Private profile data must never be exposed as a rollback side effect.

## Focused test plan

Domain tests:

- Normalizes `Maiks` and `@maiks` to `maiks`.
- Rejects malformed, reserved, too-short, too-long, Unicode, control-character, slash, query, and double-hyphen handles.
- Treats active handles, reserved handles, and unexpired retired handles as unavailable.
- Allows expired retired handles only through an approved manual assignment path.
- Retires old handles for at least one year on rename, deletion, and admin retirement.
- Emits a typed deletion retirement transition with `transition_kind = 'deleted_user'`.
- Clears public image eligibility for private and deleted accounts.

Database/migration review tests:

- Generated migration adds only `profile_handles`.
- Generated SQL uses `varchar(32) character set ascii collate ascii_bin`.
- Generated SQL uses `engine = InnoDB default character set utf8mb4 collate utf8mb4_general_ci`.
- Generated SQL pins `user_id` and the proposed `operator_user_id` to `character set utf8mb4 collate utf8mb4_general_ci`.
- Generated SQL has primary key `handle`.
- Generated SQL has nullable unique `user_id`.
- Generated SQL has finite `state`, `transition_kind`, and enforced state-shape checks on MariaDB 10.11.16.
- Generated timestamp columns retain precision `0`.
- Existing users remain untouched with no automatic first-handle assignment.
- Unique active user ownership fails for a second active handle.
- Active handle collision fails.
- Reserved and unexpired retired handles block assignment.
- Reserved-to-active assignment atomically sets `user_id` and `assigned_at`, clears every reservation/retirement timestamp, and records `owner_assigned`.
- Expired retired reuse atomically sets `user_id` and `assigned_at`, clears every reservation/retirement timestamp, and records `expired_reuse_assigned` on the existing row.
- Manual retirement rejects reserved rows; reservation release/change never records `admin_retired` or starts a one-year reuse period.
- Deletion transition clears `user_id` and keeps only the one-year retired handle row.

API projection tests, later runtime slice:

- Public profile detail for a private user returns only account name, private state needed by the UI, and exact private text. No image URL.
- Public search includes private users with active handles but omits users without active handles and deleted users.
- Public/minimal profile detail does not contain auth ids, provider ids, linked-account ids, provider account ids, roles, recognition, perks, moderation records, event history, money records, audit ids, or raw `users.id`.
- Malformed handle routes fail closed.
- Reserved and retired handles return not found.
- `/profiles/maiks` resolves only after the approved manual assignment.

Image-route tests, later runtime slice:

- Real profiles use a handle-based or opaque image route.
- Public image URLs never contain raw domain user ids, auth ids, provider ids, linked-account ids, token material, storage paths, or audit ids.
- Private profiles return no image field and do not trigger an image request.
- Anonymous and non-owner private image reads keep the private no-store `404`.

Browser/UI tests, later page slice:

- `/profiles` searches real handled users only.
- Private result and detail show no image and no extra metadata.
- `/profiles/maiks` is the permanent public route after assignment.
- Retired handles render not found until reusable and reassigned.

Live verification, coordinator only:

- Anonymous search can find a private handled account and sees only the approved private projection.
- Anonymous detail for a private handled account has no profile image request.
- Owner can edit account name, profile visibility, and managed image independently from linked-provider login.
- Provider login/linking still works and does not change a handle.
- Deleted/anonymized users are absent from search and detail, and their former handle is retired for one year.

## Unresolved gates

- Reviewer must approve the exact handle length and reserved-word list.
- Reviewer must approve `operator_user_id` as internal audit, or decide to rely on an existing audit log instead.
- Reviewer must decide whether the `maiks` reservation is a separate reviewed data step or deterministic seed data inside the reviewed migration.
- Reviewer must approve handle-based versus opaque public image routing before real profiles go live.
- Reviewer must decide if future new accounts can self-claim handles, or if all handle assignment stays Owner/admin-only for the first production release.
- A protected backup and restore/migration drill must pass before production migration application.

## Reviewer risks

- MariaDB risk: generated SQL must preserve handle `ascii_bin`, both `utf8mb4_general_ci` user-reference columns, the explicit table default, `InnoDB`, nullable uniqueness, and enforced checks. The preflight's `ERROR 1267` reproduction shows that an inherited incompatible user-id collation would break the join.
- Privacy risk: a handle can identify a person. Deletion must clear `user_id` and retire only the handle string plus timestamps needed for the one-year hold.
- Image-route risk: raw domain/auth/provider ids in public image URLs would violate the reviewed public-identifier boundary.
- Backfill risk: automatically assigning handles to existing accounts would violate the approved manual-first decision.
- Data-action risk: `maiks` reservation and assignment are reviewed production data actions, not incidental migration side effects unless explicitly approved.
- Product risk: provider username, linked game name, recognition, perks, role, and moderation search would publish unapproved identity data.
