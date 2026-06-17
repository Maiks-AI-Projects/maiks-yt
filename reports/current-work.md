# Current Work

Updated: 2026-06-17

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
- Verified the shared OBS browser source scene-switching behavior with shutdown-when-hidden disabled; chat overlay behavior remains unverified because live/test chat input was unavailable.
- Added approved Creator Hub Twitch, YouTube, and Discord/community destination links for the dev site.

## Current Task

Add the remaining Creator Hub support destination after Michael creates or approves it.

## Next Tasks

1. Add the remaining Creator Hub support destination after Michael creates or approves it.

## Known State

- GPT-5.5 is the default model for implementation and review agents.
- Creator Hub link foundations are current through the latest reviewed main commit.
- Action Panel Task 1 domain contracts are complete and reviewed.
- Action Panel Task 2 persistence and migration are complete and reviewed.
- Action Panel Task 3 authorized API is complete and reviewed.
- Action Panel Task 4 authenticated UI is complete and reviewed.
- Local and dev-server workflows use `main` mirrored to `dev`.
- Dev services run on `codex-server-1` in container `maiks-yt-dev`.
- Public dev surfaces use `web-dev`, `api-dev`, `overlay-dev`, and `control-dev` under `maiks.yt`.
- WebSocket is the primary realtime transport; SSE remains a fallback option.
- The next worker prompts and reviewer gates are in `reports/next-agent-tasks.md`.
- Next agents should use larger vertical chunks to reduce repeated context and check overhead.

## Blockers And Decisions

- Creator Hub support destination still needs to be created or approved.
- Chat overlay behavior still needs verification with live or test chat input.
- Reject and defer notes default to optional with a 1,000-character limit.
- Production owner-account mapping must be explicit; never auto-promote the first login.
- Dev owner claims require `DEV_OWNER_EMAILS`; production owner assignment still needs an explicit admin process later.
- Production OAuth keys and other clean secrets will be created near final release.
- Full PWA installability is not started yet; the route/app-shell foundation is in place for streamer tool surfaces.
- Do not begin projects, scheduling, chat, AI, moderation, money, or backup feature phases until the current partial-area pass is reviewed.

## Working Tree

The reviewer must run `git status --short` before assigning work. This file does not override the actual working tree.
