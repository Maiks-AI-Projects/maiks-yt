# Next Agent Tasks

Updated: 2026-06-19

Use larger vertical chunks from here. The goal is fewer agent handoffs and fewer repeated checks, while still keeping high-risk areas bounded.

The coordinator reviews, tests, commits, pushes, mirrors `main` to `dev`, applies any approved dev-only seed/migration step, and verifies public dev after each accepted chunk.

## Current Blocked/Manual Items

- Creator Hub support destination is blocked until Michael creates or approves the support URL and wording.
- Creator Hub link admin should use the database-backed Creator Links foundation from Chunk 3A; static TypeScript source-file editing is not acceptable for runtime admin edits.
- Chat overlay behavior has fake/local test input and a streamer-only fake/local viewer, but valid-token browser/OBS verification is still manual.
- Full AI-assisted content generation is deferred until manual admin workflows exist.

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
- corepack pnpm --filter @maiks-yt/domain test
- corepack pnpm --filter @maiks-yt/api test
- corepack pnpm --filter @maiks-yt/api typecheck
- corepack pnpm --filter @maiks-yt/web typecheck
- corepack pnpm --filter @maiks-yt/web build
- corepack pnpm --filter @maiks-yt/database typecheck
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

- The in-app browser failed to attach in this Windows sandbox with `CreateProcessAsUserW failed: 5`, and no local Playwright/Puppeteer dependency is installed. Visual installed-window checks at 1920x1080, 1600x900, and 1366x768 still need a browser-capable thread or manual pass.

Follow-up prompt for visual-only QA:

Prompt:

```text
Read AGENTS.md, reports/current-work.md, reports/next-agent-tasks.md, TODO.md section 14A, and ideas/installable-pwa-control-surfaces.md.

Task:
Do the remaining visual installed-window/browser QA pass for the installable stream tools and fake/local chat surfaces.

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
- Keep service workers, offline caches, real chat providers, moderation, AI, and money out of scope.

Verification:
- corepack pnpm --filter @maiks-yt/control-panel typecheck
- corepack pnpm --filter @maiks-yt/overlay typecheck
- corepack pnpm --filter @maiks-yt/web typecheck
- node scripts/check-architecture.mjs

Do not commit, push, deploy, apply migrations, or edit files outside the allowed scope.
Report changed files, checks run, skipped browser/manual checks, and unresolved concerns.
```

Reviewer gate:

- Review screenshots/notes for overlap and installability regressions.
- Verify any CSS/UI fixes are narrow and do not change auth/token behavior.

## Chunk 10: Next Queue Review

Model: GPT-5.5

Start after one or two chunks are completed.

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
