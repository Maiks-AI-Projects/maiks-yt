# Next Agent Tasks

Updated: 2026-06-22

Use larger vertical chunks from here. The goal is fewer agent handoffs and fewer repeated checks, while still keeping high-risk areas bounded.

The coordinator reviews, tests, commits on `dev`, pushes `dev`, deploys to the dev server for testing, applies any approved dev-only seed/migration step, and verifies public dev after each accepted chunk.

## Current Blocked/Manual Items

- Creator Hub support destination is blocked until Michael creates or approves the support URL and wording.
- Creator Hub link admin should use the database-backed Creator Links foundation from Chunk 3A; static TypeScript source-file editing is not acceptable for runtime admin edits.
- Lost OBS/control tokens have a dev-first admin-token management worker implementation; coordinator review/deploy/owner smoke should create fresh usable URLs before the Computer Use installed-window pass.
- Chat overlay behavior has fake/local test input and a streamer-only fake/local viewer, but visual installed-window/browser verification is still manual.
- Chrome/in-app browser plugin visual QA is blocked in this setup; use Computer Use for the remaining visual installed-window pass.
- Full AI-assisted content generation is deferred until manual admin workflows exist.
- Event routing now has an in-code typed registry/capability matrix foundation, dev-applied persistence migration `0012_smooth_jack_flag.sql`, and a deployed/dev-smoked first manual/provider-neutral routing-rule admin foundation. Event history/audit writes, approval queue processing, opt-out enforcement, cooldown evaluation, and simulated/test reset behavior remain future implementation work. Provider credentials, moderation enforcement, and real money remain later gates.
- Page Creator and Route Admin now has a design-only persistence gate. The first safe implementation should be path-only manual pages on the primary website host; host/subdomain plus Cloudflare automation, production route behavior changes, AI auto-publishing, and money/legal final wording remain later gates.
- Production readiness now has a design-only dev-to-main checklist in `reports/production-readiness-checklist.md`. It is not deployment approval; production config edits, secret changes, migration application, deployments, and server state changes remain coordinator/release-owner work only.

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

## Chunk 21B: Safe Simulated Event Routing Dispatch (Proposed)

Assign only after Chunk 21A review succeeds.

Worker scope:

- Allow `/dev/test-console` to dispatch safe `test/system` or explicitly simulated events through the durable rule reader.
- Write only safe test/simulated history/routing results; every row must be marked `is_test` and/or `is_simulated`, `test_resettable`, and never `is_real_money`.
- Apply opt-out and cooldown checks in code before any stream-visible website-style simulated result.
- Queue approval-required simulated events without public playback.
- Keep real provider events, real website production events, real money, moderation enforcement, auth changes, secrets, Cloudflare/Docker/deploy config, commits, pushes, deployments, and migration application out of worker scope.

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

## Chunk 23: Page Creator Persistence Migration (Proposed, Requires Assignment)

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
