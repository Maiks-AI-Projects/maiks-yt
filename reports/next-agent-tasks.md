# Next Agent Tasks

Updated: 2026-06-17

Use larger vertical chunks from here. The goal is fewer agent handoffs and fewer repeated checks, while still keeping high-risk areas bounded.

The coordinator reviews, tests, commits, pushes, mirrors `main` to `dev`, and verifies public dev after each accepted chunk.

## Current Blocked/Manual Items

- Creator Hub support destination is blocked until Michael creates or approves the support URL and wording.
- Chat overlay behavior still needs verification with live or test chat input. Do not build the broader chat system from this queue.

## Chunk 1: Read-Only Projects Vertical Slice

Model: GPT-5.5

Prompt:

```text
Read AGENTS.md, reports/current-work.md, reports/next-agent-tasks.md, TODO.md section 5, and the project-related files needed for this task.

Task:
Build the first read-only Projects and Milestones vertical slice end to end.

You may edit:
- packages/domain/src/projects/
- packages/domain/test/project-read-model.rules.test.ts
- packages/database/src/seed-dev.service.ts
- ideas/data/project-seed-notes.md
- apps/api/src/projects/
- focused route registration in apps/api/src/main.ts
- apps/api/test/projects/project-read-api.test.ts
- apps/web/src/app/projects/
- project-specific styles in apps/web/src/app/globals.css
- apps/web/src/content/public-creator-links-data.ts if adding a Creator Hub Projects link
- TODO.md
- reports/current-work.md

Acceptance criteria:
- Add typed read models/helpers for project summaries and project detail pages.
- Seed a small idempotent set of public dev projects across useful categories.
- Add public read-only API endpoints:
  - GET /projects
  - GET /projects/:slug
- Add public web pages:
  - /projects
  - /projects/[slug]
- Render category, status, summary, milestones, and non-monetary project items.
- Keep private/unavailable projects out of public responses.
- Include stable empty/error states.
- Add focused tests for public filtering and ordering at the domain/API level.
- Update TODO/current-work only for things actually completed.
- Do not add donations, credits, ledgers, payouts, support calls to action, money progress bars, wishlist provider calls, scheduling sync, auth changes, migrations, moderation, or AI behavior.
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

- Review the whole vertical slice as one PR.
- Confirm no money/support/donation behavior leaked in.
- Confirm API and web routes work locally/public dev after deployment.
- Apply dev seed only after review succeeds.

## Chunk 2: Stream Tools PWA Foundation

Model: GPT-5.5

Start only after Chunk 1 is reviewed and committed, unless the coordinator explicitly skips projects.

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
- Do not cache private chat, moderation, OAuth, account, action panel, or money data.
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

## Chunk 3: Chat Verification Harness, Not Full Chat

Model: GPT-5.5

Start only after Chunk 1, or earlier if Michael wants to close the overlay verification gap first.

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

## Chunk 4: Next Queue Review

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

