# Stream Bot Chat Commands

## Idea

Build a stream bot that can respond to chat commands and post periodic chat messages across supported platforms.

Examples:

- `!website`
- `!donate`
- `!schedule`
- `!discord`
- `!goal`
- `!health`
- periodic reminders linking to website pages
- stream goal reminders
- sponsor or affiliate messages if configured
- moderation helper messages

Bot replies should be visible in platform chat but easy to exclude from the on-screen chat overlay so they do not clutter the stream.

## Why It Matters

Many streamers rely on chat bots for commands and periodic reminders, but existing tools can be flaky, local-only, or disconnected from the creator's own website.

Building this into the same system means commands can link directly to the right website pages, current stream goal, schedule, Discord, project archive, or personal context page.

## Data Needed

- command definitions
- command aliases
- command permissions
- command cooldowns
- periodic message rules
- platform targets
- bot account identity
- generated website links
- bot message classification
- moderation status

## Build Requirements

- Twitch chat bot integration
- YouTube chat bot integration where supported
- command parser
- command response templates
- dynamic response data from the website
- periodic message scheduler
- cooldowns and rate limits
- per-platform enable/disable settings
- bot message filtering for overlay chat
- admin page for commands and periodic messages

## Overlay Filtering

Bot messages should be tagged as bot/system messages when they enter the shared chat stream.

The platform chat can still show them, but the on-screen overlay can hide them by default or show only selected bot messages when needed.

## Type-safety Notes

Bot commands should be typed actions with defined inputs, permissions, cooldowns, and output behavior. Generated messages should be tagged with a source such as `human`, `bot`, `system`, or `moderatorTool`.

## Open Questions

- Which commands are needed for version one?
- Should commands work on both Twitch and YouTube from day one?
- Should moderators be able to add/edit commands?
- Should periodic messages pause when chat is hidden onscreen?
- Should some bot replies ever be allowed to appear in the overlay?
- Should bot messages be included in AI chat summaries?
