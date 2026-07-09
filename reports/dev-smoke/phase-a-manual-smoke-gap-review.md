# Phase A Dev Stabilization Manual Smoke Gap Review

Date: 2026-07-09

Scope: non-provider manual smoke gaps for `/chat`, `/moderation`, `/admin/connections`, `/admin/pages`, `/admin/projects`, `/tools/notifications`, and smoke notification behavior.

## Automated Smoke Coverage

- `scripts/dev-smoke-notify.mjs` checks `api-dev` health, database health, `web-dev` home, `/tools/notifications`, `notification-service-worker.js`, `overlay-dev`, and `control-dev` reachability, with known injection-marker scans on fetched text surfaces.
- This pass adds control-host reachability checks for `/chat` and `/moderation`, also with injection-marker scans. These are shell-level route checks only; they do not replace token-gated browser/manual interaction.
- `pnpm dev:visual-smoke` now captures headless-browser screenshots for key public, admin, overlay, chat, and moderation surfaces at 1366x768 and 1600x900 by default. It writes ignored local artifacts under `reports/visual-qa/current-dev-smoke/` and redacts private query tokens from `summary.json` and `README.md`.
- When a dev testing secret is available, the smoke runner mints a short-lived owner token and verifies `/admin/connections/intake/health` payload shape.
- When a dev testing secret is available, the smoke runner performs the existing read-only YouTube activities poll as a low-frequency provider-intake heartbeat. This is outside the non-provider manual gap list but already part of the current runner.
- Smoke notification behavior already covers warning/critical posting, duplicate suppression by failure signature, and optional recovery notes after a prior failure clears.

## Manual Smoke Gaps

- `/chat`: `pnpm dev:visual-smoke` can capture the fresh-browser access-required state with the URL token. Manual installed-window/browser smoke still needs a real signed-in session and should verify the standalone PWA scope, newest-first chat layout, service dots, token-blocked state, real private feed rendering, and that provider messages remain private and not overlay-routed by default.
- `/moderation`: `pnpm dev:visual-smoke` can capture the fresh-browser access-required state with the URL token. Manual installed-window/browser smoke still needs a valid control token plus a signed-in user with moderator/owner rights. Verify panel filtering, chat row actions, applied rules, retraction, pending approvals, live-helper summary, disabled-action copy, and emergency-clear gating.
- `/admin/connections`: automated smoke verifies the owner-gated intake-health payload shape, but manual owner UI smoke should still verify the catalog, intake rows, health cards, filters, redacted previews, and that no mutation/provider-write controls appear.
- `/admin/pages`: prior dev smoke covered draft creation, preview, publish, public read, reserved `/admin/...` path rejection, unpublish, and code-owned route availability. Remaining manual smoke is visual/editor ergonomics plus any richer block/delete/archive work after a future explicit scope.
- `/admin/projects`: prior dev smoke covered owner rendering, preview-before-publish, public filtering, create/publish/update behavior, and no private admin projects in public lists. Remaining manual smoke is dense-form ergonomics and regression checks after future schema-approved project-content slices.
- `/tools/notifications`: automated smoke checks route reachability, injection markers, absence of the normal website navbar, service-worker reachability, and notification delivery plumbing. Manual smoke remains owner-device browser/PWA behavior: subscribe/unsubscribe/status/test controls, actual notification receipt, and installed-window layout.
- Smoke notification behavior: dry-run and failure paths can be checked by the runner, but real cron timing, duplicate-cooldown behavior over time, and owner-device receipt of pushed failure/recovery notices remain operational/manual checks.

## Out Of Scope

- No provider writes, provider moderation, real money behavior, migrations, secret edits, Cloudflare/Docker config edits, deployments, commits, pushes, or production behavior were added.
- Headless-browser screenshot automation now exists through `pnpm dev:visual-smoke`; true installed-window/PWA screenshots remain manual because they require the real installed app/browser session.
