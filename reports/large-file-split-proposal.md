# Large File Split Proposal

Status: proposal only. This does not refactor runtime code, change behavior, approve migrations, or change deployment/server configuration.

## Why This Matters

The project has a few files that now carry too many unrelated responsibilities. That slows review, makes local-model/worker chunks harder, and increases the risk that a small feature touches unrelated code. Splitting should be mostly mechanical and behavior-preserving: move cohesive classes, route groups, and UI panels into nearby files while keeping public APIs and tests stable.

## Current Hotspots

Measured on 2026-07-03:

- `apps/api/src/main.ts`: 3,986 lines
- `apps/control-panel/src/main.tsx`: 3,460 lines
- `packages/database/src/database.schema.ts`: 1,419 lines
- `apps/api/src/moderators/moderator-admin-store.service.ts`: 1,124 lines
- `apps/web/src/app/admin/projects/project-admin-client.tsx`: 1,095 lines
- `apps/web/src/app/admin/moderators/moderator-admin-client.tsx`: 1,002 lines
- `apps/overlay/src/main.tsx`: 813 lines

The first two are the most urgent because they mix unrelated domains and are touched by many future chunks.

Updated snapshot on 2026-07-09 after several behavior-preserving splits:

- `apps/web/src/app/admin/provider-integrations/provider-integrations-status-client.tsx`: 1,382 lines
- `scripts/dev-smoke-notify.mjs`: 635 lines
- `apps/api/src/main.ts`: 447 lines
- `apps/control-panel/src/main.tsx`: 216 lines
- `apps/web/src/app/admin/connections/provider-intake-recent-client.tsx`: 257 lines

The original API and control-panel hotspots have improved enough that the next practical split targets are now the provider integrations admin client and the dev smoke script. `apps/api/src/main.ts` should still stay small by moving any new route/runtime logic into domain folders instead of rebuilding the old central file.

## Principles

- Split by runtime ownership, not by generic "utils" buckets.
- Keep route registration explicit in one place per surface.
- Move code with tests first; do not rewrite behavior while moving it.
- Prefer `*.types.ts`, `*.runtime.ts`, `*.route.ts`, `*.service.ts`, and focused React component files near the existing owner.
- Keep package boundaries intact: domain rules stay in `packages/domain`, provider SDK logic in `packages/integrations`, transport/event contracts in `packages/events`, API orchestration in `apps/api`.
- Avoid large formatting churn. One extraction per commit is easier to review than a grand cleanup.

## Proposed API Split

Target: shrink `apps/api/src/main.ts` into a small composition file that creates the Fastify server, registers plugins/routes, and starts the listener.

Suggested first extraction order:

1. Overlay runtime state
   - Move overlay state variables, snapshot creation, WebSocket client tracking, and overlay broadcast helpers into `apps/api/src/overlay-runtime/`.
   - Keep existing overlay REST/WebSocket routes behavior-identical.

2. Streamer chat runtime
   - Move `streamerChatMessages`, live chat WebSocket clients, snapshot/broadcast helpers, fake/local/Twitch/Discord record functions, and provider intake runtime wiring into `apps/api/src/streamer-chat/`.
   - Keep public endpoints `/streamer-chat/messages`, `/streamer-chat/live`, `/streamer-chat/twitch-status`, `/streamer-chat/discord-status`, reconnect endpoints, and moderation endpoints stable.

3. Streamer chat moderation runtime
   - Move `InMemoryStreamerChatModerationRuntime`, durable active-state/audit helpers, permission helpers, and route handlers into `apps/api/src/streamer-chat-moderation/` or `apps/api/src/streamer-chat/moderation/`.
   - Keep provider-side writes out unless explicitly opened.

4. Overlay test/dev controls
   - Move demo notification/redeem/fake-chat route handlers and schemas into `apps/api/src/overlay-dev-controls/`.
   - This makes `main.ts` less noisy without changing the dev/test surfaces.

5. Provider runtime alerts
   - Move reconnect-suppression notification wiring into a small `apps/api/src/provider-integrations/provider-runtime-alerts.service.ts`.
   - This keeps provider runtime startup readable and keeps notification coupling explicit.

Desired end state:

- `apps/api/src/main.ts` around 300-600 lines.
- Each route/runtime folder owns its schemas, dependencies, and tests.
- `main.ts` only wires shared dependencies: `getAuthSession`, `getDatabasePool`, overlay publisher, provider runtimes, and route registration.

## Proposed Control Panel Split

Target: shrink `apps/control-panel/src/main.tsx` into a route/mode shell plus focused window components.

Suggested first extraction order:

1. Shared client utilities and types
   - Move API base URL, token helpers, WebSocket URL helper, time formatting, response types, and source labels into `apps/control-panel/src/client/`.

2. Standalone chat window
   - Move `ChatServiceStatusStrip`, `StreamerChatViewer`, `ChatWindowHeader`, and chat/moderation response types into `apps/control-panel/src/chat/`.
   - Keep `/chat` behavior stable.

3. Moderation window
   - Move `ModerationControlWindow`, applied-rules panel, live-helper summaries, and moderation access loading into `apps/control-panel/src/moderation/`.
   - Keep route `/moderation` stable and continue hiding panels by permission.

4. Overlay/control panels
   - Move creator/advanced control panels, overlay status, scene designer controls, test notification controls, and fake chat sender into `apps/control-panel/src/control/`.

5. PWA/route shell
   - Leave `main.tsx` as the root render/shell that chooses `/chat`, `/moderation`, `/control`, or default control route.

Desired end state:

- `apps/control-panel/src/main.tsx` around 150-300 lines.
- Chat and moderation are easier for worker agents to improve without touching overlay controls.

## Proposed Web Admin Split

After the API/control-panel split, tackle large admin clients:

- `apps/web/src/app/admin/moderators/moderator-admin-client.tsx`
  - Split rank path editor, role editor, user grant form, grants table, audit table.
- `apps/web/src/app/admin/projects/project-admin-client.tsx`
  - Split project details editor, milestones/items editor, updates editor, preview panel.
- `apps/web/src/app/admin/provider-integrations/provider-integrations-status-client.tsx`
  - Split provider summary, Twitch panel, Discord panel, YouTube consent panel, provider capability list.

These are good smaller-model or mechanical-worker candidates once the component boundaries are written down.

## Database Schema Split

`packages/database/src/database.schema.ts` is large, but splitting Drizzle schema can affect exports and migration generation. Do this later and carefully.

Suggested approach:

- First create a docs-only inventory mapping tables to domains.
- Then split into `schema/*.schema.ts` files only if Drizzle Kit and the package exports remain stable.
- Run `pnpm --filter @maiks-yt/database db:generate` in a throwaway branch and verify no accidental migration diff is produced.
- Do not mix schema split with real migrations.

## Suggested Refactor Chunks

### Chunk R1: API Streamer Chat Extraction

Move streamer chat message history, live WebSocket snapshot/broadcast, Twitch/Discord record functions, and token-gated chat status/reconnect endpoints out of `apps/api/src/main.ts`.

Status: completed by later refactor work. Keep `apps/api/src/main.ts` small and do not add new runtime domains back into it.

Checks:

- `pnpm --filter @maiks-yt/api test -- provider-integrations fake-local-moderation`
- `pnpm --filter @maiks-yt/api typecheck`
- `node scripts/check-architecture.mjs`
- `git diff --check`

### Chunk R2: API Overlay Runtime Extraction

Move overlay state, overlay clients, snapshot creation, broadcast helpers, and overlay live/state routes out of `apps/api/src/main.ts`.

Checks:

- `pnpm --filter @maiks-yt/api test`
- `pnpm --filter @maiks-yt/api typecheck`
- `pnpm --filter @maiks-yt/overlay typecheck`
- `node scripts/check-architecture.mjs`
- `git diff --check`

### Chunk R3: Control Panel Chat/Moderation Extraction

Move `/chat` and `/moderation` components plus shared chat API types out of `apps/control-panel/src/main.tsx`.

Checks:

- `pnpm --filter @maiks-yt/control-panel typecheck`
- `pnpm --filter @maiks-yt/control-panel build`
- `node scripts/check-architecture.mjs`
- `git diff --check`

### Chunk R4: Web Admin Component Splits

Split the largest admin clients into focused child components with unchanged API behavior.

Checks:

- `pnpm --filter @maiks-yt/web typecheck`
- `pnpm --filter @maiks-yt/web build`
- `node scripts/check-architecture.mjs`
- `git diff --check`

### Chunk R5: Dev Smoke Script Split

Move `scripts/dev-smoke-notify.mjs` into a small entrypoint plus focused modules under `scripts/dev-smoke/`.

Status: completed on 2026-07-09. The entrypoint is now a small orchestrator, with config, HTTP helpers, owner-token minting, checks, notification posting, and state hashing split into focused modules.

Suggested extraction:

- `config.mjs`: defaults, CLI parsing, URL helpers.
- `http.mjs`: timeout fetch, JSON/text readers, injection-marker scan.
- `checks.mjs`: public health/page checks plus owner-gated provider health and YouTube activities heartbeat.
- `notifications.mjs`: failure/recovery notification posting.
- `state.mjs`: duplicate signature and recovery state file handling.

Checks:

- `node scripts/dev-smoke-notify.mjs --dry-run --fail-on-smoke-failure --state-file /tmp/maiks-smoke-split-test.json`
- `pnpm check:review`
- `node scripts/check-architecture.mjs`
- `git diff --check`

## Non-Goals

- No behavior rewrite during extraction.
- No migrations.
- No provider write behavior.
- No auth, secret, Cloudflare, Docker, or deployment-script changes.
- No redesign while splitting files.
- No generic shared abstraction unless two extracted modules actually need it.

## Recommendation

Start with **Chunk R1: API Streamer Chat Extraction**. It is the most useful immediate split because active work is happening around Twitch, Discord, YouTube, moderation, notification status, and chat windows. Keeping streamer chat out of `main.ts` will reduce merge risk and make the next provider chunks easier to review.
