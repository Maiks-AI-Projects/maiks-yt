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
