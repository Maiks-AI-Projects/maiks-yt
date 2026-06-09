# Version One Scope Draft

This is a draft for discussion, not a final locked scope.

## Version One Goal

Build the first usable local version of Maiks.yt as a stream/community platform foundation.

V1 should prove:

- the project structure works
- the site can run locally
- overlays can render and be controlled
- typed events can flow through the system
- projects and milestones can be tracked
- users can sign in and link accounts
- content and links can be published
- the system can be tested without going live

## Included in Version One

### Project Foundation

- TypeScript monorepo
- clear app/package structure
- file naming and boundary rules
- first architecture/rule checker
- local development scripts
- local production-like run scripts
- localization structure with English first
- minimal analytics/security logging boundaries

### Apps

- public website
- overlay renderer
- live control panel
- API/realtime backend
- action/admin pages as part of web unless they clearly need their own app

### Identity

- OAuth sign-in
- multiple linked accounts
- `Allow login` toggle per linked account
- protection against disabling/unlinking the last login method
- first-sign-in profile privacy choice
- basic profile page
- basic linked-account/provider capability model
- account deletion/anonymization design, even if not fully automated yet

### Projects

- basic project list
- project detail page
- project categories
- non-monetary milestones
- project updates
- link stream sessions to projects
- active project/stream focus
- internal wishlist entries linked to project items

### Money Foundation Only

No public money features in version one.

Allowed foundation work:

- draft value-source/multi-currency model
- draft ledger types
- draft payment-provider decision notes
- draft donation/support terms
- make sure project models can later support funding

Not allowed yet:

- real direct donations
- public checkout
- credits users can spend
- refunds or payout requests
- public withdrawal flows
- real payment provider integration

### Overlay Renderer

- OBS browser-source overlay page
- URL parameters for scene/layout/theme/mode
- initial state snapshot on load
- live state updates after load
- last-known-good overlay state
- static/minimal fallback mode
- top notification zone
- center notification zone
- active project/goal progress widget
- OBS scene-switch testing

### Control Panel

- URL token access gate before control panel login
- authenticated control panel
- connected overlay state
- test notification controls
- layout/theme switching
- emergency clean mode
- chat visibility placeholder
- AI mute placeholder
- sponsor visibility placeholder
- local event simulator/replayer controls
- mobile-friendly critical controls
- low-distraction default view

### Themes and Layouts

- typed theme contract
- CSS-driven default theme
- first game/hobby theme
- reusable layout slots
- camera position slots
- overlap checks for chat, camera, sponsor slots, and notifications

### Stream Simulator

- fake typed event generator
- event storm presets
- event replay controls
- local stream session recording/replay design
- simulator events used to test overlays and control panel

### Content and Channels

- self-owned links hub
- social/support/community links
- RSS feed for blog posts
- basic blog/update post model
- AI-assisted draft workflow with review before publishing
- public personal context page
- public accountability/history page
- transparent affiliate pages
- channel/hobby backlog remains recorded but not fully built

### Stream Scheduling

- scheduled stream model
- admin schedule page
- public schedule page
- cancellation flow
- cancellation reason templates
- prepare, but not necessarily complete, Twitch/YouTube scheduling sync
- prepare Discord/social cancellation announcements

### Chat and Bot Foundation

- fake/local chat source first
- normalized chat messages
- message source tags: human, bot, system, moderator tool
- hide bot/system messages from overlay by default
- basic bot command parser
- commands for website links
- periodic messages
- manual chat hide/show
- emergency chat shutdown behavior

### AI Stream Assistant Foundation

- define output modes: public speech, private-message audio, control-panel text
- editable start instructions/provider settings
- draft/shadow mode for tuning without public output
- paid-message readout design
- selected chat readout design
- private-message public announcement and private preamble design
- no-nagging rule
- low-energy mode design
- interruption avoidance requirement
- mute/off controls

Implementation can be partial in version one if the architecture is ready and a fake/test flow works.

### Safety and Admin

- roles and permissions model
- community rules draft
- warning/strike model
- abuse policy page draft
- action panel item model
- action panel page
- urgency/category sorting
- role-aware approval permissions

### Local Hosting

- fixed local port plan
- local MySQL direction
- cloudflared deployment plan
- dev server auto-build script after pushed commits
- dev hostnames through cloudflared for realistic testing
- URL token gates for non-public surfaces
- realtime transport abstraction
- early WebSocket/SSE cloudflared spike
- no raw dev server exposure as normal public setup

## Explicitly Not in Version One

- real public donation checkout
- real credits users can spend
- refund/revocation execution
- public withdrawal publishing
- store price tracking integrations
- Amazon/external wishlist provider integrations
- real Twitch/YouTube chat ingestion if fake/local chat is not ready to be replaced safely
- full AI co-host behavior on stream without tuning
- all 13 hobby sites fully implemented
- real Discord role sync
- real Patreon entitlement sync
- real game account verification for every game
- sponsor campaign reporting
- mobile app
- advanced analytics
- production branch workflow

## First Build Milestone

The first meaningful build milestone should be:

- monorepo scaffold
- website shell
- overlay shell
- control panel shell
- shared typed event package
- fake event simulator
- one overlay notification shown from a control panel test button
- one basic project with one milestone shown on website and overlay

This proves the core loop:

control panel -> typed event -> backend/realtime -> overlay render -> website/project state

## Done Enough To Test

Version one is ready for serious local testing when:

- the app runs locally from documented commands
- pushed commits can build on the dev server
- dev server exposes the built app through cloudflared
- overlays can be loaded in OBS
- control panel can trigger test events
- overlay survives reload/backend reconnect with acceptable fallback
- fake chat/events can be replayed
- one project/milestone can be updated and displayed
- one theme/layout can be switched
- login/linking flow works with at least one provider or a local fake provider
- non-public surfaces use scoped URL token gates
- public pages are navigable
- critical controls are low-distraction
- no real money is accepted
- known limitations are documented

## Decisions To Discuss Before Finalizing

- Should action panel be part of `apps/web` in version one?
- Should AI assistant implementation be fake/mock first, or connect to a real provider early?
- Which OAuth provider comes first?
- Which first game/hobby theme should be built?
- Should Twitch/YouTube chat ingestion be version one or version two?
- Should the first tunnel spike happen before or after monorepo scaffold?
- Should dev deploy trigger by webhook, scheduled pull, or manual command first?
- Should control/admin pages require Cloudflare Access in addition to token plus login?
