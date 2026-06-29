# Next Agent Tasks

Updated: 2026-06-29

Use larger vertical chunks from here. The goal is fewer agent handoffs and fewer repeated checks, while still keeping high-risk areas bounded.

The coordinator reviews, tests, commits on `dev`, pushes `dev`, deploys to the dev server for testing, applies any approved dev-only seed/migration step, and verifies public dev after each accepted chunk.

## Current Blocked/Manual Items

- Creator Hub support destination is blocked until Michael creates or approves the support URL and wording.
- Creator Hub link admin should use the database-backed Creator Links foundation from Chunk 3A; static TypeScript source-file editing is not acceptable for runtime admin edits.
- Lost OBS/control tokens have a dev-first admin-token management worker implementation; coordinator review/deploy/owner smoke should create fresh usable URLs before the Computer Use installed-window pass.
- Chat overlay behavior has fake/local test input and a streamer-only fake/local viewer, but visual installed-window/browser verification is still manual.
- Chrome/in-app browser plugin visual QA is blocked in this setup; use Computer Use for the remaining visual installed-window pass.
- Full AI-assisted content generation is deferred until manual admin workflows exist.
- Event routing now has an in-code typed registry/capability matrix foundation, dev-applied persistence migration `0012_smooth_jack_flag.sql`, a deployed/dev-smoked first manual/provider-neutral routing-rule admin foundation, deployed safe simulated dispatch API behavior, deployed user-facing stream visibility opt-outs for website/community events, and deployed/dev-smoked Phase 4A safe simulated top/center overlay playback. Provider credentials, real website production dispatch, moderation enforcement, real money, and production event intake remain later gates.
- Page Creator and Route Admin now has dev-applied `content_pages` persistence migration `0013_lowly_justin_hammer.sql` and a deployed first runtime implementation: path-only manual pages on the primary website host, owner-gated `/admin/pages`, saved preview-before-publish, reserved-route blocking, and public exact-path rendering for published visible records. Host/subdomain plus Cloudflare automation, production route behavior changes, AI auto-publishing, and money/legal final wording remain later gates.
- Phase 5A generated and dev-applied moderator/helper persistence migration `0016_jittery_nebula.sql` for trust levels, scoped role grants, temporary/revoked access metadata, and role-grant audit logs.
- Phase 5H generated durable active moderation-state migration `0018_slimy_stellaris.sql` for `moderation_active_states`, and Phase 5I applied it on dev with fake/local hide/mute active-state writes and read-only live-helper summaries.
- Phase 5J completed the docs/design gate for community rules, manual warning/strike escalation, and restriction boundaries. Automatic warnings, real bans, provider enforcement, destructive actions, AI moderation, auth/secrets, money/support authority, production behavior, and new policy/strike schema remain gated.
- Phase 6A Provider Integration Foundation is deployed and dev-smoked. It adds real provider SDK dependencies and sanitized read-only status plumbing for Twitch, YouTube, and Discord behind owner-gated `GET /admin/provider-integrations/status` plus `/admin/provider-integrations`. It does not add OAuth, token storage/rotation, webhook/EventSub receivers, live chat ingestion, provider moderation/write actions, money behavior, migrations, Cloudflare/Docker config, auth flow changes, or production behavior.
- Phase 6A provider status now recognizes the saved dev env shape: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` for the YouTube OAuth foundation and `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET` as Discord OAuth app credentials, while `DISCORD_BOT_TOKEN`/`DISCORD_APPLICATION_ID`/`DISCORD_GUILD_ID` are passed through Turbo to app processes. Safe live checks confirmed the Discord bot token is valid and matches the application id; the configured guild id currently returns Discord `Unknown Guild`.
- The previous public `web-dev` Cloudflare-side injection blocker was resolved by Michael removing the malicious Worker route. Keep an eye on future public smoke for injection markers, but do not edit Cloudflare config unless explicitly assigned.
- The first private notification panel slice is implemented, deployed, migrated, and dev-smoked on `dev`: `system_notifications` persistence, typed notification validation, owner-gated notification list/read/archive API, dev-secret `/dev/notifications`, standalone `/tools/notifications` polling UI, Web Push delivery, owner-device notification receipt, and a four-times-a-day dev smoke runner wired through user cron on `codex-server-1`.
- Production readiness now has a design-only dev-to-main checklist in `reports/production-readiness-checklist.md`. It is not deployment approval; production config edits, secret changes, migration application, deployments, and server state changes remain coordinator/release-owner work only.

## Phase 6A: Provider Integration Foundation (Completed On Dev)

Worker scope:

- Install first real provider SDK dependencies in the integrations package: Twurple auth/API, Google APIs, and Discord REST.
- Add sanitized provider configuration status helpers for Twitch, YouTube, and Discord.
- Add owner-gated `GET /admin/provider-integrations/status` that returns configured/missing/invalid/disabled status without secret values.
- Add compact `/admin/provider-integrations` status UI.
- Keep this read-only: no OAuth flow, token persistence, webhook/EventSub receiver, live chat ingestion, provider moderation/write action, money behavior, auth login changes, migrations, Cloudflare/Docker/deploy config, server state, or production behavior.

Suggested reviewer checks:

- `pnpm --filter @maiks-yt/integrations test`
- `pnpm --filter @maiks-yt/integrations typecheck`
- `pnpm --filter @maiks-yt/api test`
- `pnpm --filter @maiks-yt/api typecheck`
- `pnpm --filter @maiks-yt/web typecheck`
- `pnpm --filter @maiks-yt/web build`
- `node scripts/check-architecture.mjs`
- `git diff --check`

Reviewer/dev smoke:

- Committed and pushed implementation on commit `938865a`.
- Deployed to the dev server with no migration application.
- Initial public smoke hit a startup-timing `502` while the dev container was still installing/building; container logs showed normal startup and a follow-up health check returned `{"ok":true,"surface":"api"}`.
- Unauthenticated `GET /admin/provider-integrations/status` returned `401`.
- Owner-authenticated `GET /admin/provider-integrations/status` returned read-only provider states for Twitch, YouTube, and Discord; current dev env shows Twitch `configured`, YouTube `missing`, and Discord `missing`.
- Smoke verified secret variable names are present for operator visibility but the owner token and secret values are not returned.
- `/admin/provider-integrations?devAuthToken=...` returned `200`, rendered `Provider Integrations`, and did not contain the known `bsc-dataseed.binance.org` injection marker.
- Follow-up compatibility patch recognizes legacy Google OAuth env names for YouTube readiness, surfaces Discord OAuth app credentials separately from bot-token readiness, and passes Discord bot/app/guild env names through Turbo dev tasks.
- Safe live checks after Michael saved the Discord values confirmed the raw container sees the bot/application/guild vars, the Discord bot token returns `200` from `/users/@me` and matches `DISCORD_APPLICATION_ID`, and the configured `DISCORD_GUILD_ID` returns `404 Unknown Guild`.

Next provider chunks:

- Define provider scopes, rate-limit/failure handling, token storage/revocation shape, and manual override before real provider intake.
- Consider a read-only credential presence smoke only after secrets are provided through approved dev/runtime configuration, still without printing secrets or creating provider-side effects.

## Chunk 25: Private Notification Panel Foundation (Completed On Dev)

Coordinator scope:

- Generate and review the first durable `system_notifications` migration.
- Add typed notification severity/source/status validation in `@maiks-yt/domain/notifications`.
- Add owner-gated admin notification API behavior for list, read, and archive.
- Add a dev-only, secret-protected `/dev/notifications` endpoint that the 4-times-a-day smoke/watchdog runner can call.
- Add standalone `/tools/notifications` with no normal website navbar and polling-based private alert visibility.
- Keep Web Push delivery, push subscription storage, service-worker notification handling, production alerting, provider alerts, moderation alerts, money alerts, automation scheduling, commits, pushes, deployments, and migration application out until coordinator review passes.

Acceptance criteria:

- API validates input and rejects missing/invalid dev notification secrets.
- Dev endpoint is disabled under `NODE_ENV=production`.
- Owner wildcard or `notifications:manage` can list/read/archive; unauthenticated and unauthorized users are denied.
- `/tools/notifications` is included in the stream tools manifest shortcut list and remains network-only/no private-data cache.
- Migration is generated but only applied by the coordinator during dev deployment.

Suggested checks:

- `pnpm --filter @maiks-yt/domain test`
- `pnpm --filter @maiks-yt/domain typecheck`
- `pnpm --filter @maiks-yt/database typecheck`
- `pnpm --filter @maiks-yt/api test`
- `pnpm --filter @maiks-yt/api typecheck`
- `pnpm --filter @maiks-yt/web typecheck`
- `pnpm --filter @maiks-yt/web build`
- `node scripts/check-architecture.mjs`
- `git diff --check`

Reviewer gate:

- Completed on dev. Migration `0014_first_onslaught.sql` was applied on the dev database.
- Public smoke confirmed `api-dev` health, `/tools/notifications` 200, no normal navbar marker, and no known injection markers.
- Dev API smoke created a warning row through `/dev/notifications`, confirmed unauthenticated admin access returns `401`, confirmed owner list sees the row, then marked it read and archived it.
- Turborepo dev-task env allowlist now includes `DEV_NOTIFICATION_POST_SECRET` and the Web Push env names so app package processes can receive them.

## Chunk 26: Web Push Notifications (Completed On Dev, Manual Device Smoke Open)

Worker scope:

- Add push subscription persistence and owner-device subscribe/unsubscribe API behavior.
- Add service worker notification delivery only; do not cache private API/data responses.
- Use the already-loaded VAPID env vars on dev: `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, and `WEB_PUSH_CONTACT`.
- Send pushes for new critical/warning notifications after a durable row is created.
- Keep production alerting, provider alerts, money alerts, moderation alerts, and recurring automation out unless separately assigned.

Reviewer gate:

- Dev migration `0015_next_raza.sql` was applied.
- Public smoke confirmed push config is enabled with a public key, `notification-service-worker.js` returns `200`, `/tools/notifications` returns `200`, and the page has no normal navbar or known injection markers.
- API smoke confirmed a warning notification can be created through `/dev/notifications`, owner listing sees the row, and a dummy HTTPS push subscription can be created and revoked.
- Manual owner-device smoke is verified as of 2026-06-28: sending `Owner-device push smoke` through `/dev/notifications` updated the active subscription `last_push_at`, stored no active subscription error, and Michael confirmed notifications are received.

## Chunk 27: Recurring Dev Smoke To Notifications (Completed On Dev)

Worker scope:

- Connected a replacement 4-times-a-day dev smoke runner to `POST /dev/notifications`.
- Uses only `DEV_NOTIFICATION_POST_SECRET`; the secret is read from the dev container environment and is not printed or committed.
- Reports warnings/critical failures for API health, database health, web health, overlay/control reachability, notification service worker reachability, and injection-marker scans.
- Keeps automated destructive cleanup, production alerting, real provider checks, and real money checks out until explicitly scoped.

Reviewer gate:

- Completed on dev commits `d9f805c` and `41b1859`.
- `pnpm dev:smoke:notify -- --dry-run` passed locally and inside `maiks-yt-dev`.
- A synthetic failed `control-dev` smoke created one warning alert, the duplicate guard suppressed the same failure signature during cooldown, and a healthy follow-up run created one lower-severity recovery note.
- The recurring schedule is installed in Michael's user crontab on `codex-server-1` at `07:00`, `12:00`, `17:00`, and `22:00` Europe/Amsterdam time, matching the preferred five-hour work windows and logging to `/tmp/maiks-yt-dev-smoke-cron.log`.
- A user systemd timer was tested and then disabled because `loginctl enable-linger michael` requires sudo/password; cron is active and avoids that lingering dependency.

## Phase 5A: Moderator Trust Persistence Migration (Completed On Dev)

Coordinator scope:

- Reviewed generated migration `packages/database/drizzle/0016_jittery_nebula.sql`.
- Applied it on the dev database.
- Kept this as persistence-only; no admin UI/API or runtime role behavior is enabled by this slice.

Result:

- `user_roles` gains trust level, scope kind/id, live/offline availability, assigned-by user, expiration, revocation metadata, and indexes/checks for scoped and revoked grants.
- Existing `owner` role grants are backfilled to `trust_level = 'owner'` in the generated migration.
- `role_grant_audit_logs` records future grant/update/revoke/expire actions with actor, target, role, old/new values, reason, and timestamp.

Checks:

- `pnpm --filter @maiks-yt/database typecheck` passed.
- `node scripts/check-architecture.mjs` passed.
- `git diff --check` passed.
- Dev schema smoke confirmed seven new `user_roles` metadata columns, the `role_grant_audit_logs` table, and two existing owner grants backfilled to `trust_level = 'owner'`.

Remaining gates:

- No admin UI/API, runtime permission behavior change, automatic promotion, provider role sync, real moderation enforcement, auth changes, secrets, Cloudflare/Docker/deploy config, or production behavior was added.

## Phase 5B: Owner-Gated Moderator Management Admin (Completed On Dev)

Worker scope:

- Build the first manual owner-gated moderator/helper admin over the Phase 5A persistence shape.
- Allow owner/admin to list users with role grants, roles, trust levels, scope, availability, expiration, and revoked status.
- Add grant/update/revoke behavior with required audit log rows for every mutation.
- Keep owner-only capabilities protected: owner/admin assignment, production auth/secrets, provider credentials, real money authority, irreversible user deletion, and audit log disabling must not be grantable from this slice.
- Keep first version manual: no Discord/Twitch/YouTube role sync, no automatic trust scoring, no real provider moderation enforcement, no money/support permissions, and no production owner assignment behavior.

Suggested checks:

- `pnpm --filter @maiks-yt/database typecheck`
- `pnpm --filter @maiks-yt/domain test`
- `pnpm --filter @maiks-yt/api test`
- `pnpm --filter @maiks-yt/api typecheck`
- `pnpm --filter @maiks-yt/web typecheck`
- `pnpm --filter @maiks-yt/web build`
- `node scripts/check-architecture.mjs`
- `git diff --check`

Reviewer gate:

- Verify unauthenticated and non-owner access is denied.
- Verify grant/update/revoke writes an audit row and does not allow owner/admin or money/auth/secrets capabilities.
- Verify temporary and scoped grants render clearly in `/admin/moderators`.

Result:

- Added `@maiks-yt/domain/community` moderator grant rules/types and exported the new domain subpath.
- Added `apps/api/src/moderators` list/grant/update/revoke API behavior with owner wildcard or `moderators:manage` authorization.
- Added focused API tests under `apps/api/test/moderators`.
- Added `/admin/moderators` manual web UI.
- Committed, pushed, deployed, and dev-smoked on commit `2f537fe`.
- Dev smoke confirmed unauthenticated API returns `401`, owner listing returns users/roles/grants, `/admin/moderators` returns `200` without known injection markers, and a temporary harmless role can be granted, updated, revoked, and audited through the public API.
- Smoke cleanup deleted the temporary role, grant, and audit rows.
- No migration/schema, auth/provider login, provider role sync, automatic promotion/scoring, real moderation enforcement, money/support authority, secrets, or production behavior was added.
- Note: this worker did not create or seed helper/moderator roles. The admin surface lists all existing roles and only allows grants for roles that already exist and pass the grantable-role safety rules.

## Phase 5C: Read-Only Live Helper Dashboard (Completed On Dev)

Worker scope:

- Add a read-only live helper dashboard that shows queues/helpers can safely monitor while Michael is live.
- Include safe existing sources only: pending Event Routing approvals, recent simulated event-routing history summary, notification panel warnings/critical alerts, and current helper/moderator grants.
- Owner or `moderators:manage` can view the first version; do not add broad moderation permissions yet unless explicitly scoped.
- Keep this read-only: no provider moderation enforcement, no real chat provider actions, no role grant mutations, no money/support authority, no AI decisions, no auth changes, no schema/migration unless a blocker is found and documented.

Suggested checks:

- `pnpm --filter @maiks-yt/api test`
- `pnpm --filter @maiks-yt/api typecheck`
- `pnpm --filter @maiks-yt/web typecheck`
- `pnpm --filter @maiks-yt/web build`
- `node scripts/check-architecture.mjs`
- `git diff --check`

Reviewer gate:

- Verify unauthenticated access is denied.
- Verify owner access can view the dashboard.
- Verify the page is read-only and does not expose secret/token/raw sensitive payload data.

Result:

- Added `apps/api/src/live-helper` read-only dashboard API behavior at `GET /admin/live-helper`, gated to owner wildcard or `moderators:manage`.
- The API returns compact summaries for pending safe simulated/test Event Routing approvals, recent warning/critical notifications, active non-owner helper/moderator grants, and recent safe simulated/test Event Routing history.
- Sensitive fields stay out of the response: no raw event payloads, push subscription material, URL tokens, provider credentials, deleted-user rows, notification bodies, grant mutation/audit mutation behavior, or private provider data.
- Added focused API tests under `apps/api/test/live-helper` for unauthenticated denial, non-manager denial, owner wildcard access, `moderators:manage` access, and grant summary sanitization.
- Added `/admin/live-helper` web UI with read-only monitoring panels and no grant/revoke/approve/reject/moderation mutation controls.
- Committed, pushed, deployed, and dev-smoked on commit `5d1158a`.
- Dev smoke confirmed unauthenticated API access returns `401`, owner API access returns `readOnly: true`, `/admin/live-helper` returns `200`, no known injection marker appears, active grant summaries omit role permissions, and recent history summaries omit raw payload markers.

Checks:

- `pnpm --filter @maiks-yt/domain build` passed first to restore fresh-worktree package exports for tests.
- `pnpm --filter @maiks-yt/api test` passed.
- `pnpm --filter @maiks-yt/api typecheck` passed.
- `pnpm --filter @maiks-yt/web typecheck` passed.
- `pnpm --filter @maiks-yt/web build` passed.
- `node scripts/check-architecture.mjs` passed.
- `git diff --check` passed.

Remaining gates:

- No schema/migration, provider moderation enforcement, real chat provider actions, role grant mutations, money/support authority, AI decisions, auth/provider login changes, secrets, Cloudflare/Docker/deploy config, or production behavior was added.

## Phase 5D: Fake/Local Moderation Commands And Audit (Completed On Dev)

Worker scope:

- Add the first fake/local-only moderation command vocabulary and audit trail for the existing fake/local chat harness.
- Keep commands limited to safe local/test chat behavior: warning, temporary mute/hide from fake/local stream surfaces, note/status changes, and clear audit-friendly no-op actions are acceptable.
- Gate command use to owner wildcard or a narrowly grantable moderation/helper capability; do not give helpers owner/admin/auth/money/secrets/provider authority.
- Record an audit entry for every command attempt, including denied or no-op outcomes when useful for live review.
- Surface recent fake/local moderation audit in the live helper dashboard or a small linked admin panel only if it stays read-only for helpers.
- Keep real Twitch/YouTube/Discord provider enforcement, provider credentials, destructive user actions, ban propagation, AI decisions, money/support authority, schema changes, auth changes, Cloudflare/Docker/deploy config, production behavior, commits, pushes, deployments, and server state changes out unless explicitly assigned.

Suggested checks:

- `pnpm --filter @maiks-yt/domain test`
- `pnpm --filter @maiks-yt/api test`
- `pnpm --filter @maiks-yt/api typecheck`
- `pnpm --filter @maiks-yt/web typecheck`
- `pnpm --filter @maiks-yt/web build`
- `node scripts/check-architecture.mjs`
- `git diff --check`

Reviewer gate:

- Verify command execution is fake/local-only and cannot call provider APIs.
- Verify unauthorized users are denied and audited appropriately.
- Verify helper-visible surfaces do not expose raw secrets, provider credentials, tokens, or deleted-user data.
- Verify the live helper dashboard remains monitoring-first and any new controls are clearly scoped to fake/local test behavior.

Result:

- Added `@maiks-yt/domain/community` fake/local moderation rules and `fake-local-chat:moderate`.
- Added authenticated `POST /fake-local-chat/moderation/commands` with safe local actions: `warn_author`, `hide_message`, `temporary_mute_author`, `note_author`, and `noop`.
- Command execution requires owner wildcard or `fake-local-chat:moderate`; `moderators:manage` alone can view live-helper context but cannot execute fake/local moderation commands.
- Added in-memory audit entries for command attempts and outcomes, including denied, invalid, not-found, no-op, and applied results.
- Added local fake-message hiding and temporary fake-author mutes for existing fake/local chat surfaces; hidden fake/local messages are removed from streamer chat snapshots and overlay chat through `overlay.fake-chat.message.hidden`.
- Added recent fake/local moderation audit summaries to `/admin/live-helper` as read-only context.
- Committed, pushed, deployed, and dev-smoked on commit `b93b941`.
- Dev smoke confirmed unauthenticated command attempts return `401`, owner hide and temporary mute commands return applied audit entries with `providerAction: false`, hidden fake/local messages disappear from streamer chat snapshots, locally muted fake/local authors are suppressed with `queued: 0`, `/admin/live-helper` shows fake/local moderation audit items without provider actions, and `/admin/live-helper` renders on `web-dev` without the known injection marker.

Coordinator checks:

- `pnpm --filter @maiks-yt/domain test` passed.
- `pnpm --filter @maiks-yt/events test` passed.
- `pnpm --filter @maiks-yt/events typecheck` passed.
- Initial `pnpm --filter @maiks-yt/api test` hit the known stale workspace export issue before `@maiks-yt/domain` was rebuilt.
- `pnpm --filter @maiks-yt/domain build` passed.
- Retried `pnpm --filter @maiks-yt/api test` passed.
- `pnpm --filter @maiks-yt/api typecheck` passed.
- `pnpm --filter @maiks-yt/web typecheck` passed.
- `pnpm --filter @maiks-yt/web build` passed.
- `pnpm --filter @maiks-yt/overlay typecheck` passed.
- `pnpm --filter @maiks-yt/control-panel typecheck` passed.
- `pnpm --filter @maiks-yt/testing typecheck` passed.
- `node scripts/check-architecture.mjs` passed.
- `git diff --check` passed.

Remaining gates:

- Audit/mute/hide state is intentionally in-memory and resets on API restart. Durable moderation audit requires a separately approved schema slice.
- No Twitch/YouTube/Discord/provider moderation enforcement, provider credentials, destructive user actions, ban propagation, AI decisions, money/support authority, schema/migration, auth changes, secrets, Cloudflare/Docker/deploy config, or production behavior was added.

## Phase 5E: Durable Moderation Audit Persistence Migration (Generated, Unapplied)

Scope:

- Add the durable schema foundation needed before fake/local moderation audit moves out of memory and before any real provider moderation enforcement is considered.
- Keep this schema-first: no runtime writes, no provider API actions, no real bans/mutes, no UI behavior change, no migration application, no deploy, and no production behavior in this slice.

Result:

- Added `moderation_audit_logs` to `packages/database/src/database.schema.ts`.
- Generated migration `packages/database/drizzle/0017_busy_harpoon.sql` plus Drizzle snapshot/journal metadata.
- Table fields cover source, action, outcome, actor user/display name, target user/author/message/external id, optional event history and stream session references, duration and active-until, reason/note, provider-action metadata, test/simulated/reset flags, redacted context, and created timestamp.
- Indexes support source-created, actor-created, target-user-created, target-author-created, message lookup, event-history lookup, stream-session lookup, and test-reset cleanup.
- Safety checks require nonnegative durations, require temporary mute rows to have duration plus active-until, require provider queued/failed outcomes to have provider action, restrict provider action IDs to provider/website sources, require fake/local rows to be test/simulated with no provider action, and keep resettable rows test/simulated with no provider action.

Checks:

- `pnpm --filter @maiks-yt/database db:generate` passed.
- `pnpm --filter @maiks-yt/database typecheck` passed.
- `node scripts/check-architecture.mjs` passed.
- `git diff --check` passed.

Remaining gates:

- Migration is generated but not applied.
- Runtime writes from `POST /fake-local-chat/moderation/commands` are not wired to this table yet.
- Live helper still reads in-memory fake/local moderation audit until the runtime follow-up lands.
- Real Twitch/YouTube/Discord/provider moderation enforcement, provider credentials, destructive user actions, ban propagation, AI decisions, money/support authority, auth changes, secrets, Cloudflare/Docker/deploy config, and production behavior remain separate gated work.

## Phase 5F: Persist Fake/Local Moderation Audit (Completed On Dev)

Worker scope:

- After coordinator applies `0017_busy_harpoon.sql` on dev, wire Phase 5D fake/local moderation command attempts into `moderation_audit_logs`.
- Keep fake/local rows marked `source = 'fake-local'`, `is_test = true`, `is_simulated = true`, `test_resettable = true`, and `provider_action = false`.
- Keep in-memory hide/mute state for live behavior unless a separate durable active moderation-state table is approved; this slice is durable audit, not durable enforcement state.
- Update `/admin/live-helper` to read recent durable fake/local moderation audit rows, optionally falling back to in-memory rows only when the table is unavailable in tests.
- Keep real provider enforcement, real bans/mutes, destructive user actions, provider credentials, auth changes, secrets, money/support authority, AI decisions, Cloudflare/Docker/deploy config, production behavior, and schema changes out unless explicitly assigned.

Suggested checks:

- `pnpm --filter @maiks-yt/api test`
- `pnpm --filter @maiks-yt/api typecheck`
- `pnpm --filter @maiks-yt/web typecheck`
- `node scripts/check-architecture.mjs`
- `git diff --check`

Result:

- Fake/local moderation command attempts now write durable audit rows through the API repository.
- Rows are forced to `source = 'fake-local'`, `is_test = true`, `is_simulated = true`, `test_resettable = true`, and `provider_action = false`.
- `/admin/live-helper` now reads recent fake/local moderation audit summaries from `moderation_audit_logs` instead of the in-memory runtime audit list.
- In-memory hide/mute state remains the live behavior source for now; this slice does not add durable active moderation state.
- Committed, pushed, deployed, and dev-smoked on commit `13d4bfd`.
- Migration `0017_busy_harpoon.sql` was applied on the dev database.
- Dev smoke confirmed API health, an owner fake/local hide command writing a durable `providerAction: false` audit row, hidden fake/local messages absent from streamer chat snapshots, `/admin/live-helper` returning the durable audit row, and `/admin/live-helper` rendering on `web-dev` without the known injection marker.
- Direct dev DB check confirmed `moderation_audit_logs` has 23 columns and the smoke row is safe fake-local/test/simulated/resettable.

Checks:

- `pnpm --filter @maiks-yt/api test -- fake-local-moderation live-helper` passed.
- `pnpm --filter @maiks-yt/api typecheck` passed.
- `pnpm --filter @maiks-yt/web typecheck` passed.
- `pnpm --filter @maiks-yt/web build` passed.
- `pnpm --filter @maiks-yt/database typecheck` passed.
- `node scripts/check-architecture.mjs` passed.
- `git diff --check` passed.

Remaining gates:

- No real provider enforcement, destructive user actions, durable active moderation state, money/support authority, AI decisions, auth changes, secrets, Cloudflare/Docker/deploy config, or production behavior was added.

## Phase 5G: Durable Active Moderation State Design (Completed)

Worker scope:

- Design the smallest durable active moderation-state shape for local and future provider moderation state: active mutes/restrictions/bans, expiration, revocation/appeal metadata, provider linkage, and reset boundaries.
- Keep this design-only unless explicitly assigned to generate a migration.
- Separate durable audit history from active enforcement state. `moderation_audit_logs` records what happened; active state should answer what is currently in effect.
- Keep real provider enforcement, provider credentials, destructive user actions, automatic warning systems, money/support authority, AI decisions, auth changes, secrets, Cloudflare/Docker/deploy config, migration application, and production behavior out.

Suggested checks:

- `git status --short --branch`
- `node scripts/check-architecture.mjs`
- `git diff --check`

Result:

- Completed design/schema-gate documentation only; no migration was generated and no schema/runtime files were edited.
- Chose a separate `moderation_active_states` read model because `moderation_audit_logs` is append/history-oriented and cannot answer current-effect questions without replaying audit rows.
- Minimal future table shape should cover `id`, `source`, `state_kind`, `status`, target user/author/message/external references, optional stream session, active-from/active-until, duration, reason/note, revocation actor/time/reason, appeal/review status and reviewer metadata, provider linkage fields, created/last/revoked audit row ids, test/simulated/resettable flags, and timestamps.
- Current-active reads should filter `status = 'active'`, `revoked_at IS NULL`, and `(active_until IS NULL OR active_until > NOW())`, with indexes by source/status/active-until plus target user, target author, target message, target external id, stream session, and resettable cleanup.
- Safety checks should keep fake-local rows test/simulated/resettable with `provider_action = false`, keep resettable rows test/simulated with no provider action, require provider action ids only for future provider/website sources, require temporary mutes/restrictions to have expiration, and require revocation metadata to be internally consistent.
- Create/update/revoke flows should write `moderation_audit_logs` in the same transaction and link the active-state row to the relevant audit row; active state is the read model, not the audit source of truth.
- `/admin/live-helper` should eventually show read-only active-state summaries such as active fake/local mutes, hidden messages, expiring restrictions, revoked/reviewed items, and provider-linked placeholders, without controls, raw payloads, provider credentials, tokens, deleted-user data, or destructive actions.

Next implementation slice after approval:

- Phase 5H should generate only the `moderation_active_states` database schema/migration and Drizzle metadata, then stop for coordinator review. Runtime fake/local writes, migration application, live-helper durable active-state reads, provider enforcement, destructive actions, auth changes, secrets, AI moderation, money/support authority, Cloudflare/Docker/deploy config, server state, and production behavior should remain out of that migration slice.

Remaining gates:

- Phase 5H generated the migration after this completed design; migration application remains separate.
- Runtime writes from fake/local commands to active state remain separate.
- Real Twitch/YouTube/Discord/provider enforcement, provider credentials, destructive moderation actions, ban propagation, user deletion, raw provider payload storage, AI moderation, money/support authority, auth changes, secrets, Cloudflare/Docker/deploy config, server state, and production behavior remain separate gated work.

## Phase 5H: Durable Active Moderation State Migration (Completed On Dev)

Scope:

- Generate only the `moderation_active_states` database schema/migration and Drizzle metadata from the Phase 5G design.
- Keep this schema-first: no migration application, runtime fake/local writes, live-helper durable active-state reads, provider enforcement, destructive moderation actions, auth changes, secrets, AI moderation, money/support authority, Cloudflare/Docker/deploy config, server state, or production behavior.

Result:

- Added `moderation_active_states` to `packages/database/src/database.schema.ts`.
- Generated migration `packages/database/drizzle/0018_slimy_stellaris.sql` plus Drizzle snapshot/journal metadata.
- Table fields cover source, state kind, status, target user/author/message/external references, optional stream session, active-from/until, duration, reason/note, created/last/revoked audit-log ids, revocation metadata, appeal/review metadata, provider-action placeholders, fake-local/test/simulated/resettable flags, and created/updated timestamps.
- Indexes support current-active source/status/until reads, target user/source/status, target author/source/status, target message lookup, target external id lookup, stream session/status, test-reset cleanup, and audit-row link lookups.
- Safety checks require nonnegative durations, require mutes/restrictions to have duration plus active-until, keep fake-local rows test/simulated/resettable with no provider action, keep resettable rows test/simulated with no provider action, restrict provider placeholders to website/provider sources, require revocation metadata when revoked, require active/revoked status consistency, and keep appeal/review metadata internally paired.

Checks:

- `pnpm --filter @maiks-yt/database db:generate` passed.
- `pnpm --filter @maiks-yt/database typecheck` passed.
- `node scripts/check-architecture.mjs` passed.
- `git diff --check` passed.

Remaining gates:

- Migration `0018_slimy_stellaris.sql` was applied on dev during Phase 5I.
- Runtime fake/local hide/mute writes now update `moderation_active_states` on dev through Phase 5I.
- `/admin/live-helper` now reads durable fake/local active-state summaries on dev through Phase 5I.
- Real Twitch/YouTube/Discord/provider moderation enforcement, provider credentials, destructive actions, ban propagation, raw provider payload storage, AI moderation, money/support authority, auth changes, secrets, Cloudflare/Docker/deploy config, server state, and production behavior remain separate gated work.

## Phase 5I: Wire Fake/Local Active Moderation State (Completed On Dev)

Scope:

- Wire fake/local hide/mute runtime into the generated `moderation_active_states` table after migration `0018_slimy_stellaris.sql` is applied by the coordinator.
- Keep live suppression local and bounded; no provider calls or provider enforcement.

Result:

- `hide_message` creates or updates an active `message_hidden` row linked to the moderation audit row.
- Repeated hide attempts can update an existing current row without inserting a bogus duplicate when the fake/local message is already removed from the runtime list.
- `temporary_mute_author` creates or updates an active `author_muted` row with duration and `active_until`.
- `warn_author`, `note_author`, and `noop` remain audit-only and do not create active-state rows.
- All active-state rows are forced fake-local/test/simulated/resettable with `provider_action = false`.
- `/admin/live-helper` now includes a compact read-only active fake/local moderation count and list.
- Live suppression still uses the existing in-memory runtime cache for immediate fake/local behavior; durable state is for persistence/readback and future restart recovery work.

Checks:

- `pnpm --filter @maiks-yt/api test -- fake-local-moderation live-helper` passed.
- `pnpm --filter @maiks-yt/api typecheck` passed.
- `pnpm --filter @maiks-yt/web typecheck` passed.
- `pnpm --filter @maiks-yt/web build` passed.
- `node scripts/check-architecture.mjs` passed.
- `git diff --check` passed.

Reviewer/dev smoke:

- Committed and pushed implementation on commit `471c733`.
- Pulled `origin/dev`, rebuilt/deployed the dev stack, and applied migration `0018_slimy_stellaris.sql` on `codex-server-1`.
- Public API smoke confirmed `https://api-dev.maiks.yt/health` returns `{"ok":true,"surface":"api"}`.
- Owner smoke created a fake/local message, hid it through `POST /fake-local-chat/moderation/commands`, and verified it disappeared from `GET /streamer-chat/messages`.
- Owner smoke created a temporary fake/local mute, attempted another fake/local chat message from the muted author, and verified `queued: 0` with `reason: "fake_local_author_muted"`.
- Owner smoke confirmed `GET /admin/live-helper` returns read-only active fake/local moderation summaries with both `message_hidden` and `author_muted` rows and `providerAction: false`.
- Public web smoke confirmed `/admin/live-helper?devAuthToken=...` returns `200`, contains `Live Helper Dashboard`, and does not contain the known `bsc-dataseed.binance.org` injection marker.
- Direct dev DB smoke confirmed `moderation_active_states` has 32 columns and the smoke rows are fake-local/test/simulated/resettable with zero provider-action rows.

Remaining gates:

- No real provider enforcement, destructive moderation actions, durable provider state, auth changes, secrets, AI moderation, money/support authority, Cloudflare/Docker/deploy config, or production behavior was added.

## Phase 5J: Community Rules And Warning/Strike Design (Completed)

Scope:

- Design the next moderation foundation stage after fake/local active moderation state is live on dev.
- Keep this as docs/design/schema-gate work only: no runtime implementation, no migration generation/application, no provider enforcement, no automatic warning system, no AI decisions, no destructive actions, no real bans, no auth/secrets, no money/support authority, and no production behavior.
- Separate human-readable community policy/rules content from database enforcement state.
- Preserve fake/local test separation from real provider/user moderation.

Result:

- Added the Phase 5J plan to `ideas/abuse-safety-and-strike-system.md`.
- Drafted the first community rules categories: respect/harassment, stream disruption, identity abuse, support or money-adjacent abuse, privacy, and serious platform/legal escalation.
- Chose a manual-first ladder: internal note, human-reviewed warning, human-reviewed strike, active restriction, and owner-reviewed ban.
- Set the default strike escalation rule as owner review at three active strikes, not an automatic ban or removal.
- Kept community policy content separate from enforcement state. `moderation_audit_logs` remains append-only action history; `moderation_active_states` remains current-effect state for hides/mutes/restrictions/bans; role tables remain helper authority, not punishment.
- Proposed a minimal future schema shape only if approved later: `community_policy_versions`, `community_rule_definitions`, and `moderation_strikes`. No migration was generated.
- Clarified fake/local separation: fake/local warning/strike drills must stay `source = 'fake-local'`, test/simulated/resettable, `provider_action = false`, and must never count toward real account punishment or provider enforcement.
- Clarified helper/live-helper boundaries: helpers may monitor, add notes, draft proposed warnings, view sanitized summaries, and run fake/local drills only through narrow grants. Owner-only work includes role grants, permanent bans or long restrictions, provider enforcement, public policy publication, serious appeals, support/money decisions, auth/secrets, and raw provider/admin payload access.

Suggested checks:

- `git status --short --branch`
- `node scripts/check-architecture.mjs`
- `git diff --check`

Remaining gates:

- No runtime code, schema file, migration, provider enforcement, automatic warning system, AI decision path, destructive action, real ban, auth/secret behavior, money/support authority, server state, deployment, or production behavior was changed.
- A future public abuse-policy page still needs Michael-approved wording before publication.
- A future policy/rule/strike schema needs explicit coordinator approval before migration generation.
- Future helper warning-draft behavior must stay separate from sending warnings or applying restrictions unless explicitly scoped.
- `/admin/live-helper` should remain read-only for real moderation state; real moderation controls require a separate implementation gate.

## Chunk 19: Event Routing Persistence / Schema Gate Design (Completed)

Worker scope:

- Completed a design-only persistence gate for Event Routing Admin and the Dev Test Console.
- Proposed a future generated migration shape covering routing rules per event kind/source, destination settings, enabled/live-only/offline-only flags, approval required, per-user/global/once-per-stream cooldown fields, user opt-outs, event history/audit, approval queue, cooldown state, and simulated/test reset boundaries.
- Chose conservative safety defaults: privacy, account-security, provider-token, auth, and internal audit events stay internal-only; website signup/name/avatar events require opt-out and cooldown awareness before overlay eligibility; free website TTS stays later promotional scope; simulated money stays dev/test-only and separated from real money.
- No code implementation, migration generation/application, provider integrations, real money behavior, moderation enforcement, auth changes, secrets, Cloudflare/Docker/deploy config, commits, pushes, deployments, or server state changes were made.

Reviewer gate:

- Review the proposed schema shape in `ideas/event-routing-admin-and-dev-test-console.md`.
- Decide whether to approve a generated migration slice before assigning any real routing/dispatch implementation.

## Chunk 20: Event Routing Persistence Migration (Completed On Dev)

Worker scope:

- Generated the minimal database migration for Event Routing Admin persistence.
- Added database schema definitions only where required for the generated migration.
- Kept implementation behavior disabled: no real dispatch, no admin UI/API, no provider integrations, no real money, no moderation enforcement, no auth changes, no secrets, no Cloudflare/Docker/deploy config, no worker commits, pushes, deployments, or server state changes.

Result:

- Generated migration `packages/database/drizzle/0012_smooth_jack_flag.sql` plus Drizzle snapshot/journal metadata.
- Added `event_routing_rules` for per-kind/source routing destination, enabled/live/offline/approval flags, cooldown settings, once-per-stream, inert template/theme/sound/priority references, and owner/admin audit columns.
- Added `event_user_opt_outs` for global or per-kind opt-outs from stream-visible website events.
- Added append-only `event_history` with source platform, event kind, actor/user/stream/session references, routing outcome/destination, redacted payload, simulated/test/real-money flags, and a test-reset boundary flag.
- Added `event_approval_queue` for owner-reviewed public display/playback state.
- Added `event_cooldown_state` for per-rule cooldown windows keyed by global/user/stream/user-stream scopes.

Acceptance criteria:

- Migration can persist routing rules, opt-outs, event history/audit, approval queue, cooldown state, and simulated/test reset boundaries.
- Destination values are constrained to ignore/internal audit/control panel/top notification/center notification/streamer feed/streamer chat/approval queue.
- Privacy/security/provider-token event rules cannot become overlay/public destinations without explicit later code-level safety validation.
- Simulated/test records are clearly separated from real/provider money records.

Suggested checks:

- `pnpm --filter @maiks-yt/database typecheck`
- `node scripts/check-architecture.mjs`

Reviewer gate:

- Coordinator accepted the generated shape for integration after review and applied it on the dev database through the normal migration path.
- Do not start runtime routing, dispatch, admin UI/API, provider integrations, real money, moderation enforcement, auth, secrets, Cloudflare/Docker/deploy, or production behavior until separately scoped.

## Chunk 21A: Manual Event Routing Admin Foundation (Completed On Dev)

Worker scope:

- Added typed domain validation for routing rules against the existing event registry.
- Added owner-gated admin/API behavior to list and update persisted routing rules manually.
- Added `/admin/event-routing` as the first manual rule editing surface.
- Kept rules disabled by domain defaults unless the owner explicitly enables them.
- Kept real dispatch and simulated dispatch out of this first runtime-safe admin foundation.
- Kept provider integrations, real money, moderation enforcement, auth changes, secrets, Cloudflare/Docker/deploy config, commits, pushes, deployments, migration application, and server state out of worker scope.

Reviewer gate:

- Coordinator review passed with focused domain/API/web checks and architecture validation.
- Owner wildcard access is enough for dev; `event-routing:manage` remains available for later explicit role seeding if needed.
- Deployed and dev-smoked on `dev`: unauthenticated API returned `401`, owner-auth list returned 25 rules, `/admin/event-routing` returned `200`, and a disabled internal-audit `website.signup:any` rule saved successfully.

## Chunk 21B: Safe Simulated Event Routing Dispatch (Completed On Dev)

Worker scope:

- Allow `/dev/test-console` to dispatch safe `test/system` or explicitly simulated events through the durable rule reader.
- Write only safe test/simulated history/routing results; every row must be marked `is_test` and/or `is_simulated`, `test_resettable`, and never `is_real_money`.
- Apply opt-out and cooldown checks in code before any stream-visible website-style simulated result.
- Queue approval-required simulated events without public playback.
- Keep real provider events, real website production events, real money, moderation enforcement, auth changes, secrets, Cloudflare/Docker/deploy config, commits, pushes, deployments, and migration application out of worker scope.

Reviewer gate:

- Coordinator review passed locally with focused domain/API tests, domain/API/database/web typechecks, web build, architecture validation, and `git diff --check`.
- Deployed on dev commit `dfc394b`; API smoke confirmed `/dev/event-routing/dispatch` appended a safe test/simulated/resettable history row and reported `publicPlayback: false`.
- Public `/dev/test-console` rendered the safe dispatch UI, but public visual/browser confidence is blocked by the Cloudflare-side injection route until it is removed.
- User-facing stream-visibility opt-out settings UX is still not implemented; stream-visible website-style simulated events remain fail-closed when user identity cannot be checked.

## Chunk 22: Page Creator / Route Admin Schema Gate Design (Completed)

Worker scope:

- Completed a design-only gate for an owner/admin page creator for normal website pages.
- Chose first safe scope: manual owner-gated draft pages, path-only routing on the current website host, preview-before-publish, simple SEO metadata, and published/visible-only public rendering.
- Classified page ownership: channel/hobby/campaign/static informational pages can become page-record-owned; account/auth, admin, tools, overlay, API, dev/test, links hub, schedule, project read-model pages, complex live-data pages, and money/legal pages remain code-owned or special-case for now.
- Captured route ownership rules: reserved/code-owned paths win, route keys must be normalized and unique per host scope plus path, drafts do not publicly claim routes, exact matching only in version one, and ambiguous public routing fails closed.
- Proposed a future minimal schema shape for coordinator approval: `content_pages` with title, normalized path, draft/published status, visibility, SEO fields, content, timestamps, and optionally an inert/default route scope or host field for later host+path uniqueness.
- Separated first-version path-only routing from later host/subdomain routing and Cloudflare/DNS/reverse-proxy automation.
- No code implementation, migration generation/application, auth changes, Cloudflare/DNS/Docker/deploy config, production behavior changes, AI auto-publishing, money/legal final wording, commits, pushes, deployments, or server state changes were made.

Reviewer gate:

- Coordinator accepted the scope as a future path-only manual content feature.
- A generated migration slice is still needed before any page-admin runtime implementation.

## Chunk 23: Page Creator Persistence Migration (Completed On Dev)

Worker scope:

- Generate, but do not apply, the minimal database migration for path-owned manual page records.
- Add database schema definitions only where required for the generated migration.
- Keep implementation behavior disabled: no public route catch-all, no admin UI/API, no host/subdomain routing, no Cloudflare/DNS/Docker/deploy changes, no auth changes, no AI, no money/legal workflow, no commits, pushes, deployments, or server state changes.

Acceptance criteria:

- Migration can persist normal manual page records with draft/published state, visibility, normalized path, SEO metadata, body content, and timestamps.
- Schema leaves a clear path for later host+path uniqueness without enabling host/subdomain routing behavior in this slice.
- Reserved/code-owned routes are not moved into database ownership by this migration.
- Draft pages cannot become public by migration/default behavior alone.

Suggested checks:

- `pnpm --filter @maiks-yt/database typecheck`
- `node scripts/check-architecture.mjs`

Reviewer gate:

- Coordinator review passed locally with database typecheck, architecture validation, `git diff --check`, and the broader Chunk 21B integration checks.
- Generated migration: `packages/database/drizzle/0013_lowly_justin_hammer.sql`.
- Migration was applied on the dev database after commit `dfc394b` was pulled to `codex-server-1`.
- Runtime page admin and public catch-all routing are now implemented and deployed in Phase 2 on commit `690eb93`.
- Reserved/code-owned route enforcement is implemented in the domain/API rules and was dev-smoked against `/admin/...`; selected existing code-owned routes still returned `200` after deployment.

## Phase 2: Page Creator Runtime (Completed On Dev)

Scope:

- Added owner-gated `/admin/pages` for manual page creation/editing over existing `content_pages`.
- Added Markdown body editing, simple SEO fields, saved preview loading, preview-before-publish publish gate, and publish/unpublish controls.
- Added domain/API rules for path normalization, body/SEO limits, `page-creator:manage`, and reserved/code-owned route blocking.
- Added owner/admin API behavior for list/create/edit/preview/publish/unpublish and public exact-path lookup at `/pages/public?path=...`.
- Added public catch-all rendering for published visible non-reserved page records while keeping existing code-owned routes reserved.

Reviewer gate:

- Coordinator review passed with domain/API/web tests, API/web typechecks, web build, architecture validation, and `git diff --check`.
- Deployed to dev on commit `690eb93`.
- Dev smoke created a draft, confirmed draft public reads return `404`, loaded owner preview, published, confirmed public API and `web-dev` render, rejected reserved `/admin/...` path creation, unpublished, and confirmed public reads return `404` again.
- Existing code-owned routes `/privacy/analytics`, `/projects`, and `/tools/notifications` returned `200` after deployment.

Remaining gates:

- No host/subdomain routing, Cloudflare/DNS automation, redirects, aliases, wildcards, AI publishing, money/legal final wording, reusable block marketplace, provider integration, moderation, auth changes, migration work, or production behavior was added.
- Future page work may add delete/archive, richer structured blocks, route migration of selected hardcoded pages, or host/subdomain routing only as separate scoped phases.

## Phase 3: Stream Visibility Consent (Completed On Dev)

Scope:

- Added `@maiks-yt/domain/events` stream visibility preference definitions for a global website/community opt-out plus website signup, public username, profile image, and future free TTS scopes.
- Added current-user `GET/PUT /account/stream-visibility-preferences` over existing `event_user_opt_outs`; no schema change or migration was needed.
- Added `/account` UI controls for global and per-event stream visibility preferences.
- Updated `/dev/test-console` to attach the signed-in domain user when available so safe simulated website events can enforce persisted opt-outs.
- Kept missing identity fail-closed for opt-out-aware stream-visible simulated website events.

Reviewer gate:

- Coordinator review passed with domain/API tests, API/web typechecks, web build, architecture validation, and `git diff --check`.
- Deployed to dev on commit `9545b19`.
- Dev smoke confirmed the preference API returns five scopes, unauthenticated access returns `401`, `/account` and `/dev/test-console` return `200`, allowed simulated `website.signup` can route when the smoke rule is enabled, global opt-out changes it to `blocked_opt_out`, and missing identity changes it to `blocked_safety`.
- Smoke restored the prior preference snapshot and prior `website.signup:any` routing rule after verification.

## Phase 4A: Event Routing Approval And Overlay Playback (Completed On Dev)

Scope:

- Added a safe Event Routing playback projection for simulated/test-resettable, non-real-money history only.
- Added owner-gated pending approval list and approve/reject APIs under `/admin/event-routing/approvals/...`.
- Routed approved or directly routed safe simulated `top_notification` and `center_notification` outcomes into the existing overlay WebSocket transport.
- Extended `/admin/event-routing` with a pending review panel.
- Kept internal-only, non-overlay, real-provider, real-website-production, and real-money paths fail-closed.

Reviewer gate:

- Coordinator review passed locally with focused domain/API tests, API/web typechecks, web build, architecture validation, and `git diff --check`.
- Deployed to dev on commit `5c8a7f2`.
- Dev smoke opened a live overlay WebSocket, confirmed direct safe simulated `website.signup` playback reached the overlay top notification queue, confirmed approval-required dispatch appeared in pending review and published after approval, confirmed internal-only provider-token events stayed ignored/non-public, and restored the prior rule/preferences afterward.
- Follow-up admin/public smoke confirmed `/admin/event-routing` returned `200` without known injection markers, pending approvals were empty after cleanup, and `website.signup:any` was restored to disabled internal audit.

Remaining gates:

- No provider intake, real website production dispatch, real money, moderation enforcement, provider credentials, secrets, auth redesign, schema/migration work, Cloudflare/Docker/deploy config changes, or production behavior was added.

Remaining gates:

- No real website production dispatch, real provider intake, real money, moderation enforcement, approval review processing, overlay/control playback, auth-provider redesign, schema/migration work, Cloudflare/Docker/deploy config changes, or production behavior was added.
- Signup/onboarding consent placement is currently represented by account settings; a richer signup-time prompt can be added when signup/onboarding UI becomes a dedicated product surface.

## Chunk 24: Production Readiness / Dev-to-Main Plan (Completed)

Worker scope:

- Created a design-only checklist for moving from `dev` toward a future production or `main` release when Michael decides the dev platform is good enough.
- Defined the future release branch boundary, explicit release/operations/safety ownership, fresh production secrets and OAuth keys, no first-login auto-promotion, migration order, backup/restore basics, smoke surfaces, rollback decision points, and dev-only exclusions.
- Identified dangerous gates and blockers: real money, provider credentials, public AI output, moderation enforcement, production auth/secrets, and backup automation.
- Kept Cloudflare/Docker/deployment config edits, production secret rotation, migration generation/application, deployments, and server state changes out of scope.

Reviewer gate:

- Use `reports/production-readiness-checklist.md` before any future `dev` to `main` or production release.
- Do not start production deployment, production migrations, production secret work, Cloudflare/Docker/deployment config edits, real money, provider credentials, public AI, or moderation enforcement from this chunk.

## Chunk 17: No-Schema Event Registry Foundation (Completed)

Worker scope:

- Added `@maiks-yt/domain/events` with typed source platforms, event kinds, platform capability helpers, and routing-safety defaults for future Event Routing Admin and Dev Test Console work.
- Kept this as an in-code domain registry only. No admin persistence, DB schema, migrations, provider integrations, real money behavior, auth changes, moderation enforcement, secrets, Cloudflare/Docker/deploy config, commits, pushes, or deployments were added.
- Future schema-gated work still needs durable routing rules, event history, per-user opt-outs, cooldown state, and simulated/real money separation before any runtime admin console can persist decisions.
- Coordinator review accepted the source/platform categories, event-kind naming, conservative internal-only defaults for account/security/provider-token events, and money-gated/simulated-only metadata.

Do not rerun unless event kinds need to change before UI work depends on them.

## Chunk 18: First Dev Test Console Foundation (Completed)

Worker scope:

- Added `/dev/test-console` under the web app as a dev-only local preview surface for `@maiks-yt/domain/events`.
- The page surfaces source selectors, event kinds filtered by source capability, safety/default badges, internal-only and simulated/test-money labels, impossible-combo prevention, and a random valid preview generator.
- Mock event previews are generated in the browser only. No real event dispatch, persistence, routing rules, approval queues, event history, opt-out storage, cooldown state, provider credentials, real money behavior, simulated-money persistence, auth changes, migrations, Cloudflare/Docker/deploy config, commits, pushes, deployments, or server state were added.
- Coordinator review added a production `notFound()` guard so the route stays dev-only when `NODE_ENV=production`.
- Coordinator committed and pushed `c92e589`, deployed `maiks-yt-dev`, and smoked `https://web-dev.maiks.yt/dev/test-console`.

Reviewer gate:

- Completed on dev. Do not rerun unless a regression is found.

## Chunk 1: Read-Only Projects Vertical Slice (Completed)

The first read-only Projects and Milestones vertical slice is implemented, reviewed, committed, deployed, and seeded on dev.

Do not rerun this chunk unless the coordinator explicitly asks for fixes.

## Chunk 2: Manual Project Admin Vertical Slice (Completed)

Manual project-admin tools are implemented, coordinator-reviewed, committed, mirrored to `dev`, deployed, and dev-smoked.

Do not rerun this chunk unless the coordinator explicitly asks for fixes.

## Chunk 3: Creator Hub Link Admin Slice (Superseded)

The first worker stopped at the correct gate: current links live in `apps/web/src/content/public-creator-links-data.ts`, and a real owner/admin workflow cannot safely edit compiled TypeScript source at runtime.

Do not rerun this chunk. Use Chunk 3B for the database-backed admin workflow.

## Chunk 3A: Database-backed Creator Links Foundation (Completed)

Database-backed Creator Links are implemented, coordinator-reviewed, committed, mirrored to `dev`, migrated on dev, seeded, deployed, and smoke-tested.

Do not rerun this chunk unless the coordinator explicitly asks for fixes.

## Chunk 3B: Creator Hub Link Admin Slice (Completed)

Creator Hub link admin is implemented, coordinator-reviewed, committed, mirrored to `dev`, deployed, dev-smoked, and accepted by Michael as usable enough to move on.

Do not rerun this chunk unless the coordinator explicitly asks for fixes.

## Chunk 4: Stream Tools PWA Foundation (Completed)

The first Stream Tools PWA foundation is implemented, coordinator-reviewed, committed, mirrored to `dev`, deployed, and smoke-checked at a basic endpoint level.

Reviewer notes:

- `https://web-dev.maiks.yt/manifest.webmanifest` returns `200`, `application/manifest+json`, `display: "standalone"`, `scope: "/tools/"`, and `start_url: "/tools/actions"`.
- `https://web-dev.maiks.yt/tools/actions` returns `200`, contains the Action Panel surface, and did not show normal website navbar markers in the fetched HTML.
- No service worker/private API caching was introduced; the only cache-control hits found in app code were the public manifest cache and existing SSE no-cache headers.

Do not rerun this chunk unless the coordinator explicitly asks for fixes.

## Chunk 5: Chat Verification Harness, Not Full Chat (Completed)

The fake/local chat verification harness is implemented, coordinator-reviewed, committed, mirrored to `dev`, deployed, and endpoint-gate checked.

Reviewer notes:

- `https://api-dev.maiks.yt/overlay/chat/test` exists and rejects a dummy valid-length token with `403` and `{"ok":false,"reason":"token_not_found"}`.
- `https://api-dev.maiks.yt/overlay/status` rejects the same dummy token with `token_not_found`, confirming the control-panel gate remains in place.
- Browser/OBS verification of real fake-message rendering remains manual because this review did not have a valid control/overlay token pair.
- This remains a fake verification harness only; real Twitch/YouTube chat, moderation, stream bot commands, ranks, profiles, and AI reading are still deferred.

Do not rerun this chunk unless the coordinator explicitly asks for fixes.

## Chunk 6: Control Panel Installability Slice (Completed)

The control panel installability slice is implemented, coordinator-reviewed, committed, mirrored to `dev`, deployed, and smoke-tested.

Reviewer notes:

- `https://control-dev.maiks.yt/manifest.webmanifest` returned `200` after deployment.
- `https://control-dev.maiks.yt/` returned `200`.
- Invalid control tokens still return `403 token_not_found`.
- No service worker/private API caching was introduced.
- Installed-window visual QA at 1920x1080, 1600x900, and 1366x768 remains manual.

Do not rerun this chunk unless the coordinator explicitly asks for fixes.

## Chunk 7: Streamer Chat Foundation Planning/First Slice (Completed)

The fake/local streamer chat foundation is implemented, coordinator-reviewed, committed, mirrored to `dev`, deployed, and smoke-tested at the protected endpoint level.

Reviewer notes:

- The streamer chat surface is fake/local-only and lives inside the existing token-gated control panel.
- `GET /streamer-chat/messages` is deployed and rejects dummy tokens with `403 token_not_found`.
- `WS /streamer-chat/live` sends a snapshot and new fake/local messages to streamer chat viewers when given a valid control token.
- Overlay still receives the existing fake chat event and keeps its human-only, visible-slot rendering rules.
- A follow-up added a chat order toggle so fake/local chat can display newest-on-top or newest-on-bottom.
- No real Twitch/YouTube chat, moderation, bans, mutes, ranks, profiles, stream bot commands, AI reading, money, auth, secrets, or migration work was added.

Do not rerun this chunk unless the coordinator explicitly asks for fixes.

## Chunk 8: Stream Scheduling MVP (Completed)

Model: GPT-5.5

Result:

- Implemented typed stream scheduling domain rules and focused tests.
- Added `stream_schedule_entries` schema plus generated migration `packages/database/drizzle/0009_concerned_molecule_man.sql`.
- Added non-destructive dev seed examples for one upcoming public stream and one cancelled public stream.
- Added public `GET /schedule` and owner-gated `/admin/schedule` create/edit/cancel API routes.
- Added public `/schedule` with fallback/dev data and owner `/admin/schedule` manual controls.
- Coordinator review accepted the migration/schema after adding merged-update validation so invalid partial schedule edits are rejected before database checks.
- Committed as `f73aae4 feat: add stream schedule mvp`, mirrored to `dev`, migrated on dev, seeded, deployed, and public API/web-smoked.
- Owner-auth create/edit/cancel browser smoke remains manual.

Prompt:

```text
Read AGENTS.md, reports/current-work.md, reports/next-agent-tasks.md, TODO.md section 10, and the stream scheduling idea cards if present.

Task:
Build the first Stream Scheduling MVP for internal schedules and public visibility.

You may edit:
- packages/domain/src/schedule/ or equivalent established domain structure
- packages/domain/test/
- packages/database/src/database.schema.ts
- packages/database/drizzle/ generated migration files only; do not apply migrations
- packages/database/src/seed-dev.service.ts if useful for non-destructive dev examples
- apps/api/src/schedule/ or equivalent route/service/store files
- apps/api/src/main.ts only to register schedule routes
- apps/api/test/schedule/
- apps/web/src/app/schedule/
- apps/web/src/app/admin/schedule/
- TODO.md
- reports/current-work.md
- reports/next-agent-tasks.md

Acceptance criteria:
- Add a typed stream schedule model for planned streams with title, start time, optional end time, channel/topic/theme fields, visibility, status, and cancellation reason.
- Add owner-gated admin create/edit/cancel controls.
- Add a public schedule page that shows upcoming public streams and clearly marks cancellations.
- Add cancellation reason templates or a constrained cancellation reason field.
- Keep external Twitch/YouTube scheduling sync, Discord/social announcements, recurrence automation, notifications, AI, money, and moderation out of scope.
- Keep the first slice manual and easy to test with dev seed data.

Verification:
- pnpm --filter @maiks-yt/domain test
- pnpm --filter @maiks-yt/api test
- pnpm --filter @maiks-yt/api typecheck
- pnpm --filter @maiks-yt/web typecheck
- pnpm --filter @maiks-yt/web build
- pnpm --filter @maiks-yt/database typecheck
- node scripts/check-architecture.mjs

Browser/manual smoke if practical:
- Open `/schedule` and confirm the public schedule renders with dev/fallback data.
- Open `/admin/schedule` as an owner if auth is available, or document the exact blocker.
- Confirm cancelled streams remain visible with clear cancellation wording when public.

Completed. Do not rerun this chunk unless the coordinator explicitly asks for fixes.
```

Reviewer gate:

- Public `/schedule` returned the two seeded dev entries and cancellation wording after deploy.
- `GET /admin/schedule` without auth returned `401 not_authenticated`.
- Owner-auth admin smoke still needs an authenticated browser session.

## Chunk 9: Installed Stream Tools QA Slice (Endpoint/Token QA Completed, Visual QA Still Open)

Model: GPT-5.5

Endpoint/token QA result:

- Verified `https://web-dev.maiks.yt/tools/actions` returns `200`.
- Verified `control-dev` and `overlay-dev` app shells return `200`.
- Verified `control-dev` and web stream-tools manifests return `200` with standalone display metadata.
- Verified invalid control tokens still return `403 token_not_found`.
- Verified valid control token can read overlay status and streamer chat history.
- Verified fake/local human chat can be sent, appears in streamer chat history, and reports active overlay connections.
- Verified chat order can be toggled through the API, then restored to the previous `newestOnTop: false` state.
- Verified valid overlay token can read overlay state with the gameplay/camera-left scene layout.
- Verified no new service-worker/private API cache code is present in `apps/control-panel`, `apps/overlay`, or `apps/web/src`.

Visual QA blocker:

- The Chrome/in-app browser plugin failed to attach in this setup with `CreateProcessAsUserW failed: 5`, and no local Playwright/Puppeteer dependency is installed. Visual installed-window checks at 1920x1080, 1600x900, and 1366x768 still need Computer Use or a documented manual pass.

Follow-up prompt for visual-only QA:

Prompt:

```text
Read AGENTS.md, reports/current-work.md, reports/next-agent-tasks.md, TODO.md section 14A, and ideas/installable-pwa-control-surfaces.md.

Task:
Do the remaining visual installed-window/browser QA pass for the installable stream tools and fake/local chat surfaces using Computer Use.

You may edit:
- TODO.md
- reports/current-work.md
- reports/next-agent-tasks.md
- small CSS/UI fixes in apps/control-panel/src/ and apps/overlay/src/ only if directly required by QA findings

Acceptance criteria:
- Test `/tools/actions`, `control-dev`, and `overlay-dev` at 1920x1080, 1600x900, and 1366x768 with Computer Use.
- Verify no normal website navbar appears on standalone tools.
- Visually verify control-panel token-blocked state, dense controls, scene designer sizing, overlay visibility toggles, fake/local chat sender, streamer chat viewer, and chat order toggle.
- Verify overlay chat stays inside the chat slot and respects visibility/order settings.
- Keep service workers, offline caches, real chat providers, moderation, AI, and money out of scope.

Verification:
- pnpm --filter @maiks-yt/control-panel typecheck
- pnpm --filter @maiks-yt/overlay typecheck
- pnpm --filter @maiks-yt/web typecheck
- node scripts/check-architecture.mjs

Do not commit, push, deploy, apply migrations, or edit files outside the allowed scope.
Report changed files, checks run, skipped Computer Use/manual checks, and unresolved concerns.
```

Reviewer gate:

- Review screenshots/notes for overlap and installability regressions.
- Verify any CSS/UI fixes are narrow and do not change auth/token behavior.

## Chunk 10: Next Queue Review (Completed)

Model: GPT-5.5

Completed 2026-06-20.

Status review:

- Completed: localization, privacy/analytics boundaries, overlay renderer foundations, control panel foundations, Action Panel, public projects read slice, manual project admin, database-backed Creator Links and link admin, stream-tools PWA foundation, fake/local chat harness, streamer-only fake/local chat viewer, chat order toggle, and manual Stream Scheduling MVP.
- Partial: installable stream tools are endpoint/token verified but still need visual installed-window QA; Creator Hub support link is structurally supported but unavailable; projects still need updates/session focus/wishlist follow-ups; manual content admin still needs preview-before-publish.
- Blocked: Creator Hub support destination needs Michael-approved URL and public wording; owner-auth schedule admin smoke needs an authenticated owner session; real Twitch/YouTube chat needs an approved integration phase.
- Risky/gated: money/ledger/credits/refunds, moderation/bans/ranks, auth/owner assignment, provider integrations, database migrations, service workers/offline caching, and AI public output remain gated and should not be combined into casual UI polish tasks.

Result:

- Next larger chunks are proposed below as Chunks 11-14.
- Visual QA notes now point to Computer Use instead of the broken Chrome/in-app browser plugin path.

Prompt:

```text
Read AGENTS.md, reports/current-work.md, reports/next-agent-tasks.md, and TODO.md.

Task:
Do a read-only review and propose the next larger agent chunks.

You may edit:
- reports/next-agent-tasks.md
- reports/current-work.md
- TODO.md

Acceptance criteria:
- Identify completed, partial, blocked, and risky areas.
- Propose 2-4 larger chunks that reduce repeated context/check overhead.
- Keep high-risk areas like money/auth/moderation/database migrations clearly gated.
- Do not implement features.

Run:
- node scripts/check-architecture.mjs

Do not commit, push, deploy, or edit outside the allowed scope.
```

## Chunk 11: Dev Admin Token Management Surface (Completed)

Model: GPT-5.5

Purpose:

- Let the owner create, rotate, revoke, and copy scoped dev URLs for OBS overlays and the control panel without direct database access.
- Unblock OBS/control setup and the later visual QA pass.

Result:

- Added typed first-slice token admin targets for overlay and control-panel scopes.
- Added owner-gated `GET /admin/tokens`, `POST /admin/tokens`, `POST /admin/tokens/:id/rotate`, and `POST /admin/tokens/:id/revoke` routes backed by the existing `url_access_tokens` table.
- Kept token hashes out of list responses; raw token values appear only in create/rotate mutation responses with dev URLs for `overlay-dev.maiks.yt` and `control-dev.maiks.yt`.
- Added `/admin/tokens` as a practical owner admin page for listing, creating, rotating, revoking, and copying one-time generated URLs.
- Did not add migrations, production token architecture, Cloudflare Access, secrets management, or deployment changes.
- Coordinator reviewed, committed, pushed to `dev`, deployed with `scripts/deploy-dev.sh` on `codex-server-1`, and smoked the public/admin API boundary.
- Fresh private dev owner, overlay, and control-panel URLs were generated and stored in ignored `reports/usable-urls.md` with local `0600` permissions.
- Live token smoke confirmed overlay tokens validate for `overlay:connect` with `requiresLogin=false`, control-panel tokens validate for `control:open` with `requiresLogin=true`, and revoked tokens stop validating.

Verification run by worker:

- `pnpm --filter @maiks-yt/domain test` passed: 9 files, 55 tests.
- First `pnpm --filter @maiks-yt/api test` run failed before tests because package entrypoints had not been built for workspace resolution; after typecheck/build references were present, rerun passed: 7 files, 49 tests.
- `pnpm --filter @maiks-yt/api typecheck` passed.
- `pnpm --filter @maiks-yt/web typecheck` passed.
- `node scripts/check-architecture.mjs` passed.

Still needed:

- Browser-level owner UI smoke is still useful during Chunk 12 because visual QA must use the installed-window/browser environment.
- Do not rerun this implementation chunk unless a regression is found.

Prompt:

```text
Read AGENTS.md, reports/current-work.md, reports/next-agent-tasks.md, TODO.md section 4, ideas/url-token-access-gates.md, and ideas/admin-token-management-surface.md.

Task:
Build the first dev admin token management surface for scoped URL access tokens.

You may edit:
- packages/domain/src/security/
- packages/domain/test/
- apps/api/src/tokens/ or an equivalent established admin-token route/service/store folder
- apps/api/src/main.ts only to register token admin routes
- apps/api/test/tokens/ or equivalent focused API tests
- apps/web/src/app/admin/tokens/
- TODO.md
- reports/current-work.md
- reports/next-agent-tasks.md

Acceptance criteria:
- Add owner/admin authenticated API routes to list existing URL access tokens without exposing token hashes.
- Add create actions for overlay and control-panel tokens using the existing `url_access_tokens` table.
- Show the raw token only in the create/rotate response so it can be copied once.
- Add revoke behavior for lost tokens.
- Generate copyable dev URLs for `overlay-dev.maiks.yt` and `control-dev.maiks.yt`.
- Keep token scopes strict: overlay tokens must not work for control-panel access, and control-panel tokens must not work for overlay access.
- Keep current dev DB/token plumbing acceptable; do not add production token architecture, Cloudflare Access, secrets management, migrations, or deployment changes.
- Keep the page practical and dense. Do not spend time on broad aesthetics outside making the admin surface usable.

Verification:
- pnpm --filter @maiks-yt/domain test
- pnpm --filter @maiks-yt/api test
- pnpm --filter @maiks-yt/api typecheck
- pnpm --filter @maiks-yt/web typecheck
- node scripts/check-architecture.mjs

Manual/dev smoke after coordinator deploys:
- Open `/admin/tokens` as owner.
- Create one overlay token and one control-panel token.
- Confirm the generated overlay URL validates on `overlay-dev`.
- Confirm the generated control URL opens the token gate on `control-dev`.
- Revoke the old/lost token if known, or document that the lost token value is unavailable and cannot be selectively revoked.

Do not commit, push, deploy, apply migrations, edit secrets, edit Cloudflare config, or edit Docker/deployment scripts.
Report changed files, checks run, skipped smoke checks, and unresolved concerns.
```

Reviewer gate:

- Confirm raw token values are never listed after creation/rotation.
- Confirm generated URLs use dev hostnames only.
- Confirm no production credential assumptions were added.
- Confirm revoked tokens stop validating through `/access/url-token/validate`.

## Chunk 12: Computer Use Visual QA For Installed Stream Tools (Headless Chrome Fallback Complete)

Model: GPT-5.5

Purpose:

- Finish the visual gap left by Chunk 9 without reopening endpoint/token QA.
- Run after Chunk 11 so fresh overlay/control URLs are available.

Coordinator fallback result:

- Computer Use was not exposed in the 2026-06-21 thread, so true installed-window/browser-chrome-free QA could not be completed.
- Headless Chrome via DevTools captured screenshots at 1920x1080, 1600x900, and 1366x768 for `/tools/actions`, token-blocked control panel, dev-authenticated control panel, scene designer, overlay-ready state, and overlay chat.
- Screenshots and machine summaries are in `reports/visual-qa/chunk-12/`.
- No normal website navbar appeared on the tested standalone surfaces.
- No horizontal overflow was detected at any target size.
- Dev-authenticated control panel showed dense controls, fake/local chat viewer, newest-on-top order, and scene designer sizing.
- Overlay chat stayed inside its slot, newest-on-top displayed correctly, chat-off hid new fake/local messages, and chat-on restored display.

Remaining if strict QA is required:

- Rerun with Computer Use or a real installed PWA window when available, because headless Chrome does not prove browser-chrome-free installed-window behavior.

Prompt:

```text
Read AGENTS.md, reports/current-work.md, reports/next-agent-tasks.md, TODO.md section 14A, and ideas/installable-pwa-control-surfaces.md.

Task:
Use Computer Use to visually QA the installed stream-tool surfaces and fake/local chat surfaces.

You may edit:
- TODO.md
- reports/current-work.md
- reports/next-agent-tasks.md
- small CSS/UI fixes in apps/control-panel/src/ and apps/overlay/src/ only if directly required by QA findings

Acceptance criteria:
- Test `/tools/actions`, `control-dev`, and `overlay-dev` at 1920x1080, 1600x900, and 1366x768.
- Verify no normal website navbar appears on standalone tools.
- Visually verify control-panel token-blocked state, dense controls, scene designer sizing, overlay visibility toggles, fake/local chat sender, streamer chat viewer, and chat order toggle.
- Verify overlay chat stays inside the chat slot and respects visibility/order settings.
- Keep service workers, offline caches, real chat providers, moderation, AI, auth changes, and money out of scope.
- If Computer Use is unavailable, stop after the read-only checks and report the exact blocker.

Verification:
- pnpm --filter @maiks-yt/control-panel typecheck
- pnpm --filter @maiks-yt/overlay typecheck
- pnpm --filter @maiks-yt/web typecheck
- node scripts/check-architecture.mjs

Do not commit, push, deploy, apply migrations, or edit files outside the allowed scope.
Report screenshots/observations, changed files, checks run, skipped checks, and unresolved concerns.
```

Reviewer gate:

- Confirm screenshots/notes cover all three target sizes.
- Verify any CSS/UI fixes are narrow and do not change auth/token behavior.

## Chunk 13: Manual Content Publishing Polish (Completed)

Model: GPT-5.5

Purpose:

- Finish the next useful manual content layer before AI-assisted content generation.
- Bundle project updates, preview-before-publish behavior, and optional support-link activation only if Michael provides approved wording.

Worker result:

- Implemented the smaller coherent slice: preview-before-publish for existing project admin content.
- Added a typed domain helper that builds the public project detail projection for admin preview while only bypassing `isPublic`; statuses hidden from public pages still block preview.
- Added `/admin/projects` preview UI for unsaved project basics plus saved public milestones/items, including draft/unpublished projects before publish.
- Kept public `/projects` list/detail behavior unchanged; public read-model rules still filter to `isPublic` projects with planning, active, or completed status and strip cancelled/removed children.
- Did not add project updates, support payments/links, AI drafting, provider integrations, moderation, auth changes, migrations, secrets, Cloudflare config, Docker/deploy changes, commits, pushes, or deployments.
- Coordinator reviewed, committed, pushed to `dev`, deployed to `maiks-yt-dev`, and dev-smoked the slice.
- Dev smoke confirmed `/admin/projects` renders the Public Preview UI with the dev owner bearer, public project list/detail routes respond, and no private admin projects appeared in the public project list.

Worker verification:

- `pnpm --filter @maiks-yt/domain test` passed: 9 files, 57 tests.
- First `pnpm --filter @maiks-yt/api test` and `pnpm --filter @maiks-yt/api typecheck` failed on missing fresh-worktree package dist entrypoints; after the shared package build fallback below, both passed.
- `pnpm --filter @maiks-yt/config --filter @maiks-yt/database --filter @maiks-yt/domain --filter @maiks-yt/events --filter @maiks-yt/integrations --filter @maiks-yt/testing --filter @maiks-yt/themes --filter @maiks-yt/ui build` passed.
- `pnpm --filter @maiks-yt/api test` passed after build fallback: 7 files, 49 tests.
- `pnpm --filter @maiks-yt/api typecheck` passed after build fallback.
- `pnpm --filter @maiks-yt/web typecheck` passed.
- `node scripts/check-architecture.mjs` passed.

Reviewer gate:

- Confirmed the admin preview is sufficient for the no-migration publishing polish slice.
- Smoked `/admin/projects` as owner through the dev bearer.
- Confirmed no private admin project appeared in public `/projects`.
- Do not rerun this implementation chunk unless a regression is found.

Prompt:

```text
Read AGENTS.md, reports/current-work.md, reports/next-agent-tasks.md, TODO.md sections 5, 9, and 9A, and only the relevant project/admin idea card if product intent is needed.

Task:
Add the next manual content publishing slice for project updates and preview-before-publish behavior.

You may edit:
- packages/domain/src/projects/ or established project/content domain files
- packages/domain/test/
- apps/api/src/projects/ or established project/content API files
- apps/api/test/projects/
- apps/web/src/app/projects/
- apps/web/src/app/admin/projects/
- apps/web/src/app/admin/links/ only if Michael has approved the support URL and wording
- TODO.md
- reports/current-work.md
- reports/next-agent-tasks.md

Acceptance criteria:
- Add manual project update create/edit/publish-state behavior, or extend the existing project admin with preview-before-publish behavior if that is the smaller coherent slice.
- Public pages show only published/visible content.
- Admin pages can preview draft or unpublished public-content changes before publishing.
- Support link activation is allowed only with Michael-approved destination and wording; otherwise keep it unavailable and document the blocker.
- Keep AI drafting, money/support payments, provider integrations, moderation, auth changes, and migrations out of scope unless the coordinator explicitly assigns a generated migration.

Verification:
- pnpm --filter @maiks-yt/domain test
- pnpm --filter @maiks-yt/api test
- pnpm --filter @maiks-yt/api typecheck
- pnpm --filter @maiks-yt/web typecheck
- node scripts/check-architecture.mjs

Do not commit, push, deploy, apply migrations, or edit files outside the allowed scope.
Report changed files, checks run, skipped checks, and unresolved concerns.
```

Reviewer gate:

- Confirm no unpublished content leaks onto public pages.
- Confirm support destination wording was explicitly provided before enabling support.

## Chunk 14: Stream Focus And Project Link Planning Slice

Model: GPT-5.5

Result:

- Completed as a design-only slice because implementation needs an explicitly approved generated migration.
- Current schema finding: `stream_schedule_entries` powers the manual schedule admin/public flow but has no project link or active focus fields.
- Existing `stream_sessions.active_project_id` is not a safe substitute because `stream_sessions` is only seeded today and is not wired into `/admin/schedule`, public `/schedule`, or the schedule domain/API contracts.
- Smallest manual workflow: owner edits a scheduled stream, chooses one existing public project as the stream focus, optionally enters short non-monetary focus copy, and public `/schedule` shows a restrained "Stream focus" project link/copy only when the scheduled stream is public and the linked project is public.
- Proposed generated-migration scope: add nullable `project_id`, nullable `focus_label`, and nullable `focus_note` columns to `stream_schedule_entries`, plus an index on `project_id`. Keep any foreign-key decision for coordinator review because current project relations are index-based rather than enforced in this schema.
- Public wording must stay non-monetary and must not imply donations, support goals, automated provider sync, announcements, recurrence, notifications, moderation, AI, or support promises.

Do not implement this chunk until the coordinator explicitly approves or revises the migration scope.

## Chunk 14A: Manual Schedule Stream Focus Implementation (Completed)

Model: GPT-5.5

Result:

- Generated migration `packages/database/drizzle/0010_lonely_whistler.sql`.
- Added nullable `project_id`, `focus_label`, and `focus_note` to `stream_schedule_entries`, plus index `stream_schedule_project_id_idx`.
- Updated typed schedule domain/API/admin/public flow so the owner can set/clear a public-project stream focus and short non-monetary focus copy.
- Public `/schedule` renders restrained "Stream focus" copy only when the schedule entry is public and the linked project is public/visible.
- Public API reads null out focus fields when the linked project is not public/visible.
- Did not add provider sync, announcements, recurrence automation, notifications, moderation, AI, auth changes, secrets, Cloudflare/Docker/deploy changes, or money behavior.

Reviewer notes:

- Coordinator reviewed, committed, pushed to `dev`, applied migration `0010_lonely_whistler.sql` on the dev database, deployed commit `6cc3c0c`, and dev-smoked owner editing plus public schedule rendering.
- Dev smoke left "Maiks.yt V2 build stream" linked to "Build Maiks.yt V2" with short focus copy so `/schedule` has a visible example.
- Owner `/admin/schedule` returned project options and accepted the focus-field PATCH.
- Public `/schedule` rendered the focus label, public project link, and note for the linked public project.

Purpose:

- Move from standalone schedules/projects toward a manual live-stream focus workflow without touching external provider sync.

Prompt:

```text
Read AGENTS.md, reports/current-work.md, reports/next-agent-tasks.md, TODO.md sections 5, 10, and 13, and one relevant stream/session/project idea card if needed.

Task:
Design and, if the existing schema supports it without risky changes, implement the first manual stream focus/project-link slice.

You may edit:
- packages/domain/src/schedule/ and/or packages/domain/src/projects/ only for typed contracts
- packages/domain/test/
- apps/api/src/schedule/ and/or apps/api/src/projects/
- apps/api/test/
- apps/web/src/app/schedule/
- apps/web/src/app/admin/schedule/
- apps/web/src/app/projects/
- TODO.md
- reports/current-work.md
- reports/next-agent-tasks.md

Acceptance criteria:
- Define the smallest manual workflow for linking a scheduled/current stream to a project or active focus.
- If no migration is needed, implement the read/update flow and public display.
- If a migration is needed, stop after a design note and proposed generated-migration scope for coordinator approval.
- Keep Twitch/YouTube scheduling sync, Discord/social announcements, recurrence automation, notifications, moderation, AI, auth changes, and money out of scope.

Verification:
- pnpm --filter @maiks-yt/domain test
- pnpm --filter @maiks-yt/api test
- pnpm --filter @maiks-yt/api typecheck
- pnpm --filter @maiks-yt/web typecheck
- node scripts/check-architecture.mjs

Do not commit, push, deploy, apply migrations, or edit files outside the allowed scope.
Report changed files, checks run, skipped checks, migration needs, and unresolved concerns.
```

Reviewer gate:

- Decide explicitly whether any database migration is accepted before assigning implementation that requires it.
- Confirm public display cannot imply money goals or automated provider sync.

## Chunk 15: Safety Gates Review Before Risky Phases (Completed)

Model: GPT-5.5

Purpose:

- Reduce risk before auth/moderation/money/AI work by turning open risks into explicit phase gates.

Result:

- Completed as a design-only documentation slice.
- Added explicit phase gates for production auth/owner assignment, moderation, AI public output, money/ledger/credits/refunds, backup/export/recovery, and provider integrations.
- Identified first safe slices: project updates design, visual installed-window QA, support-link wording/destination decision, provider-neutral research, and backup inventory/runbook work using dev/staging data only.
- Reconfirmed that real Twitch/YouTube/Discord/music/payment integrations, production OAuth secrets, enforcement moderation, public AI output, real money behavior, and production backup automation all need separate explicit go/no-go decisions.
- Did not implement features, edit auth, edit migrations, edit secrets, edit Cloudflare/Docker/deployment config, commit, push, deploy, or apply migrations.

Prompt:

```text
Read AGENTS.md, reports/current-work.md, reports/next-agent-tasks.md, TODO.md sections 12, 14, 15, 16, and 17, plus one relevant principles or idea card only if needed.

Task:
Do a read-only safety-gates review for upcoming high-risk phases.

You may edit:
- TODO.md
- reports/current-work.md
- reports/next-agent-tasks.md
- one new or existing idea card only if the coordinator explicitly includes it in the write scope

Acceptance criteria:
- Separate auth/owner assignment, moderation, AI public output, money/ledger/credits/refunds, backups, and provider integrations into clearly gated future phases.
- Identify prerequisites and first safe non-money/non-provider slices.
- Do not implement features.
- Do not edit migrations, auth code, secrets, Cloudflare config, Docker config, deployment scripts, or money behavior.

Verification:
- git status --short --branch
- node scripts/check-architecture.mjs

Do not commit, push, deploy, apply migrations, or edit outside the allowed scope.
Report changed files, checks run, skipped checks, and unresolved concerns.
```

Reviewer gate:

- Confirm every risky phase has an explicit go/no-go decision point before code work starts.

## Chunk 16: Manual Project Updates Design Gate

Model: GPT-5.5

Purpose:

- Move projects from static admin-managed content toward a living public update log without mixing in AI, money, provider sync, or support promises.

Prompt:

```text
Read AGENTS.md, reports/current-work.md, reports/next-agent-tasks.md, TODO.md sections 5, 9, and 9A, plus one relevant project/admin idea card only if needed.

Task:
Design the manual project updates workflow and, only if the current schema already supports it safely, implement the smallest read/write slice. If new tables or columns are required, stop at a proposed generated-migration scope for coordinator approval.

You may edit:
- packages/domain/src/projects/ only for typed contracts/rules if implementing is safe without migration
- packages/domain/test/ only for focused project update rules if implementing is safe without migration
- apps/api/src/projects/ only if implementing is safe without migration
- apps/api/test/projects/ only if implementing is safe without migration
- apps/web/src/app/projects/
- apps/web/src/app/admin/projects/
- TODO.md
- reports/current-work.md
- reports/next-agent-tasks.md

Acceptance criteria:
- Define manual create/edit/publish-state behavior for project updates.
- Public pages must show only published/visible updates for public/visible projects.
- Admin pages must support preview-before-publish or clearly preserve the existing preview workflow.
- If schema work is needed, document the minimal migration shape and stop.
- Keep AI drafting, support/money, provider sync, notifications, moderation, auth changes, secrets, Cloudflare/Docker/deploy changes, and production behavior out of scope.

Verification:
- If docs/design only: git status --short --branch and node scripts/check-architecture.mjs.
- If implementation is safe without migration: pnpm --filter @maiks-yt/domain test, pnpm --filter @maiks-yt/api test, pnpm --filter @maiks-yt/api typecheck, pnpm --filter @maiks-yt/web typecheck, node scripts/check-architecture.mjs.

Do not commit, push, deploy, apply migrations, edit secrets, edit auth, or edit outside the allowed scope.
Report changed files, checks run, skipped checks, migration needs, and unresolved concerns.
```

Reviewer gate:

- Confirm unpublished updates cannot leak publicly.
- Decide explicitly whether any proposed migration is accepted before implementation.

## Chunk 16A: Project Updates Migration + Manual Admin/Public Slice (Completed)

Model: GPT-5.5

Result:

- Generated unapplied migration `packages/database/drizzle/0011_mean_doctor_strange.sql`.
- Added durable `project_updates` schema with `project_id`, title, optional summary, body, draft/published status, visible flag, optional `published_at`, pinned flag, sort order, timestamps, and project/public ordering indexes.
- Added typed domain read/admin rules so public project details include only published visible updates and admin preview reuses the public projection.
- Added owner/project-admin API create/edit/publish-state routes under `/admin/projects/:id/updates`.
- Added `/admin/projects` manual update controls and public `/projects/[slug]` update rendering.
- Coordinator review fixed the public summary projection so project list summaries keep `updateCount` but do not carry full update bodies.
- Coordinator committed and pushed `dce7989`, applied migration `0011_mean_doctor_strange.sql` on the dev database, deployed `maiks-yt-dev`, and dev-smoked owner create/publish plus public API/web rendering.
- Dev smoke left a published "Dev smoke project update" on the Maiks.yt V2 project so public project detail visibly exercises the feature.
- Kept AI drafting, support links, money, provider sync/notifications, moderation, auth, secrets, Cloudflare/Docker/deploy changes, migration application, commits, pushes, and deploys out of scope.

Reviewer gate:

- Completed on dev. Do not rerun unless a regression is found.
