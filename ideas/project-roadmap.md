# Project Roadmap

This roadmap is a first working order, not a permanent promise. The rhythm should be:

1. build a small piece
2. test it in a realistic stream-like setup
3. improve it
4. test again
5. move to the next piece

## Phase 1: Project Foundation

- create a TypeScript monorepo
- set up shared packages for types, validation, config, and events
- choose the initial app structure for website, overlay, control panel, and admin/action panel
- create the first typed event contracts
- create the first typed theme contract
- add localization support structure with English as the first language
- define minimal analytics and security logging boundaries
- define backup/export expectations

## Phase 2: OAuth and Linked Accounts

- implement OAuth sign-in
- support multiple linked accounts per user
- add the `Allow login` toggle per linked account
- prevent users from disabling their last login method
- add basic profile privacy settings
- show a clear first-sign-in privacy choice
- add account deletion/anonymization rules
- add roles and permissions foundation

## Phase 3: Stream Simulator and Local Event Testing

- create fake typed events for chat, notifications, raids, donations, and stream goals
- build a local event generator
- build event replay controls
- add event storm presets
- use the same event contracts as production

## Phase 4: Overlay Renderer

- build a basic OBS browser-source overlay
- support URL parameters for scene, layout, theme, and stream mode
- load an initial state snapshot on page load
- connect to live state updates after loading
- keep last known good overlay state
- add static/minimal fallback mode for connection loss
- test whether OBS scene switching preloads enough to avoid blank overlays
- prepare fallback behavior for always-connected or preloaded overlays

## Phase 5: Overlay Control Panel

- build the separate live control panel page
- show connected overlays and current scene/layout/theme
- add local event replay controls
- add emergency clean mode
- add controls for chat visibility, notification zones, sponsor spots, camera position, and AI mute
- keep live controls focused and low-distraction
- prepare optional advanced/product mode foundation

## Phase 6: Themes and Layouts

- create CSS-based stream themes with a strict TypeScript theme contract
- create a few reusable scene layouts
- support camera positions that avoid chat, ads, and important game UI
- test desktop OBS layouts before adding complexity

## Phase 7: Basic Notifications and Stream Goal Display

- create typed notification events
- support top-screen normal notifications
- support center-screen important notifications
- add basic non-monetary project and milestone display
- add active stream goal tracking
- display live progress onscreen
- add test events from the control panel

## Phase 8: Stream Scheduling

- create scheduled stream entries
- add an admin schedule page
- show a public schedule on the website
- support cancellation messages
- prepare platform sync for Twitch and YouTube scheduling
- prepare optional Discord/social cancellation announcements
- prepare optional blog/update drafts for larger announcements

## Phase 9: AI-assisted Updates and Blog

- create a raw update/draft input page
- generate AI-assisted blog drafts from notes or transcripts
- require review before publishing
- link posts to projects, streams, or personal context pages
- generate social sharing drafts after approval

## Phase 10: Creator Hub and Feeds

- build a self-owned links hub
- add editable social/support/community links
- expose latest posts, schedule, and active projects
- add RSS feed for blog posts
- prepare optional feeds for project updates and schedule changes
- create short links useful for chat bot commands
- add affiliate pages with clear income-source disclosure

## Phase 11: Chat and AI Continuity

- connect Twitch and YouTube chat
- normalize chat messages into one typed stream
- tag chat messages as human, bot, system, or moderator tool
- add basic stream bot commands for website links
- hide bot replies from the on-screen chat by default
- add manual chat hide/show
- add emergency clean mode behavior for chat
- add basic AI chat summary and paid-message readout
- add shared chat readout heard by both streamer and stream
- test interruption avoidance while the streamer is speaking
- add low-energy mode for public-safe proactive summaries/prompts
- add editable start instructions and provider settings
- add optional draft/shadow mode for tuning without public output
- avoid private AI speech except for genuinely private viewer messages
- add public-safe private-message announcements and private-content preambles
- consider optional stream-end wellness checkpoint after basic AI behavior works
- keep AI muting and approval controls available during stream

## Phase 12: Action Panel

- build an approval inbox for non-live decisions
- sort by urgency, stream relevance, and category
- separate live-safe actions from off-stream admin work
- add review flows for price changes, project changes, withdrawals, and revocation requests
- add role-aware approval permissions

## Phase 13: Funding and Ledger

- complete payment provider reality check
- design multi-currency/value-source support
- decide whether to use double-entry bookkeeping
- create the immutable money/support ledger
- support direct donations
- support projects, items, and flexible project types
- support project categories and public filters
- add internal wishlist entries linked to project items
- support active stream goal auto-allocation
- support claimable platform-derived contributions
- support credits, restricted credits, and donation redirection rules

## Phase 14: Transparency and Archives

- show user-visible money trails
- show public withdrawals without private details
- add spending records
- archive completed projects
- show raised, spent, leftover, and credited summaries
- publish needed legal/policy pages before public money features

## Phase 15: Product Price Tracking

- support a small store allowlist
- link products to project items
- link wishlist entries to project items
- track price history
- send suggested goal changes to the action panel
- require approval before changing public goal amounts

## Phase 16: Platform Perks and Discord

- link Discord, Patreon, Twitch, YouTube, and gaming platforms
- calculate perks and ranks
- sync Discord roles
- allow users to choose what support history appears publicly
- support verified IGN selection for overlays
