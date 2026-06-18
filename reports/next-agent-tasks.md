# Next Agent Tasks

Updated: 2026-06-18

Use larger vertical chunks from here. The goal is fewer agent handoffs and fewer repeated checks, while still keeping high-risk areas bounded.

The coordinator reviews, tests, commits, pushes, mirrors `main` to `dev`, applies any approved dev-only seed/migration step, and verifies public dev after each accepted chunk.

## Current Blocked/Manual Items

- Creator Hub support destination is blocked until Michael creates or approves the support URL and wording.
- Creator Hub link admin should use the database-backed Creator Links foundation from Chunk 3A; static TypeScript source-file editing is not acceptable for runtime admin edits.
- Chat overlay behavior still needs verification with live or test chat input.
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

## Chunk 6: Control Panel Installability Slice (Implemented, Needs Review)

Model: GPT-5.5

Implemented locally and awaiting coordinator review. The control panel remains in `apps/control-panel`, has same-origin PWA metadata, keeps the existing `control-panel` URL-token gate, and does not register a service worker.

Reviewer notes:

- Verify `https://control-dev.maiks.yt/manifest.webmanifest` returns control-panel manifest metadata after deployment.
- Verify missing/invalid control tokens still block access.
- Confirm no private API response caching or broad service-worker scope was introduced; this slice intentionally has no service worker.
- If a valid token pair is available, browser-smoke fake chat from control panel to overlay; otherwise keep that as an explicit manual item.
- Installed-window QA should cover 1920x1080, 1600x900, and 1366x768 stream-monitor sizes.

Do not rerun this chunk unless the coordinator explicitly asks for fixes.

Original prompt:

Prompt:

```text
Read AGENTS.md, reports/current-work.md, reports/next-agent-tasks.md, TODO.md sections 7, 11, and 14A, and ideas/installable-pwa-control-surfaces.md.

Task:
Make the existing control panel installable as a stream-tool PWA surface, building on the verified `/tools/actions` manifest foundation.

You may edit:
- apps/control-panel/src/
- apps/control-panel/index.html
- apps/control-panel/vite.config.ts only if needed for metadata/build output
- apps/web/src/app/manifest.webmanifest/route.ts
- apps/web/src/app/tools/
- public icon/static assets only if they are simple generated placeholders and safe for all stream tools
- ideas/installable-pwa-control-surfaces.md
- TODO.md
- reports/current-work.md
- reports/next-agent-tasks.md

Acceptance criteria:
- Add installability metadata for the control panel without weakening `control-panel` token access.
- Keep the existing control token storage/gate behavior; do not add login, account, OAuth, or admin changes.
- Keep private API/chat/moderation/account/action-panel/admin/money data out of service-worker or offline caches.
- If a service worker is introduced, it must be static-assets-only, narrowly scoped, and explicitly documented; otherwise document why service-worker work remains deferred.
- Preserve the current fake/local chat sender and overlay visibility controls.
- Add a small installability/manual QA note for stream-monitor window sizes and what must be checked after deployment.
- Do not add streamer chat, notifications panel, moderation, live Twitch/YouTube chat, AI reading, or money behavior.

Verification:
- corepack pnpm --filter @maiks-yt/control-panel typecheck
- corepack pnpm --filter @maiks-yt/control-panel build
- corepack pnpm --filter @maiks-yt/web typecheck
- corepack pnpm --filter @maiks-yt/web build
- node scripts/check-architecture.mjs

Browser/manual smoke if practical:
- Open the local or dev control panel with a valid control token and confirm installability metadata is present.
- Confirm missing/invalid tokens still block access.
- Confirm the control panel can still send fake chat when paired with a valid overlay token, or document the exact blocker.

Do not commit, push, deploy, apply migrations, or edit files outside the allowed scope.
Report changed files, checks run, skipped browser/manual checks, and unresolved concerns.
```

Reviewer gate:

- Verify control-panel installability metadata on dev.
- Verify invalid/dummy control tokens are still rejected.
- Confirm no private API response caching or broad service-worker scope was introduced.
- If a valid token pair is available, browser-smoke fake chat from control panel to overlay; otherwise keep that as an explicit manual item.

## Chunk 7: Streamer Chat Foundation Planning/First Slice (Implemented, Needs Review)

Model: GPT-5.5

Implemented locally after Michael explicitly prioritized streamer chat first.

Reviewer notes:

- The streamer chat surface is fake/local-only and lives inside the existing token-gated control panel.
- `GET /streamer-chat/messages` returns the in-memory fake/local history for control tokens.
- `WS /streamer-chat/live` sends a snapshot and new fake/local messages to streamer chat viewers.
- Overlay still receives the existing fake chat event and keeps its human-only, visible-slot rendering rules.
- No real Twitch/YouTube chat, moderation, bans, mutes, ranks, profiles, stream bot commands, AI reading, money, auth, secrets, deploy, or migration work was added.

Do not rerun this chunk unless the coordinator explicitly asks for fixes.

Prompt:

```text
Read AGENTS.md, reports/current-work.md, reports/next-agent-tasks.md, TODO.md section 11, and only the existing overlay/control-panel/API realtime files needed.

Task:
Prepare the first streamer-only chat foundation on top of the fake/local harness. This is not live Twitch/YouTube chat yet.

You may edit:
- packages/events/src/
- packages/events/test/
- apps/api/src/main.ts only for narrowly scoped chat foundation endpoints/events
- apps/control-panel/src/
- apps/overlay/src/
- TODO.md
- reports/current-work.md
- reports/next-agent-tasks.md

Acceptance criteria:
- Keep the fake/local source as the only message source.
- Add the smallest streamer-only chat viewing surface needed to inspect fake/local messages.
- Preserve overlay rendering rules: chat slot visibility is respected and bot/system messages stay hidden from overlay by default.
- Keep moderation, bans, mutes, ranks, user profiles, AI reading, stream bot commands, and real Twitch/YouTube chat out of scope.
- Add focused event/API/UI tests where practical.

Verification:
- corepack pnpm --filter @maiks-yt/events test
- corepack pnpm --filter @maiks-yt/events typecheck
- corepack pnpm --filter @maiks-yt/api typecheck
- corepack pnpm --filter @maiks-yt/control-panel typecheck
- corepack pnpm --filter @maiks-yt/overlay typecheck
- node scripts/check-architecture.mjs

Browser/manual smoke if practical:
- With a valid control/overlay token pair, send a fake human chat message and confirm streamer-only chat receives it.
- Confirm bot/system fake messages do not appear on the overlay by default.
- Confirm hidden chat slot does not render new fake messages on the overlay.

Do not commit, push, deploy, apply migrations, or edit files outside the allowed scope.
Report changed files, checks run, skipped browser/manual checks, and unresolved concerns.
```

Reviewer gate:

- Verify this remains a local/fake streamer-chat foundation, not a live platform chat integration.
- Verify overlay chat visibility and bot/system hiding with a valid token pair if available.

## Chunk 8: Next Queue Review

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
