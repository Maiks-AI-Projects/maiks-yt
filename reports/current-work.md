# Current Work

Updated: 2026-06-27

## Objective

Move from foundation work into active feature lanes on `dev`, starting with a private notification panel for dev/system alerts.

## Completed In This Pass

- Finished the localization foundation with English default and Dutch-ready helpers.
- Added an explicit telemetry allowlist and retention boundaries.
- Added the public analytics/privacy explanation page.
- Documented the first local production hosting shape.
- Verified overlay and scene-designer geometry at 1920x1080 and 1280x720 browser viewports.
- Added canonical overlay scaling for non-16:9 browser-source viewports.
- Chose one shared, always-loaded master overlay instead of separate preloaded scene overlays.
- Centralized typed public Creator Hub links, including honest unavailable states for unpublished destinations.
- Added public personal context, accountability/history, and affiliate disclosure page foundations.
- Added typed Action Panel view and decision capabilities with owner wildcard support.
- Added decision-kind-aware approve, reject, and defer transition rules with bounded optional notes.
- Aligned Action Panel persistence with the domain contract while preserving legacy provenance fields.
- Added constrained append-only Action Panel decision history and non-destructive development seeds.
- Added an authenticated Action Panel API with linked-domain-user authorization.
- Added transactional decisions with permission revalidation, optimistic status checks, and append-only history.
- Replaced the URL-demo Action Panel with authenticated persistent API decisions.
- Added recent Action Panel decision history, signed-out/forbidden/stale states, and server-provided decision controls.
- Added a dev-only explicit owner-role claim path for approved test emails so the real creator account can access owner-gated tools.
- Added the standalone `/tools/actions` Action Panel route without normal website navigation.
- Verified the shared OBS browser source scene-switching behavior with shutdown-when-hidden disabled; live platform chat remains unverified.
- Added approved Creator Hub Twitch, YouTube, and Discord/community destination links for the dev site.
- Added the first read-only Projects vertical slice with public project list/detail pages, public API endpoints, domain read-model helpers, and non-monetary dev seeds.
- Added the first manual project-admin implementation for non-money project content: typed owner/project-admin permission rules, admin API service/store/route files, focused domain/API tests, and the `/admin/projects` form page.
- Registered the project-admin API route from the coordinator-owned API entrypoint.
- Kept AI assistance, support, funding, provider, donation, wishlist integration, ledger, and price/estimate behavior out of the admin forms and mutation payloads.
- Added a mock support/payment simulator planning card and linked it from the simulator and money planning docs.
- Added the database-backed Creator Links foundation with a `creator_links` schema/migration, dev seeds, public domain read-model rules, public API route, and `/links` runtime loading with a reviewed static fallback.
- Kept the Creator Hub support link unavailable in the database seed and static fallback.
- Added the first manual Creator Hub link admin workflow with owner-gated API mutations, focused validation/tests, and `/admin/links` forms for create/edit/reorder/publish state.
- Kept support destinations forced unavailable in the Creator Hub link admin slice until Michael approves the URL and public wording.
- Added the first Stream Tools PWA foundation with a standalone `/tools/actions` manifest start URL, shared placeholder icons, and no private API/data caching.
- Added a fake/local chat verification harness with typed events, a control-panel sender, and overlay rendering that respects chat visibility and hides bot/system messages by default.
- Verified the dev Stream Tools manifest, standalone `/tools/actions` route, fake chat token gate, and absence of newly introduced service-worker/private API caching.
- Added same-origin PWA installability metadata for the existing control panel app while preserving its `control-panel` URL-token gate and current fake/local chat controls.
- Deferred control-panel service-worker work so private API, fake/local chat, moderation, account/session, action-panel, admin, and money responses remain outside offline caches.
- Added the first streamer-only fake/local chat viewing surface with in-memory API history and a token-gated live feed, while keeping overlay chat visibility and bot/system hiding behavior unchanged.
- Reviewed and deployed the control-panel installability slice.
- Reviewed and deployed the streamer-only fake/local chat viewer.
- Added a fake chat order toggle so streamer chat and overlay chat can show newest messages at the top or bottom.
- Kept `reports/usable-urls.md` as a local ignored token reference file so private dev access URLs are easy to find without being committed.
- Added the first manual Stream Scheduling MVP with typed planned-stream rules, a generated `stream_schedule_entries` migration, non-destructive dev seed examples, public `/schedule`, owner-gated `/admin/schedule`, and constrained cancellation reason templates.
- Reviewed, committed, migrated, seeded, deployed, and dev-smoked the first manual Stream Scheduling MVP.
- Kept Twitch/YouTube scheduling sync, Discord/social announcements, recurrence automation, notifications, AI, money, moderation, auth, and secrets out of the scheduling slice.
- Ran a stream-tools endpoint/token QA pass for `/tools/actions`, `control-dev`, `overlay-dev`, manifests, token gates, fake/local chat, streamer chat history, chat order, and overlay state.
- Added the first dev admin token management surface with typed strict overlay/control-panel URL token targets, owner-gated API list/create/rotate/revoke routes, focused tests, and a dense `/admin/tokens` page that shows raw token URLs only after create/rotate.
- Reviewed, committed, pushed, deployed, and dev-smoked the dev admin token management surface on `dev`.
- Created fresh private dev owner, OBS overlay, and control-panel URLs; stored them in ignored `reports/usable-urls.md` with local `0600` permissions.
- Confirmed owner-gated token listing works with the dev owner bearer, generated overlay/control tokens validate with the expected `requiresLogin` values, and a revoked smoke token stops validating through `/access/url-token/validate`.
- Ran the Chunk 12 visual QA fallback with headless Chrome because Computer Use was not exposed in this thread.
- Captured `/tools/actions`, token-blocked control panel, dev-authenticated control panel, scene designer, overlay-ready, overlay chat, and overlay chat visibility screenshots at the requested stream-monitor sizes under `reports/visual-qa/chunk-12/`.
- Confirmed the tested standalone surfaces have no normal website navbar and no horizontal overflow at 1920x1080, 1600x900, or 1366x768; fake/local chat newest-on-top and chat visibility toggles worked through the live dev API.
- Reviewed, committed, deployed, and dev-smoked the manual project-admin preview-before-publish slice with a typed public-preview projection, draft/unpublished admin preview UI, and focused domain coverage while leaving public project routes filtered to published/visible content only.
- Completed Chunk 14 as a design-only stream focus/project-link planning slice after hitting the schema gate: `stream_schedule_entries` cannot store a project link or active focus today, and the older `stream_sessions.active_project_id` is not wired into the manual schedule/admin/public flow.
- Defined the smallest manual workflow for the next approved slice: owner selects an existing public project while editing a scheduled stream, optionally adds short non-monetary focus copy, and public `/schedule` shows a modest "Stream focus" link for public projects only.
- Proposed the generated-migration scope for coordinator approval: add nullable `project_id`, nullable `focus_label`, and nullable `focus_note` fields to `stream_schedule_entries`, plus an index on `project_id`; no provider sync, announcements, recurrence automation, notifications, AI, moderation, auth changes, secrets, Cloudflare/Docker/deploy changes, or money behavior.
- Implemented Chunk 14A against the approved scope: generated migration `packages/database/drizzle/0010_lonely_whistler.sql`, added manual focus fields to schedule domain/API/admin/public flow, and kept public focus output gated to public/visible linked projects.
- Reviewed, committed, pushed, migrated, deployed, and dev-smoked Chunk 14A on `dev` commit `6cc3c0c`; `/admin/schedule` returned project options, owner PATCH saved focus fields, public `/schedule` rendered the focus label, project link, and focus note.
- Completed Chunk 15 as a design-only safety-gates review: auth/owner assignment, moderation, AI public output, money/ledger/credits/refunds, backups, and provider integrations are now explicit future gates with safe first-slice boundaries.
- Implemented Chunk 16A against the approved schema scope: generated unapplied migration `packages/database/drizzle/0011_mean_doctor_strange.sql`, added typed project update read/admin rules, owner/project-admin API create/edit/publish-state behavior, `/admin/projects` manual update controls, and public project detail rendering for published visible updates only.
- Kept AI drafting, support links, money, provider notifications/sync, moderation, auth, secrets, Cloudflare/Docker/deploy changes, migration application, commits, pushes, and deploys out of the project updates slice.
- Reviewed, committed, pushed, migrated, deployed, and dev-smoked Chunk 16A on `dev` commit `dce7989`; owner admin create/publish worked, public API hid the draft before publish, and public project detail rendered the published update.
- Added the first dev-only `/dev/test-console` foundation as a local preview surface over `@maiks-yt/domain/events`: source selection, event-kind filtering, safety/default badges, impossible-combo prevention, and mock display data generation.
- Kept the test console local-preview only: no real dispatch, durable routing rules, event history, approval queues, opt-out storage, cooldown state, provider credentials, real money behavior, simulated-money persistence, auth changes, migrations, deploy changes, or server state.
- Reviewed, committed, pushed, deployed, and dev-smoked the `/dev/test-console` preview foundation on commit `c92e589`; `web-dev` returned 200 and rendered the local-preview, source selector, mock display data, and simulated-money markers.
- Completed the design-only Event Routing Admin persistence gate: real routing/dispatch should wait for a coordinator-approved generated migration covering durable routing rules, user opt-outs, event history/audit, approval queue, cooldown state, and simulated/test reset boundaries.
- Defined the first safe implementation slice after schema approval as manual/provider-neutral routing-rule admin plus safe simulated/test dispatch only. Real provider integrations, real money, moderation enforcement, auth changes, secrets, Cloudflare/Docker/deploy config, migration generation/application, and production behavior stayed out of scope.
- Generated and dev-applied the approved Event Routing persistence migration `packages/database/drizzle/0012_smooth_jack_flag.sql`: routing rules, stream-visible website opt-outs, append-only event history/audit, approval queue state, cooldown state, and simulated/test reset flags are now represented in the dev database schema only.
- Completed the design-only Page Creator and Route Admin gate: first version should be owner-gated, path-only, preview-before-publish, and limited to normal website pages while code-owned/admin/tool/API/overlay/dev routes remain reserved.
- Ran a fresh Dev Stream Tools visual QA fallback after Browser setup failed and Computer Use was unavailable: captured `/tools/actions`, token-missing control panel, authenticated control panel, scene designer section, overlay ready state, and `/dev/test-console` at 1920x1080, 1600x900, and 1366x768 under `reports/visual-qa/chunk-19-stream-tools/`.
- Added the design-only production readiness / dev-to-main checklist covering release branch policy, explicit owners, fresh production secrets/OAuth keys, no first-login auto-promotion, migration order, backup/restore basics, smoke surfaces, rollback decision points, dev-only exclusions, and dangerous production gates.
- Kept Event Routing behavior disabled and kept production release work closed: no runtime routing UI/API, dispatch, provider integrations, real money behavior, moderation enforcement, auth changes, secrets, Cloudflare/Docker/deploy config, production deployment, production migration application, or server state changes were made.
- Added, committed, pushed, deployed, and dev-smoked the first runtime-safe Event Routing admin foundation with typed domain routing-rule validation, owner-gated manual list/update API behavior, and `/admin/event-routing` rule editing against the applied persistence schema.
- Kept Event Routing dispatch disabled in Chunk 21A: no real provider intake, simulated dispatch, event history writes, cooldown evaluation, moderation enforcement, real money behavior, auth changes, migrations, deploy config, or production behavior was added.
- Dev smoke confirmed unauthenticated API access returns `401 not_authenticated`, owner-auth rule listing returns 25 registry-backed rules, `/admin/event-routing` returns `200`, and a disabled internal-audit `website.signup:any` rule can be saved safely.
- Reviewed and accepted Chunk 21B worker output locally: `/dev/test-console` can call a dev-only `/dev/event-routing/dispatch` endpoint that rejects real provider dispatch, real website production dispatch, and real money; writes only test/simulated/resettable event history; queues approval-required simulated events without public playback; and records cooldown state only for safe simulated outcomes.
- Reviewed and accepted Chunk 23 worker output locally: generated migration `packages/database/drizzle/0013_lowly_justin_hammer.sql` for `content_pages` persistence with draft/hidden defaults, normalized path uniqueness, primary-only route scope, SEO/body fields, audit timestamps, and checks that prevent public drafts and require `published_at` for published pages.
- Committed and pushed dev commit `dfc394b`, pulled it on `codex-server-1`, rebuilt shared packages in `maiks-yt-dev`, applied dev migration `0013_lowly_justin_hammer.sql`, and smoke-tested `https://api-dev.maiks.yt/dev/event-routing/dispatch` with a safe `test/system` simulated event. The API wrote a test/simulated/resettable, non-real-money history row and returned `publicPlayback: false`.
- During public dev smoke, `https://web-dev.maiks.yt/` and `/dev/test-console` again included the suspicious BSC/eval injection script. Direct in-container app output from `http://127.0.0.1:3000/` did not include the script, and a read-only Cloudflare check found Worker route `*maiks.yt/*` pointing to `worker-winter-bird-f0bf`, matching the previous Cloudflare-side injection pattern. Cloudflare config has not been changed yet in this pass.
- Added, committed, pushed, migrated, deployed, and dev-smoked the first private notification panel slice for dev/system alerts on commits `85ba272` and `6a074de`: generated migration `packages/database/drizzle/0014_first_onslaught.sql`, added typed notification validation, owner-gated `/admin/notifications` API list/read/archive behavior, dev-secret `/dev/notifications` creation for watchdog/smoke alerts, and standalone `/tools/notifications` polling UI with manifest shortcut metadata.
- Added `DEV_NOTIFICATION_POST_SECRET`, `WEB_PUSH_CONTACT`, `WEB_PUSH_VAPID_PRIVATE_KEY`, and `WEB_PUSH_VAPID_PUBLIC_KEY` to the Turborepo dev-task env allowlist after smoke showed the app process could not see the container-level secret.
- Dev smoke created a warning notification through `/dev/notifications`, verified unauthenticated admin access returns `401`, verified owner listing sees the smoke row, marked it read, archived it, and confirmed public `/tools/notifications` returns `200` without the normal website navbar or known injection markers.
- Kept Web Push delivery, service-worker notification handling, push subscription persistence, 4-times-a-day automation wiring, production alerting, provider alerts, moderation alerts, and money alerts out of this slice.
- Added, committed, pushed, migrated, deployed, and dev-smoked the Web Push notification delivery slice on commit `d295840`: push subscription persistence migration `0015_next_raza.sql`, owner-gated push config/subscribe/revoke endpoints, `web-push` delivery for warning/critical notifications, a notification-only service worker with no fetch/cache handler, and `/tools/notifications` subscribe/unsubscribe/status/test controls.
- Dev smoke confirmed push config is enabled with a public key, `notification-service-worker.js` returns `200`, `/tools/notifications` returns `200` with no normal navbar or known injection markers, a warning notification can still be created through `/dev/notifications`, owner API listing sees the row, and a dummy HTTPS push subscription can be created and immediately revoked.
- Owner-device Web Push smoke is verified: the dev database had one active subscription without errors, sending `Owner-device push smoke` through `/dev/notifications` updated `last_push_at`, and Michael confirmed notifications are received on the installed app/browser path.
- Added, committed, pushed, deployed, and smoke-tested Chunk 27 on commits `d9f805c` and `41b1859`: `pnpm dev:smoke:notify` now checks API health, database health, web home/injection markers, `/tools/notifications`, the notification service worker, `overlay-dev`, and `control-dev`, then posts warning/critical notifications through `DEV_NOTIFICATION_POST_SECRET`.
- Verified the recurring runner inside the dev container with a healthy dry run, a synthetic failed control-panel check that created one warning alert, duplicate suppression for the same failure signature, and a recovery note after the synthetic failure cleared.
- Installed the recurring schedule through Michael's user crontab on `codex-server-1` for `07:00`, `12:00`, `17:00`, and `22:00` Europe/Amsterdam time so each run lines up with a fresh five-hour work window. A user systemd timer was tested and then disabled because `loginctl enable-linger michael` requires sudo/password on the server; cron is active and does not depend on user-systemd lingering.
- Added, committed, pushed, deployed, and dev-smoked the Phase 2 Page Creator runtime slice on commit `690eb93`: owner-gated `/admin/pages`, domain/API reserved-route validation, Markdown draft editing, owner preview endpoint, preview-before-publish UI gate, publish/unpublish controls, and public exact-path rendering through the new catch-all route for published visible non-reserved page records.
- Dev smoke created a temporary Page Creator draft, confirmed draft public reads return `404`, loaded owner preview, published it, confirmed public API and `web-dev` render the page, confirmed `/admin/...` path creation is blocked, then unpublished it and confirmed public reads return `404` again. Existing code-owned routes `/privacy/analytics`, `/projects`, and `/tools/notifications` still returned `200`.
- Added, committed, pushed, deployed, and dev-smoked the Phase 3 stream-visibility consent slice on commit `9545b19`: domain preference rules for stream-visible website events, current-user `GET/PUT /account/stream-visibility-preferences`, `/account` UI controls for global and per-event opt-outs, and `/dev/test-console` signed-in user attachment for safe simulated website dispatch.
- Dev smoke confirmed the preference API returns five scopes for the dev owner, unauthenticated access returns `401`, account and test console pages return `200`, an allowed simulated `website.signup` event can route when the smoke rule is enabled, the global opt-out changes the same event to `blocked_opt_out`, and missing identity changes it to `blocked_safety`. The smoke restored the previous preference snapshot and event-routing rule afterward.

## Current Task

Choose the next follow-up: Event Routing playback, community operations, or another bounded feature lane.

## Next Tasks

1. Creator Hub support destination remains available after Michael creates or approves it.
2. If strict installed-window QA is required, rerun the stream-tool visual pass with Computer Use or a real installed PWA window when that tool/session is available.
3. Phase 3 stream-visibility consent is live on dev; future real website dispatch still needs production-safe intake, event templates, cooldown/approval review, and overlay/control playback before any public stream output.
4. Phase 2 Page Creator runtime is live on dev; future page work can add delete/archive, richer blocks, route migration of selected code-owned pages, or later host/subdomain routing only after separate review.
5. Before any future `dev` to `main` or production release, use `reports/production-readiness-checklist.md` as the design gate and record release ownership, migration order, backup restore verification, smoke surfaces, rollback decision points, and accepted unresolved risks.

## Known State

- GPT-5.5 is the default model for implementation and review agents.
- Creator Hub link foundations are current through the latest reviewed dev/main commit.
- The first Creator Hub link admin worker stopped correctly: current links are a compiled TypeScript array, so runtime admin editing needs a database-backed link model first.
- Creator Links Chunk 3A is implemented, reviewed, committed, migrated on dev, seeded, deployed, and dev-smoked.
- Creator Links Chunk 3B is implemented, reviewed, committed, deployed, dev-smoked, and accepted by Michael as usable enough to move on.
- Manual project-admin tools are implemented, reviewed, committed, deployed to dev, and dev-smoked.
- Action Panel Task 1 domain contracts are complete and reviewed.
- Action Panel Task 2 persistence and migration are complete and reviewed.
- Action Panel Task 3 authorized API is complete and reviewed.
- Action Panel Task 4 authenticated UI is complete and reviewed.
- Projects Chunk 1 is implemented and coordinator-reviewed as a read-only public slice.
- Local work normally happens on the `dev` branch, then reviewed work is deployed to the dev server for testing.
- Dev services run on `codex-server-1` in container `maiks-yt-dev`.
- Public dev surfaces use `web-dev`, `api-dev`, `overlay-dev`, and `control-dev` under `maiks.yt`.
- WebSocket is the primary realtime transport; SSE remains a fallback option.
- The next worker prompts and reviewer gates are in `reports/next-agent-tasks.md`.
- Next agents should use larger vertical chunks to reduce repeated context and check overhead.
- Stream Scheduling Chunk 8 is implemented, coordinator-reviewed, committed, mirrored to `dev`, migrated, seeded, deployed, and dev-smoked at public API/web level.
- Stream Tools Chunk 9 endpoint/token QA is complete; visual installed-window QA remains open.
- Chunk 10 queue review is complete and the proposed larger next chunks are recorded in `reports/next-agent-tasks.md`.
- Chunk 11 admin token management is implemented, coordinator-reviewed, committed, pushed to `dev`, deployed, and dev-smoked.
- Chunk 12 visual QA has a completed headless Chrome fallback with screenshots and summaries, but not a true Computer Use / installed-window pass.
- Chunk 14 stream focus/project-link planning is complete as a design-only stop at the migration gate; no code implementation was made because the current public schedule schema cannot persist the link/focus safely.
- Chunk 14A manual schedule focus implementation is reviewed, committed, pushed to `dev`, migrated on dev, deployed, and dev-smoked. The dev DB intentionally has the public "Maiks.yt V2 build stream" linked to "Build Maiks.yt V2" with short focus copy so `/schedule` visibly exercises the feature.
- Chunk 15 safety-gates review is complete as a docs-only planning slice. It did not implement risky features, change auth, edit secrets, generate/apply migrations, or deploy.
- Chunk 16A project updates implementation is reviewed, committed, pushed to `dev`, migrated on dev, deployed, and dev-smoked. The dev DB intentionally has a published "Dev smoke project update" on the Maiks.yt V2 project so `/projects/maiks-yt-v2` visibly exercises the feature.

## Blockers And Decisions

- Creator Hub support destination still needs to be created or approved.
- The previous public `web-dev` Cloudflare-side injection blocker was resolved by Michael removing the malicious Worker route. Public smoke after removal returned clean 200s for `web-dev`, `/dev/test-console`, and `api-dev/health`.
- Lost OBS/control tokens now have a dev-first admin-token management implementation, and fresh usable dev URLs are available in ignored `reports/usable-urls.md`.
- Chat overlay behavior has fake/local test input, streamer-only fake/local viewing, and a chat order toggle now; browser/OBS verification still needs a valid control/overlay token pair. Real Twitch/YouTube chat remains open.
- Reject and defer notes default to optional with a 1,000-character limit.
- Production owner-account mapping must be explicit; never auto-promote the first login.
- Dev owner claims require `DEV_OWNER_EMAILS`; production owner assignment still needs an explicit admin process later.
- Production OAuth keys and other clean secrets will be created near final release.
- Full PWA installability is partially started: `/tools/actions` has verified manifest/installability metadata and no normal website navbar, the existing control panel has same-origin install metadata, and `/tools/notifications` now has a first private polling panel. Separate streamer chat installability, Web Push delivery/service-worker strategy, and visual installed-window QA remain open.
- Streamer chat has a fake/local-only control-panel viewing surface and order toggle; real Twitch/YouTube chat, moderation, ranks, profiles, bot commands, AI reading, and separate installability remain deferred.
- Control-panel service-worker work remains deferred; private stream-tool data must stay network-only until a reviewed static-assets-only strategy exists.
- Manual admin pages should exist before AI-assisted publishing or content generation can modify public content.
- Page Creator and Route Admin has a deployed first runtime implementation over `content_pages`: path-only on the primary website host, manual owner admin, Markdown body editing, preview-before-publish, reserved-route blocking, and public rendering for published visible exact-path records. Host/subdomain plus Cloudflare automation remains deferred to a later infrastructure/security-reviewed phase.
- Project admin now has reviewed/deployed preview-before-publish for project basics plus saved milestones/items; manual project updates still need a separate schema-approved slice if they require new tables.
- Stream focus/project linking needs an explicitly approved generated migration before implementation. Do not overload `topic_key`, `theme_key`, or disconnected `stream_sessions.active_project_id` to represent a public schedule focus.
- Chunk 14A generated and applied the approved nullable schedule focus migration on dev. Production/main still needs the normal migration/deploy decision later.
- The typed event registry is an in-code domain foundation only. Durable routing rules, event history, per-user opt-outs, cooldown state, provider credentials, moderation enforcement, and money/simulation persistence still require future schema-gated work.
- Chunk 17 no-schema typed event registry is coordinator-reviewed with passing domain checks and architecture validation; it is safe as a domain-only foundation for future routing/test-console work.
- The first dev test console foundation is reviewed, committed, pushed, deployed to dev, and dev-smoked. It is guarded to 404 under `NODE_ENV=production`, uses the typed event registry directly, and remains local-preview only. Future real dispatch/routing/history/opt-out/cooldown/simulated-money behavior remains schema-gated.
- Event Routing Admin now has a design-only persistence gate. The likely generated migration should add routing rules per event kind/source, destination settings, enabled/live-only/offline-only flags, approval-required and cooldown fields, user opt-outs for stream-visible website events, event history/audit, approval queue, cooldown state, and a dev-only simulated/test reset boundary. Migration is required before implementation.
- Chunk 20 generated and dev-applied Event Routing persistence migration `0012_smooth_jack_flag.sql`. It uses `event_routing_rules`, `event_user_opt_outs`, `event_history`, `event_approval_queue`, and `event_cooldown_state`; destination values are constrained to ignore/internal audit/control panel/top notification/center notification/streamer feed/streamer chat/approval queue.
- Page Creator and Route Admin uses generated migration `0013_lowly_justin_hammer.sql` for `content_pages` plus deployed runtime admin/public routing. The dev smoke left a temporary Phase 2 smoke page as an unpublished draft record so the admin list visibly exercises draft state.
- Website signup/name/avatar overlay eligibility now has a user-facing opt-out foundation and safe simulated dispatch enforcement. Real website dispatch, templates, approval/cooldown processing, and overlay/control playback remain future gates. Privacy/security/account/provider-token events stay internal-only. Free website TTS remains later promotional scope. Simulated money remains dev/test-only and separate from real money.
- Chunk 21A is reviewed, committed, pushed, deployed, and dev-smoked. Phase 3 now adds user-facing stream visibility preferences and safe simulated dispatch opt-out enforcement; future real routing still needs production-safe intake, event templates, approval/cooldown processing, and overlay/control playback.
- Do not begin full chat, AI, moderation, money, provider integration, backup automation, or production auth phases until the relevant phase gate is explicitly opened and scoped.
- Production readiness is now documented in `reports/production-readiness-checklist.md`, but it is only a future release gate. Production/main deployment, Cloudflare/Docker/deployment config edits, production secret/OAuth rotation, production migration application, and server changes remain out of scope until Michael opens a release-preparation task.
- Production owner-account mapping must stay explicit; the first production login must never become owner/admin automatically.
- Fresh production OAuth credentials, URL-token gates, backup/restore verification, and rollback signoff are blockers before production/main release work can proceed.
- First safe slices after this point should be manual/non-provider work: support-link wording decision, backup/restore runbook design, user-facing stream-visibility opt-out UX, Event Routing playback review, or read-only/provider-neutral planning.
- Chunk 16A generated and applied `0011_mean_doctor_strange.sql` on dev. Production/main still needs the normal migration/deploy decision later.
- Chrome/in-app browser visual QA remains blocked in this setup, most recently by `privileged native pipe bridge is not available; browser-client is not trusted`, and Computer Use was not exposed in the 2026-06-22 worker thread. Headless Chromium fallback covered rendered layout at the target sizes; true installed-window verification remains manual/tool-dependent.

## Working Tree

The reviewer must run `git status --short` before assigning work. This file does not override the actual working tree.
