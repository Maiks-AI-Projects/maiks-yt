# Next Agent Tasks

Updated: 2026-06-17

Use larger vertical chunks from here. The goal is fewer agent handoffs and fewer repeated checks, while still keeping high-risk areas bounded.

The coordinator reviews, tests, commits, pushes, mirrors `main` to `dev`, applies any approved dev-only seed/migration step, and verifies public dev after each accepted chunk.

## Current Blocked/Manual Items

- Creator Hub support destination is blocked until Michael creates or approves the support URL and wording.
- Chat overlay behavior still needs verification with live or test chat input.
- Full AI-assisted content generation is deferred until manual admin workflows exist.

## Chunk 1: Read-Only Projects Vertical Slice (Completed)

The first read-only Projects and Milestones vertical slice is implemented, reviewed, committed, deployed, and seeded on dev.

Do not rerun this chunk unless the coordinator explicitly asks for fixes.

## Chunk 2: Manual Project Admin Vertical Slice

Model: GPT-5.5

Prompt:

```text
Read AGENTS.md, reports/current-work.md, reports/next-agent-tasks.md, TODO.md section 9A, TODO.md section 5, ideas/manual-admin-content-tools.md, and the existing project read-model/API/web files.

Task:
Build the first manual owner/admin project-management slice for non-money project content.

You may edit:
- packages/domain/src/projects/
- packages/domain/test/
- apps/api/src/projects/
- apps/api/test/projects/
- apps/web/src/app/admin/projects/
- apps/web/src/app/tools/projects/ only if adding a standalone admin-tool route wrapper
- apps/web/src/app/globals.css project/admin-specific styles
- apps/web/src/app/account/ only if linking to owner/admin tools is necessary
- TODO.md
- reports/current-work.md

Acceptance criteria:
- Add authenticated owner-only API mutations for non-money project content:
  - create/update project basics
  - set public/private visibility
  - create/update milestones
  - create/update non-monetary project items
  - simple reorder support for milestones/items if practical
- Reuse existing auth/session and role-permission patterns; do not invent a parallel auth system.
- Require owner wildcard or a clearly typed project-admin permission.
- Add manual admin web pages under `/admin/projects`.
- Admin pages should be efficient forms, not marketing pages.
- Include preview or clear visibility state before making content public.
- Keep money fields passive or absent; do not add donations, credits, ledgers, payouts, support CTAs, wishlist provider calls, store price tracking, or funding progress.
- Keep AI assistance out of this chunk except for documenting that it is deferred.
- Add focused domain/API tests for permission checks, validation, public/private behavior, and non-money mutation behavior.
- Update TODO/current-work only for things actually completed.
- If the existing database schema is insufficient, stop and report the specific missing schema instead of adding a migration.

Run once near the end:
- corepack pnpm --filter @maiks-yt/domain test
- corepack pnpm --filter @maiks-yt/api test
- corepack pnpm --filter @maiks-yt/web typecheck
- corepack pnpm --filter @maiks-yt/web build
- node scripts/check-architecture.mjs

Do not commit, push, deploy, apply migrations, or edit files outside the allowed scope.
Report changed files, checks run, any skipped checks, and unresolved concerns.
```

Reviewer gate:

- Confirm the admin slice is owner-gated and cannot be used by normal logged-in users.
- Confirm no real money/support/donation/wishlist behavior was introduced.
- Verify admin changes affect the public `/projects` pages after review.
- Commit, deploy, and verify on public dev only after review succeeds.

## Chunk 3: Creator Hub Link Admin Slice

Model: GPT-5.5

Start after Chunk 2 unless the coordinator explicitly chooses a smaller content-admin path.

Prompt:

```text
Read AGENTS.md, reports/current-work.md, reports/next-agent-tasks.md, TODO.md section 9A, ideas/manual-admin-content-tools.md, ideas/creator-hub-links-and-feeds.md, and the Creator Hub link data/page files.

Task:
Design and implement the first manual owner/admin workflow for Creator Hub links.

You may edit:
- packages/domain/src/links/ only if adding typed link rules is necessary
- apps/api/src/links/ or a focused existing route area
- apps/api/test/
- apps/web/src/app/admin/links/
- apps/web/src/content/public-creator-links-data.ts only if keeping static data for now is intentional
- apps/web/src/app/links/page.tsx
- apps/web/src/app/globals.css link/admin-specific styles
- TODO.md
- reports/current-work.md

Acceptance criteria:
- Provide a manual owner/admin path to manage link title, description, destination, availability, purpose, icon, primary/order state.
- Keep support destination unavailable unless Michael supplies/approves it.
- Preserve clear unavailable states for unpublished links.
- Do not add affiliate tracking, sponsor telemetry, money, or AI-generated publishing.
- If static file-backed editing is not realistic, stop and propose the minimal database-backed schema/migration needed instead of forcing it.

Run once near the end:
- corepack pnpm --filter @maiks-yt/api test
- corepack pnpm --filter @maiks-yt/web typecheck
- corepack pnpm --filter @maiks-yt/web build
- node scripts/check-architecture.mjs

Do not commit, push, deploy, apply migrations, or edit outside the allowed scope.
Report changed files, checks run, any skipped checks, and unresolved concerns.
```

Reviewer gate:

- Decide whether link admin should remain static-data-backed or move to database-backed content.
- Confirm unavailable support messaging remains honest.

## Chunk 4: Stream Tools PWA Foundation

Model: GPT-5.5

Prompt:

```text
Read AGENTS.md, reports/current-work.md, reports/next-agent-tasks.md, TODO.md section 14A, and ideas/installable-pwa-control-surfaces.md.

Task:
Add the first installable PWA foundation for streamer tool surfaces.

You may edit:
- apps/web/src/app/manifest.ts or equivalent Next manifest route
- apps/web/src/app/tools/
- apps/web/src/app/globals.css
- public/static icon assets only if they are simple generated placeholders
- TODO.md
- reports/current-work.md
- ideas/installable-pwa-control-surfaces.md

Acceptance criteria:
- Add a basic PWA manifest for Maiks.yt stream tools.
- Keep private tool routes using the existing auth/token direction; do not weaken access.
- Do not cache private chat, moderation, OAuth, account, action panel, admin, or money data.
- Add installability metadata suitable for the standalone Action Panel route.
- Document what remains before making control panel/chat/notifications installable.
- Do not build service-worker data caching unless it is static-assets-only and clearly safe.
- Do not create the chat panel or notifications panel yet.

Run once near the end:
- corepack pnpm --filter @maiks-yt/web typecheck
- corepack pnpm --filter @maiks-yt/web build
- node scripts/check-architecture.mjs

Do not commit, push, deploy, or edit files outside the allowed scope.
Report changed files, checks run, any skipped checks, and unresolved concerns.
```

Reviewer gate:

- Verify the manifest is reachable.
- Verify `/tools/actions` still has no website navbar.
- Confirm no sensitive API response caching was introduced.

## Chunk 5: Chat Verification Harness, Not Full Chat

Model: GPT-5.5

Prompt:

```text
Read AGENTS.md, reports/current-work.md, reports/next-agent-tasks.md, TODO.md section 11, and only the existing overlay/control-panel realtime files needed.

Task:
Create a minimal fake/test chat input path so the existing overlay chat visibility and future chat overlay behavior can be verified without going live.

You may edit:
- packages/events/src/
- packages/events/test/
- apps/api/src/main.ts only for narrowly scoped test chat endpoints/events
- apps/control-panel/src/
- apps/overlay/src/
- TODO.md
- reports/current-work.md

Acceptance criteria:
- Add typed fake chat/test message events.
- Add a control-panel test input/button for sending a fake chat message.
- Render fake chat messages in the overlay only when chat is visible.
- Keep bot/system message hiding rules simple or explicitly deferred.
- Do not connect real Twitch/YouTube chat.
- Do not add moderation, bans, mutes, ranks, user profiles, AI reading, or stream bot commands.
- Add or update focused event tests where practical.

Run once near the end:
- corepack pnpm --filter @maiks-yt/events test
- corepack pnpm --filter @maiks-yt/events typecheck
- corepack pnpm --filter @maiks-yt/api typecheck
- corepack pnpm --filter @maiks-yt/control-panel typecheck
- corepack pnpm --filter @maiks-yt/overlay typecheck
- node scripts/check-architecture.mjs

Do not commit, push, deploy, or edit files outside the allowed scope.
Report changed files, checks run, any skipped checks, and unresolved concerns.
```

Reviewer gate:

- Verify with overlay/control-panel browser pages if practical.
- Confirm this remains a fake verification harness, not the full chat system.

## Chunk 6: Next Queue Review

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

