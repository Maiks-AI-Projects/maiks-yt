# Next Agent Tasks

Updated: 2026-06-18

Use larger vertical chunks from here. The goal is fewer agent handoffs and fewer repeated checks, while still keeping high-risk areas bounded.

The coordinator reviews, tests, commits, pushes, mirrors `main` to `dev`, applies any approved dev-only seed/migration step, and verifies public dev after each accepted chunk.

## Current Blocked/Manual Items

- Creator Hub support destination is blocked until Michael creates or approves the support URL and wording.
- Creator Hub link admin is blocked until a database-backed Creator Links foundation exists; static TypeScript source-file editing is not acceptable for runtime admin edits.
- Chat overlay behavior still needs verification with live or test chat input.
- Full AI-assisted content generation is deferred until manual admin workflows exist.

## Chunk 1: Read-Only Projects Vertical Slice (Completed)

The first read-only Projects and Milestones vertical slice is implemented, reviewed, committed, deployed, and seeded on dev.

Do not rerun this chunk unless the coordinator explicitly asks for fixes.

## Chunk 2: Manual Project Admin Vertical Slice (Completed)

Manual project-admin tools are implemented, coordinator-reviewed, committed, mirrored to `dev`, deployed, and dev-smoked.

Do not rerun this chunk unless the coordinator explicitly asks for fixes.

## Chunk 3: Creator Hub Link Admin Slice (Blocked Pending Database Foundation)

The first worker stopped at the correct gate: current links live in `apps/web/src/content/public-creator-links-data.ts`, and a real owner/admin workflow cannot safely edit compiled TypeScript source at runtime.

Do not rerun this chunk until Chunk 3A is complete and reviewed.

## Chunk 3A: Database-backed Creator Links Foundation

Model: GPT-5.5

Start after Chunk 2 unless the coordinator explicitly chooses a smaller content-admin path.

Prompt:

```text
Read AGENTS.md, reports/current-work.md, reports/next-agent-tasks.md, TODO.md section 9A, ideas/manual-admin-content-tools.md, ideas/creator-hub-links-and-feeds.md, apps/web/src/content/public-creator-links-data.ts, apps/web/src/app/links/page.tsx, packages/database/src/database.schema.ts, packages/database/src/seed-dev.service.ts, and the existing Projects read-model/API patterns.

Task:
Add the database-backed Creator Links foundation needed before owner/admin link editing can exist.

You may edit:
- packages/domain/src/links/
- packages/domain/test/
- packages/database/src/database.schema.ts
- packages/database/src/seed-dev.service.ts
- packages/database/drizzle/
- apps/api/src/links/
- apps/api/src/main.ts only to register public link read routes
- apps/api/test/
- apps/web/src/content/public-creator-links-data.ts only to reuse/export shared labels/types or preserve a static fallback
- apps/web/src/app/links/page.tsx
- apps/web/src/app/globals.css link/admin-specific styles
- TODO.md
- reports/current-work.md

Acceptance criteria:
- Add a `creator_links` database table using the existing Drizzle/MySQL migration style.
- Preserve the current link fields: key, title, description, purpose, icon, availability, href, availability note, primary state, sort order, and published state.
- Enforce or validate that available links require `href`, and unavailable links require `availability_note`.
- Seed the current public links into development data without making the support destination available.
- Add typed domain/read-model rules for Creator Links.
- Add a public API read route for published creator links.
- Update `/links` to load runtime link data from the API or server-side data path, with a clear safe fallback if the API is unavailable.
- Preserve the existing public `/links` behavior and unavailable support messaging.
- Do not add owner/admin mutations in this chunk.
- Keep support destination unavailable unless Michael supplies/approves it.
- Preserve clear unavailable states for unpublished links.
- Do not add affiliate tracking, sponsor telemetry, money, or AI-generated publishing.
- Do not apply migrations to any database and do not deploy.
- If Drizzle generation or the existing schema pattern is insufficient, stop and report the exact blocker.

Run once near the end:
- corepack pnpm --filter @maiks-yt/domain test
- corepack pnpm --filter @maiks-yt/database typecheck
- corepack pnpm --filter @maiks-yt/api test
- corepack pnpm --filter @maiks-yt/api typecheck
- corepack pnpm --filter @maiks-yt/web typecheck
- corepack pnpm --filter @maiks-yt/web build
- node scripts/check-architecture.mjs

Do not commit, push, deploy, apply migrations, or edit outside the allowed scope.
Report changed files, checks run, any skipped checks, and unresolved concerns.
```

Reviewer gate:

- Review generated migration before applying it to dev.
- Confirm `/links` still works when API/data loading succeeds and has a safe unavailable state if it fails.
- Confirm unavailable support messaging remains honest.

## Chunk 3B: Creator Hub Link Admin Slice

Model: GPT-5.5

Start after Chunk 3A is reviewed, committed, migrated on dev, seeded, and smoke-tested.

Prompt:

```text
Read AGENTS.md, reports/current-work.md, reports/next-agent-tasks.md, TODO.md section 9A, ideas/manual-admin-content-tools.md, ideas/creator-hub-links-and-feeds.md, and the database-backed Creator Links files.

Task:
Implement the first manual owner/admin workflow for Creator Hub links.

You may edit:
- packages/domain/src/links/
- packages/domain/test/
- apps/api/src/links/
- apps/api/test/
- apps/web/src/app/admin/links/
- apps/web/src/app/links/page.tsx only if needed to reflect admin-managed data
- apps/web/src/app/globals.css link/admin-specific styles
- TODO.md
- reports/current-work.md

Acceptance criteria:
- Provide owner/admin API mutations to manage link title, description, destination, availability, purpose, icon, primary/order state, and published state.
- Reuse the existing auth/session and owner/project-admin permission patterns; do not invent a parallel auth system.
- Add efficient admin forms under `/admin/links`.
- Keep support destination unavailable unless Michael supplies/approves it.
- Preserve clear unavailable states for unpublished links.
- Do not add affiliate tracking, sponsor telemetry, money, or AI-generated publishing.
- Add focused domain/API tests for permission checks, validation, publish/unpublish behavior, and available/unavailable invariants.

Run once near the end:
- corepack pnpm --filter @maiks-yt/domain test
- corepack pnpm --filter @maiks-yt/api test
- corepack pnpm --filter @maiks-yt/api typecheck
- corepack pnpm --filter @maiks-yt/web typecheck
- corepack pnpm --filter @maiks-yt/web build
- node scripts/check-architecture.mjs

Do not commit, push, deploy, apply migrations, or edit outside the allowed scope.
Report changed files, checks run, any skipped checks, and unresolved concerns.
```

Reviewer gate:

- Confirm link admin is owner-gated and cannot be used by normal logged-in users.
- Confirm unavailable support messaging remains honest.
- Verify admin changes affect the public `/links` page after review.

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
