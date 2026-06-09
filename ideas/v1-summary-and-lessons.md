# V1 Summary and Lessons

## What V1 Was Trying To Be

V1 aimed to make Maiks.yt a unified creator and community platform connecting:

- themed hobby channels
- one shared viewer identity
- game accounts and verification
- transparent project funding
- public financial records
- stream dashboards
- OBS overlays
- AI-assisted moderation and classification

The strongest V1 idea remains valid: one shared platform with themed public surfaces.

## V1 Channel Vision

V1 planned many hobby channels, including:

- Minecraft
- Hytale
- Satisfactory
- Talking
- World of Warcraft
- Micro Electronics
- 3D Printing
- Programming
- Brain Damaged
- Tech
- AI
- Outdoors
- Odd Jobs

Each channel had its own visual identity and intended tools, but shared authentication, profiles, donations, projects, and engagement.

## What V1 Prototyped

V1 included prototypes for:

- central channel directory
- host-based subdomain routing
- channel theme colors
- generic channel landing pages
- WorkOS login
- local user creation
- editable profiles
- linked game-account records
- pending/verified character cards
- verification badges
- Gemini moderation for usernames, bios, and chat decisions
- nested projects
- project parts, tasks, and states
- donation records
- public ledger table
- income/expense summaries
- donation events for overlays
- in-game and talking overlay pages
- animated alerts
- chat box
- goal bar
- recent event list
- operator dashboard
- overlay enable/disable controls
- test-event simulator
- connected overlay-client list
- Server-Sent Events for realtime communication
- visual unified chat interface
- moderation buttons

## What Was Not Finished

V1 did not finish:

- real Twitch/YouTube chat ingestion
- real moderation operations
- real payment processing
- refund workflow
- full project administration
- actual game-account ownership verification
- most channel-specific tools

## Realtime Lesson

V1 spent significant time trying to get WebSockets working before switching to SSE.

V2 should not blindly choose WebSockets or SSE. It should define a small typed realtime transport interface and run an early `cloudflared` tunnel spike with:

- WebSocket
- SSE
- reconnect behavior
- OBS browser source behavior
- control panel behavior
- event replay/catch-up

The product code should depend on typed events and transport abstractions, not directly on one transport implementation.

## Infrastructure Lesson

V1 expected:

- Next.js frontend/backend
- MariaDB through Prisma
- Redis for shared realtime state
- Docker containers
- Cloudflare tunnels
- development and production environments
- `dev.maiks.yt` for testing
- `maiks.yt` for production

V2 currently leans toward local-first development with MySQL/Prisma and `cloudflared`, but should keep Redis or another shared-state tool as a later option if realtime state becomes too complex for the database/API process alone.

## V2 Product Definition

Maiks.yt is a unified creator and community platform connecting themed hobby channels, viewer identities, game accounts, transparent projects, public records, and live stream interactions.

## V2 Guardrails From V1

- Start smaller than V1.
- Keep themed channels, but do not build 13 custom toolsets at once.
- Build shared identity and project concepts first.
- Build overlay/control-panel core with simulator testing.
- Treat realtime transport as a tested decision.
- Keep money features planned, but do not make them version-one blockers.
