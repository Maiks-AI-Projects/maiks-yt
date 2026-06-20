# Current Work

Updated: 2026-06-21

## Objective

Finish the partially completed project areas before starting untouched feature groups.

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

## Current Task

Decide whether the headless Chrome visual QA fallback is enough for now, or keep waiting for true Computer Use / installed-window QA.

## Next Tasks

1. If strict installed-window QA is required, rerun Chunk 12 with Computer Use or a real installed PWA window when that tool/session is available.
2. Otherwise, move to the next implementation chunk: manual content publishing polish, or Creator Hub support destination after Michael creates or approves it.
3. Keep real Twitch/YouTube chat, moderation, AI, money, and production auth/token architecture gated until explicitly assigned.

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

## Blockers And Decisions

- Creator Hub support destination still needs to be created or approved.
- Lost OBS/control tokens now have a dev-first admin-token management implementation, and fresh usable dev URLs are available in ignored `reports/usable-urls.md`.
- Chat overlay behavior has fake/local test input, streamer-only fake/local viewing, and a chat order toggle now; browser/OBS verification still needs a valid control/overlay token pair. Real Twitch/YouTube chat remains open.
- Reject and defer notes default to optional with a 1,000-character limit.
- Production owner-account mapping must be explicit; never auto-promote the first login.
- Dev owner claims require `DEV_OWNER_EMAILS`; production owner assignment still needs an explicit admin process later.
- Production OAuth keys and other clean secrets will be created near final release.
- Full PWA installability is partially started: `/tools/actions` has verified manifest/installability metadata and no normal website navbar, and the existing control panel now has same-origin install metadata. Separate streamer chat installability, notifications, service-worker strategy, and visual installed-window QA remain open.
- Streamer chat has a fake/local-only control-panel viewing surface and order toggle; real Twitch/YouTube chat, moderation, ranks, profiles, bot commands, AI reading, and separate installability remain deferred.
- Control-panel service-worker work remains deferred; private stream-tool data must stay network-only until a reviewed static-assets-only strategy exists.
- Manual admin pages should exist before AI-assisted publishing or content generation can modify public content.
- Do not begin full chat, AI, moderation, money, or backup feature phases until the current partial-area pass is reviewed.
- Chrome/in-app browser visual QA is blocked in this setup by a Windows sandbox attach failure, and Computer Use was not exposed in the 2026-06-21 thread. Headless Chrome fallback covered rendered layout at the target sizes; true installed-window verification remains manual/tool-dependent.

## Working Tree

The reviewer must run `git status --short` before assigning work. This file does not override the actual working tree.
