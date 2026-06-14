# Streamer Unified Chat and Moderation Window

## Idea

Create a private unified chat window for the streamer that combines Twitch, YouTube, and later other platform chats into one view.

This is different from the on-screen chat overlay. The overlay is viewer-facing and should stay clean. The streamer chat window is an operator tool for reading, reacting, and moderating quickly while live.

Each message should have quick moderation controls directly on the row:

- ban
- mute for a default short duration
- mark as handled or notable later if needed

A left-click context menu should expose more granular moderation actions:

- mute for custom durations
- ban from one platform or all linked community surfaces when supported
- manual warning or strike
- manual status/rank upgrade
- inspect linked profile or platform identity
- copy message or open source-platform message where available
- future custom actions

## Why It Matters

The streamer needs one calm place to read chat without putting every tool on stream. Quick actions reduce the chance of letting spam, harassment, spoilers, or unsafe messages linger while also avoiding a distracting admin panel during live gameplay.

The split between private chat and overlay chat is important. A message can be visible to the streamer without being eligible for the overlay, AI readout, or public logs.

## Data Needed

- normalized chat message
- source platform and channel
- platform message id
- platform user id
- linked site user id when available
- selected display name and avatar
- moderation status
- message source type, such as human, bot, system, moderator tool, or AI tool
- message visibility eligibility for overlay and AI readout
- current role, rank, and trust status
- prior warnings, mutes, bans, and strikes
- moderation action history

## Build Requirements

- streamer-only chat page
- URL token access gate before login
- authenticated streamer/moderator access
- real-time unified chat stream
- platform source badges
- compact message rows
- quick moderation buttons
- context menu for advanced moderation
- typed moderation commands
- platform adapter support for ban/mute where APIs allow it
- local fallback status when a platform action cannot be performed automatically
- audit log for moderation actions
- keyboard-friendly moderation controls later

## Moderation Behavior

Quick mute should use a safe default duration, such as 10 minutes, but the exact default can be configured later.

Advanced mute options should include common durations like 1 minute, 10 minutes, 1 hour, stream-only, and until manually removed.

Manual status and rank upgrades should be role-gated. A moderator may be allowed to mark someone as trusted chat, while owner-only actions can grant higher ranks, sponsor-related status, or site-wide roles.

## Type-safety Notes

Chat display events, moderation commands, and platform moderation results should be separate types.

For example, `ChatMessageReceived`, `MuteUserRequested`, `MuteUserSucceeded`, and `MuteUserFailed` should not be collapsed into one loose event shape. Platform adapters can then report partial success clearly, such as Twitch mute succeeded but YouTube action is unsupported.

## Open Questions

- Should the streamer chat window show messages hidden from the overlay by default?
- Should moderators have their own version of this window?
- What is the default quick mute duration?
- Should a ban apply only to the source platform, the website, Discord, or every linked surface possible?
- Should rank/status upgrades be allowed during streams or only off-stream?
- Should AI summaries use the streamer chat stream, the overlay-eligible stream, or both with strict filters?
