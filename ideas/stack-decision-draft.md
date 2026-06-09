# Stack Decision Draft

This is the first stack direction. It is not final until the first scaffold is created and tested.

## Current Recommendation

Use a TypeScript monorepo with:

- `pnpm` workspaces
- Turborepo
- Next.js for the public website and normal admin pages
- Vite + React for OBS overlays
- Vite + React for the live control panel
- Fastify for the API/realtime backend
- MySQL for the database
- Drizzle ORM for database access and SQL migrations
- Zod for runtime validation
- Vitest for unit/domain tests
- Playwright for browser/overlay/control-panel tests

## Why This Shape

The project has several different surfaces:

- public website
- admin/action panel
- OBS overlay renderer
- live control panel
- backend API
- stream simulator/event replayer

Trying to force all of that into one app would make the project harder to navigate. Keeping separate apps with shared packages should make it easier to find the right file quickly.

## App Stack

```txt
apps/web
```

Use Next.js. This app handles public pages, profiles, projects, blog, schedules, policies, links hub, normal admin pages, and action panel if it does not need to be a separate app yet.

```txt
apps/overlay
```

Use Vite + React. This should be a lightweight browser-source app for OBS. It should not carry unnecessary server/page framework complexity.

```txt
apps/control-panel
```

Use Vite + React. This is a live operational UI, not an SEO/content website. Keeping it small should make it fast and focused.

```txt
apps/api
```

Use Fastify. This handles API routes, realtime connections, stream simulator events, jobs, integration webhooks, and backend state.

## Shared Packages

```txt
packages/domain
```

Core types and business rules.

```txt
packages/events
```

Typed event contracts for overlay, chat, stream goals, AI, notifications, simulator, and control panel.

```txt
packages/integrations
```

Twitch, YouTube, Discord, Patreon, OAuth providers, stores, wishlist providers, AI providers.

```txt
packages/themes
```

Theme contract, theme manifests, CSS files, and overlay theme helpers.

```txt
packages/ui
```

Shared UI components.

```txt
packages/config
```

Environment parsing, feature flags, shared constants.

```txt
packages/testing
```

Stream simulator fixtures, fake events, and shared test helpers.

## Database

Recommended start:

- MySQL
- Drizzle ORM
- local primary database
- backup database or backup target

Drizzle is the chosen starting point because it is TypeScript-friendly, keeps generated SQL migrations visible, and stays close to the database shape. That fits the project rule that the codebase should be easy to navigate and audit.

## Runtime Validation

Use Zod at trust boundaries:

- API input
- webhook payloads
- OAuth provider data
- chat events
- product/store responses
- AI output
- imported backup/replay data

TypeScript types are not enough for external input because runtime data can still be wrong.

## Realtime

Open decision:

- use plain WebSocket for a lean system
- use SSE if it proves more reliable through `cloudflared` and OBS
- use Socket.IO if reconnects, rooms, event naming, and fallbacks become useful

The first implementation should keep realtime messages typed through `packages/events` so the transport can change without rewriting every feature.

Because the platform is intended to run locally and be exposed through `cloudflared`, choose the realtime transport only after an early tunnel spike. V1 had trouble getting WebSockets working and later used SSE, so V2 should not bake either choice too deeply into the architecture.

Realtime must include heartbeat, reconnect, state snapshot, and catch-up behavior.

## Styling

Recommended start:

- CSS variables for theme contracts
- normal CSS files for stream themes
- Tailwind CSS or CSS modules for app UI

Overlay themes should remain CSS-driven. Tailwind can still be useful for admin/control UI, but theme identity should not depend on Tailwind utility classes.

## Auth

Current direction:

- spike Better Auth for OAuth sign-in and sessions
- keep Better Auth tables separate with an `auth_` prefix
- keep our own domain model for linked accounts, provider capabilities, `Allow login`, deletion, and account claiming
- bridge auth users to domain users through `auth_user_links`

Auth tooling can help with OAuth, but it should not define the whole identity model.

See `ideas/auth-provider-decision.md` for the detailed decision notes.

## Testing

Use:

- Vitest for domain rules, event contracts, and service tests
- Playwright for website, control panel, and overlay browser tests
- stream simulator/event replayer for realistic realtime scenarios

The overlay should be tested with generated events before being used live.

## Jobs and Scheduling

Start simple:

- API-managed scheduled jobs
- database-backed job records where needed
- no Redis/queue dependency in version one unless clearly needed

Later, if jobs become complex, add a queue system.

## Things Not Chosen Yet

- exact Next.js version
- exact React/Vite setup
- Auth.js versus custom OAuth flow details
- plain WebSocket versus Socket.IO
- Tailwind versus CSS modules for app UI
- i18n library
- deployment/self-hosting setup
- exact `cloudflared` tunnel layout and hostname/port plan
- realtime transport after WebSocket/SSE tunnel spike

## Sources Checked

- Next.js App Router and TypeScript docs
- Turborepo TypeScript monorepo docs
- Prisma MySQL quickstart docs
- Drizzle MySQL docs
- Zod docs
- Fastify TypeScript docs
- Auth.js docs
- Better Auth docs
- Playwright TypeScript docs
- Vitest docs
- pnpm docs
