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

## Current Task

Verify the shared master overlay's scene switching and hidden-source lifecycle in real OBS.

## Next Tasks

1. Run the remaining real OBS scene-switching check.
2. Add approved social, support, and community destinations to the centralized Creator Hub links.
3. Add action-panel permission and audit-history foundations.
4. Run the full project checks and refresh the roadmap/checklist.

## Known State

- GPT-5.5 is the default model for implementation and review agents.
- Latest completed overlay verification commit: `8f9a206`.
- Local and dev-server workflows use `main` mirrored to `dev`.
- Dev services run on `codex-server-1` in container `maiks-yt-dev`.
- Public dev surfaces use `web-dev`, `api-dev`, `overlay-dev`, and `control-dev` under `maiks.yt`.
- WebSocket is the primary realtime transport; SSE remains a fallback option.

## Blockers And Decisions

- OBS must verify one shared browser source with shutdown-when-hidden disabled does not show blank or stale frames during scene switches.
- Creator Hub destination links still need Michael's approved Twitch, YouTube, Discord/community, and optional support URLs.
- Production OAuth keys and other clean secrets will be created near final release.
- Do not begin projects, scheduling, chat, AI, moderation, PWA, money, or backup feature phases until the current partial-area pass is reviewed.

## Working Tree

The reviewer must run `git status --short` before assigning work. This file does not override the actual working tree.
