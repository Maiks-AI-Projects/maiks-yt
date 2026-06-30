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

Provider intake should be always-on by default once a provider is connected. Twitch, YouTube, Discord, and future payment/support providers can emit meaningful events while the streamer is offline. Examples include Twitch subs, bits, follows, YouTube memberships or paid messages, Discord boosts, and delayed provider/payment events. These should be registered in event history/accounting even when no stream is live.

Live/offline routing flags control display behavior, not whether the platform records the event. An offline sub or bits event may be stored, audited, included in reports, and optionally shown in a private control panel later without appearing on the OBS overlay.

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

## Persistence Gate Design

Real routed dispatch should not start until the routing decision, event intake record, approval state, opt-out state, and cooldown state can all be stored durably. The first generated migration should be approved before implementation and should cover these future tables or equivalent names:

- `event_routing_rules`: one rule per event kind plus optional source platform, with `destination` constrained to `ignore`, `internal_audit`, `control_panel`, `top_notification`, `center_notification`, `streamer_feed`, `streamer_chat`, or `approval_queue`.
- `event_routing_rules` flags: `enabled`, `live_only`, `offline_only`, `approval_required`, `per_user_cooldown_seconds`, `global_cooldown_seconds`, `once_per_stream`, and audit fields for owner/admin changes.
- `event_routing_rules` display fields: nullable `template_key`, `theme_key`, `sound_key`, and `notification_priority` are acceptable as inert references, but asset upload, theme editing, sound management, and scene-specific routing should stay deferred.
- `event_user_opt_outs`: website-user opt-out state for stream-visible website events, initially global for signup/name/avatar/free-TTS style events, with optional per-event-kind rows later.
- `event_history`: append-only intake/audit records with source platform, event kind, actor identifiers, stream/session id when known, simulated/test flag, routing outcome, destination, approval decision id when any, redacted display payload, and timestamps.
- `event_approval_queue`: pending routed events that require owner review before public display/playback, including status, reviewer id, reviewed timestamp, and review note.
- `event_cooldown_state`: durable rate-limit state keyed by rule, event kind, source platform, optional user/actor id, optional stream/session id, and window timestamps.
- `simulated_event_history`: optional dev-only history/reset boundary for test/system and simulated-money events. If folded into `event_history`, simulated rows must be explicitly flagged and the reset operation must be dev-only and refuse real/provider money rows.

Safety defaults:

- Provider intake rows should be stored whether live or offline. `live_only` and `offline_only` are routing/display constraints, not intake kill switches.
- Privacy, account-security, provider-token, auth, and internal audit events are internal-only and cannot route to overlay, streamer chat, TTS, or public notification destinations.
- Website signup, username-change, and profile-image-update events may become promotional overlay events only when opt-out-aware, cooldown-aware, and routed through approval or conservative defaults.
- Free website TTS remains a later promotional feature. Its first real implementation needs opt-in or clear disclosure, approval by default, once-per-stream enforcement, and streamer emergency disable.
- Simulated support/money may be used for dev/test routing only. Real money, provider payments, ledger entries, refunds, credits, and immutable audit behavior remain behind the money gate.
- Real Twitch, YouTube, Discord, payment, moderation-enforcement, auth, secret, Cloudflare/Docker/deploy, and production behavior are out of this schema-gate slice.

## First Safe Implementation Slice

After the generated migration is approved, the first implementation should be manual and provider-neutral:

- Add typed domain rules for routing-rule validation and destination safety.
- Add an owner-gated admin page/API to list and edit rules for existing registry event kinds.
- Persist user website opt-outs for stream-visible website events.
- Persist test/system event history and approval/cooldown decisions for dev dispatch only.
- Let `/dev/test-console` dispatch only `test/system` or explicitly simulated events through the durable router into internal audit/control-panel/notification preview receivers.
- Keep all real provider events, real money, moderation enforcement, auth changes, secrets, migrations application, deployments, and production dispatch disabled.

The first slice should not wire live Twitch/YouTube/Discord providers or real website production events into overlay routing. It should prove that the rule model, safety defaults, opt-outs, approval, history, and cooldown checks work with safe simulated input first.

## Implementation Notes

- 2026-06-21: Added the first no-schema typed event registry and platform capability matrix in `@maiks-yt/domain/events`.
- This is an in-code planning/runtime contract only. It does not add durable routing rules, event history, opt-out storage, cooldown state, admin persistence, provider integrations, moderation enforcement, or money behavior.
- Future Event Routing Admin and Dev Test Console work still needs a schema-gated persistence design before owner-configured routing, history, opt-outs, or simulated-money state can be saved.
- 2026-06-21: Added the first `/dev/test-console` web foundation as a local preview only. It reads the registry, filters valid source/event combinations, labels safety defaults, marks internal-only events as not overlay-eligible, marks support/money examples as simulated/test only, and generates mock display data without dispatching or persisting events.
- 2026-06-22: Completed the design-only persistence gate for Event Routing Admin. Real routing/dispatch now explicitly requires an approved generated migration for durable rules, opt-outs, event history, approval queue, cooldown state, and simulated/test reset boundaries before implementation.
- 2026-06-22: Generated migration `0012_smooth_jack_flag.sql` for persistence only and applied it on the dev database after coordinator review. The schema uses `event_routing_rules`, `event_user_opt_outs`, `event_history`, `event_approval_queue`, and `event_cooldown_state`; runtime routing, UI/API behavior, provider integrations, real money, moderation enforcement, auth, and production behavior remain disabled.
- 2026-06-22: Chunk 21A added typed routing-rule validation and a manual owner-gated admin/API foundation for `event_routing_rules`, plus `/admin/event-routing` controls. It intentionally stops before simulated dispatch, event history writes, approval-queue processing, cooldown evaluation, provider integrations, real money, moderation enforcement, auth changes, deployments, or production behavior.

## Open Questions

- Should website signup/name/avatar notifications start disabled until Michael tunes them, or enabled only for opted-in users with approval and cooldowns?
- Where should the user-facing stream-visibility opt-out setting live before any real website signup/name/avatar dispatch is enabled?
- Should first-time profile image changes always require approval before overlay display?
- Should free website TTS require manual approval by default?
- Should routing rules be global first, then per-scene/per-theme later?
