# Combined YouTube and Twitch Chat Overlay

## Idea

Merge YouTube chat and Twitch chat into one on-screen chat overlay, with the ability to disable it instantly.

The chat overlay should support manual and automated shutoff when needed, such as:

- bot spam
- profanity waves
- harassment
- spoilers
- stream-sensitive moments
- clutter during focused gameplay

## Why It Matters

Combining chat makes the stream feel unified across platforms. A fast kill switch keeps the stream safe and manageable when chat becomes too much.

## Data Needed

- Twitch chat messages
- YouTube chat messages
- user platform identity
- moderation status
- message timestamps
- source platform
- message source type, such as human, bot, system, or moderator tool
- profanity/spam score
- overlay visibility state
- automated shutoff events

## Build Requirements

- Twitch chat integration
- YouTube chat integration
- message normalization
- moderation filters
- bot/system message filtering
- profanity and spam detection
- manual visibility toggle
- optional automated safety toggle
- platform badges/icons
- rate limiting and backpressure handling

## Type-safety Notes

Incoming platform messages should be normalized into a shared typed chat event. The original platform payload can be kept for debugging, but overlay components should consume the normalized shape.

The normalized event should include whether the message came from a human, bot, system event, or moderator tool. This allows the on-screen overlay to hide bot replies and commands while still keeping them in platform chat and logs.

## Open Questions

- Should hidden chat still be collected for logs and AI summaries?
- Should moderators be able to trigger the chat kill switch?
- Should the overlay show a placeholder when chat is hidden, or disappear completely?
- How aggressive should automated shutoff be?
- Should profanity be filtered, replaced, or used only as a reason to hide chat?
- Should bot replies be hidden from the overlay by default?
- Should selected bot messages be allowed on-screen for important links or sponsor messages?
