# Current Work

Updated: 2026-06-14

## Objective

Finish the partially completed project areas before starting untouched feature groups.

## Completed In This Pass

- Finished the localization foundation with English default and Dutch-ready helpers.
- Added an explicit telemetry allowlist and retention boundaries.
- Added the public analytics/privacy explanation page.
- Documented the first local production hosting shape.

## Current Task

Verify the overlay renderer and scene designer at OBS canvas sizes, then decide whether hidden overlays need to remain preloaded.

## Next Tasks

1. Finish overlay and layout verification.
2. Finish the existing Creator Hub/content gaps.
3. Add action-panel permission and audit-history foundations.
4. Run the full project checks and refresh the roadmap/checklist.

## Known State

- GPT-5.5 is the default model for implementation and review agents.
- Latest completed foundation commit: `3878f6e`.
- Local and dev-server workflows use `main` mirrored to `dev`.
- Dev services run on `codex-server-1` in container `maiks-yt-dev`.
- Public dev surfaces use `web-dev`, `api-dev`, `overlay-dev`, and `control-dev` under `maiks.yt`.
- WebSocket is the primary realtime transport; SSE remains a fallback option.

## Blockers And Decisions

- OBS scene-switching behavior still needs real OBS testing after browser-size verification.
- Production OAuth keys and other clean secrets will be created near final release.
- Do not begin projects, scheduling, chat, AI, moderation, PWA, money, or backup feature phases until the current partial-area pass is reviewed.

## Working Tree

The reviewer must run `git status --short` before assigning work. This file does not override the actual working tree.
