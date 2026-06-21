# Event Routing Admin and Dev Test Console

## Idea

Create a dev-first event routing and test console so Michael can decide what happens to each event the platform receives or generates.

The console should help test website, Twitch, YouTube, Discord, project, overlay, action-panel, and future simulated-money events without wiring real providers too early.

## Why It Matters

Not every event belongs on stream. Privacy changes, account security events, provider token changes, and internal audit events should never become overlay notifications. Other website actions can be useful promotional moments because they show viewers that the website is alive and interactive.

Examples that may be stream-worthy when opted in and rate-limited:

- new website signup
- public username change
- profile image update
- project update published
- milestone completed
- one free website TTS message per stream

The goal is to make free website interactions visible enough that viewers have a reason to join, while keeping private or sensitive events internal.

## Event Routing Admin

The routing admin should let the owner configure behavior per event type:

- ignore completely
- store internally only
- show in the control panel
- send to top notification
- send to center notification
- send to streamer chat/event feed
- require approval before showing
- allow only while live or only off-stream
- choose a template, theme, sound, or fallback
- apply per-user, per-event, global, or per-stream cooldowns

Privacy and security events should default to internal-only and should not be eligible for overlay routing.

## Viewer Opt-out

Website users should be able to opt out of stream-visible website interactions:

- on signup
- in profile settings
- possibly per event type later

Default behavior can be friendly and promotional, but the user must have a clear way to say no.

## Platform Capability Rules

The test console should use realistic platform capabilities instead of random impossible combinations.

Examples:

- Twitch can emit follows, subs, resubs, bits, raids, channel-point redemptions, and chat.
- YouTube can emit subscribers, memberships, super chats, super stickers, and chat.
- Discord can emit messages, joins, role changes, and boosts, but not Twitch follows or bits.
- Website can emit signups, username changes, profile image updates, project updates, schedule changes, support/donation events later, and account/profile events.
- Test/system can emit synthetic stress events for QA only.

## Simulated Money

Dev/test money should flow through the future money system as if it were real enough to test ledger, allocation, notification, refund, and display behavior.

Rules:

- every simulated money entry must be marked as test/dev/simulated
- simulated entries must never mix with real money
- simulated provider events must not require real provider credentials
- a dev-only clear button may remove simulated history and reset test state
- real production money must not be deleted; it should use reversals/refunds/audit entries instead

## Free Website TTS Idea

One possible promotional feature is one free website TTS message per user per stream.

This should be captured for later, not built as a main feature yet.

Likely guardrails:

- opt-in or clearly disclosed on signup/profile
- once per user per stream
- streamer emergency disable
- moderation/approval option before public playback
- cooldowns to prevent a burst of free TTS
- never tied to real money until the money and moderation gates are ready

## Build Requirements

- typed event registry
- platform capability matrix
- event routing rules
- cooldown/rate-limit rules
- per-user opt-out state
- owner/admin routing page
- dev-only event generator
- dev-only reset for simulated event history
- overlay/control-panel test receivers
- clear separation between simulated and real provider/money events

## Implementation Notes

- 2026-06-21: Added the first no-schema typed event registry and platform capability matrix in `@maiks-yt/domain/events`.
- This is an in-code planning/runtime contract only. It does not add durable routing rules, event history, opt-out storage, cooldown state, admin persistence, provider integrations, moderation enforcement, or money behavior.
- Future Event Routing Admin and Dev Test Console work still needs a schema-gated persistence design before owner-configured routing, history, opt-outs, or simulated-money state can be saved.
- 2026-06-21: Added the first `/dev/test-console` web foundation as a local preview only. It reads the registry, filters valid source/event combinations, labels safety defaults, marks internal-only events as not overlay-eligible, marks support/money examples as simulated/test only, and generates mock display data without dispatching or persisting events.

## Open Questions

- Should website signup/name/avatar notifications default on, or start conservative until Michael tunes them?
- Should first-time profile image changes require approval before overlay display?
- Where should the user-facing opt-out live in the profile settings?
- Should free website TTS require manual approval by default?
- Should routing rules be global first, then per-scene/per-theme later?
