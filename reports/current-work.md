# Current Work

Updated: 2026-06-18

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

## Current Task

Review the streamer chat foundation first slice and then continue with the next bounded stream-tools task.

## Next Tasks

1. Review and deploy-smoke the streamer-only fake/local chat viewer with a valid control/overlay token pair.
2. Verify overlay chat visibility and bot/system hiding still hold during fake/local chat smoke.
3. Add the remaining Creator Hub support destination after Michael creates or approves it.

## Known State

- GPT-5.5 is the default model for implementation and review agents.
- Creator Hub link foundations are current through the latest reviewed main commit.
- The first Creator Hub link admin worker stopped correctly: current links are a compiled TypeScript array, so runtime admin editing needs a database-backed link model first.
- Creator Links Chunk 3A is implemented, reviewed, committed, migrated on dev, seeded, deployed, and dev-smoked.
- Creator Links Chunk 3B is implemented, reviewed, committed, deployed, dev-smoked, and accepted by Michael as usable enough to move on.
- Manual project-admin tools are implemented, reviewed, committed, deployed to dev, and dev-smoked.
- Action Panel Task 1 domain contracts are complete and reviewed.
- Action Panel Task 2 persistence and migration are complete and reviewed.
- Action Panel Task 3 authorized API is complete and reviewed.
- Action Panel Task 4 authenticated UI is complete and reviewed.
- Projects Chunk 1 is implemented and coordinator-reviewed as a read-only public slice.
- Local and dev-server workflows use `main` mirrored to `dev`.
- Dev services run on `codex-server-1` in container `maiks-yt-dev`.
- Public dev surfaces use `web-dev`, `api-dev`, `overlay-dev`, and `control-dev` under `maiks.yt`.
- WebSocket is the primary realtime transport; SSE remains a fallback option.
- The next worker prompts and reviewer gates are in `reports/next-agent-tasks.md`.
- Next agents should use larger vertical chunks to reduce repeated context and check overhead.

## Blockers And Decisions

- Creator Hub support destination still needs to be created or approved.
- Chat overlay behavior has fake/local test input now; the fake chat endpoint is present and rejects dummy valid-length tokens with `token_not_found`, but browser/OBS verification still needs a valid control/overlay token pair. Real Twitch/YouTube chat remains open.
- Reject and defer notes default to optional with a 1,000-character limit.
- Production owner-account mapping must be explicit; never auto-promote the first login.
- Dev owner claims require `DEV_OWNER_EMAILS`; production owner assignment still needs an explicit admin process later.
- Production OAuth keys and other clean secrets will be created near final release.
- Full PWA installability is partially started: `/tools/actions` has verified manifest/installability metadata and no normal website navbar, and the existing control panel now has same-origin install metadata. Streamer chat, notifications, service-worker strategy, and installed-window QA remain open.
- Streamer chat has a fake/local-only control-panel viewing surface; real Twitch/YouTube chat, moderation, ranks, profiles, bot commands, AI reading, and installability remain deferred.
- Control-panel service-worker work remains deferred; private stream-tool data must stay network-only until a reviewed static-assets-only strategy exists.
- Manual admin pages should exist before AI-assisted publishing or content generation can modify public content.
- Do not begin scheduling, full chat, AI, moderation, money, or backup feature phases until the current partial-area pass is reviewed.

## Working Tree

The reviewer must run `git status --short` before assigning work. This file does not override the actual working tree.
