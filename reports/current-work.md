# Current Work

Updated: 2026-06-15

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

## Current Task

Replace the URL-demo Action Panel with the authenticated persistent UI while the real OBS check remains a parallel manual gate.

## Next Tasks

1. Write and run the finalized Task 4 prompt for the authenticated Action Panel UI.
2. Run the remaining real OBS scene-switching check in parallel.
3. Add Creator Hub destinations after Michael supplies approved URLs.

## Known State

- GPT-5.5 is the default model for implementation and review agents.
- Latest completed Creator Hub commit: `35d9122`.
- Action Panel Task 1 domain contracts are complete and reviewed.
- Action Panel Task 2 persistence and migration are complete and reviewed.
- Action Panel Task 3 authorized API is complete and reviewed.
- Local and dev-server workflows use `main` mirrored to `dev`.
- Dev services run on `codex-server-1` in container `maiks-yt-dev`.
- Public dev surfaces use `web-dev`, `api-dev`, `overlay-dev`, and `control-dev` under `maiks.yt`.
- WebSocket is the primary realtime transport; SSE remains a fallback option.
- The next worker prompts and reviewer gates are in `reports/next-agent-tasks.md`.

## Blockers And Decisions

- OBS must verify one shared browser source with shutdown-when-hidden disabled does not show blank or stale frames during scene switches.
- Creator Hub destination links still need Michael's approved Twitch, YouTube, Discord/community, and optional support URLs.
- Reject and defer notes default to optional with a 1,000-character limit.
- Production owner-account mapping must be explicit; never auto-promote the first login.
- Production OAuth keys and other clean secrets will be created near final release.
- Do not begin projects, scheduling, chat, AI, moderation, PWA, money, or backup feature phases until the current partial-area pass is reviewed.

## Working Tree

The reviewer must run `git status --short` before assigning work. This file does not override the actual working tree.
