# Abuse, Safety, and Strike System

## Idea

Create one shared abuse and safety system for the website, chat, overlays, profiles, donations, OAuth linking, and stream bot.

The system can eventually include warnings and a strike policy. The safe default is that three active strikes trigger owner review, not automatic removal or bans.

The website should also clearly state that serious abuse may be reported to the police.

## Why It Matters

Potential abuse includes offensive display names, fake donations, chargebacks, spammy profile edits, malicious OAuth linking, chat raids, harassment, and private message abuse.

A shared system avoids handling each type separately and inconsistently.

## Data Needed

- safety events
- warnings
- strikes
- bans
- moderation notes
- evidence links
- appeal status
- related platform accounts
- severity levels
- active moderation state for currently effective hides, mutes, restrictions, and bans

## Build Requirements

- safety event model
- automatic warning rules
- strike tracking
- ban/restriction system
- moderator review tools
- public abuse policy page
- police-report warning text for serious abuse
- appeal or contact process if desired

## Phase 5J Community Rules And Manual Strike Plan

The safest next stage is a human-readable rules and moderation model before any automatic warning, real ban, provider enforcement, AI decision, or destructive action. Community rules should be policy content that Michael can review and publish later; database rows should only record decisions, evidence, and currently effective restrictions. Policy wording should not be embedded as enforcement state.

### Draft Community Rules

Initial rules should be short, plain, and stable across website, chat, overlays, profiles, names, avatars, and linked accounts:

- Be respectful: no harassment, threats, hate, targeted insults, or encouragement of self-harm.
- Keep the stream usable: no spam, raids, repeated off-topic disruption, impersonation, or attempts to derail live tools.
- Do not abuse identity features: no offensive display names, avatars, malicious account linking, fake claims, or impersonation of Michael, helpers, platforms, sponsors, or other viewers.
- Do not abuse support or money-adjacent systems: no fake donation claims, chargeback abuse, fraud attempts, or pressure around personal/private support.
- Keep private information private: no doxxing, credential sharing, private messages, or attempts to expose hidden moderation/admin data.
- Follow platform and legal boundaries: serious threats, stalking, fraud, exploitation, or other severe abuse can be escalated outside the site, including reports to platforms or authorities when appropriate.

These rules are not yet a public policy promise. A future abuse policy page should turn the reviewed wording into public copy and should be approved before launch.

### Manual Warning And Strike Model

Warnings and strikes should start manual-first:

- `note`: internal context only; no user-visible penalty.
- `warning`: a human-reviewed notice that tells the user what rule was crossed and what to change.
- `strike`: a human-reviewed escalation for repeated or serious behavior; it should reference a rule, severity, evidence, actor, and review status.
- `restriction`: a current active limitation such as temporary mute, profile/name/avatar hold, event/overlay visibility hold, chat participation hold, or account/community access hold.
- `ban`: reserved for owner-approved severe or repeated abuse; no real provider ban should happen until provider enforcement is separately approved.

Default ladder:

- Low severity: note or warning, with no active restriction unless live disruption needs a short temporary mute.
- Medium severity: warning plus temporary restriction when needed, or first strike if the behavior is clearly intentional.
- High severity: strike plus temporary restriction; owner review required before long restrictions or account-level access holds.
- Critical severity: immediate owner-only review path; can include emergency temporary restriction, but permanent bans, provider reports, and police/platform escalation stay owner-only.

Three active strikes can be the default review threshold, not an automatic ban. The system should prompt owner review at three active strikes and show the supporting audit history, but it should not remove or ban the user by itself.

Strikes should be reversible or reviewable. The model should support `active`, `expired`, `removed`, `appealed`, and `upheld` states later. Default expiration can be a product decision, but the safe first assumption is that warnings do not expire automatically, while strikes can have optional review/expiry metadata without automation.

### Database State Boundaries

Existing tables have clear jobs:

- `moderation_audit_logs`: append-only history of actions and outcomes.
- `moderation_active_states`: current effective hides, mutes, restrictions, and bans.
- `user_roles` and `role_grant_audit_logs`: helper/moderator authority, not user punishment.

Community policy/rules content should stay separate from those enforcement tables. The future minimal schema, if coordinator-approved, should be a policy and strike layer rather than overloading active state:

- `community_policy_versions`: reviewed policy/rules text, status, owner/reviewer, effective date, and changelog note.
- `community_rule_definitions`: stable rule keys, title, severity guidance, public/private wording, and policy version linkage.
- `moderation_strikes`: target user or external/fake-local identity, rule key, severity, status, evidence/audit links, created/reviewed/appealed/expired metadata, and test/simulated/resettable flags.

No migration should be generated until that schema slice is explicitly approved.

### Fake/Local Separation

Fake/local rows must remain clearly separate from real provider or real user moderation:

- fake/local audit and active-state rows stay `source = 'fake-local'`, `is_test = true`, `is_simulated = true`, `test_resettable = true`, and `provider_action = false`.
- fake/local warning/strike drills should use fake author/message identifiers and never write provider action ids.
- fake/local rows can exercise dashboard summaries and review workflows, but they must not count toward real account punishment or provider enforcement.
- reset tooling may clear fake/local/test rows only; real rows require separate retention, appeal, and review rules.

### Helper And Live-Helper Boundaries

Helpers can assist by monitoring, adding notes, proposing warnings, preparing evidence, and operating fake/local drills when explicitly granted narrow capabilities. They should not receive owner/admin/auth/money/secrets authority.

Safe helper capabilities:

- read-only live-helper monitoring
- add internal notes or draft a proposed warning for owner review
- use fake/local moderation drills when granted `fake-local-chat:moderate`
- view sanitized recent audit and active-state summaries

Owner-only or separately approved:

- granting roles or changing helper authority
- permanent bans or long restrictions
- provider/platform enforcement
- public policy publication
- appeals and strike removal for serious cases
- support/money decisions, refunds, credits, secrets, auth, production owner assignment, and raw provider/admin payloads

`/admin/live-helper` should remain read-only for real moderation state. It can show active fake/local states, proposed warnings, pending owner-review items, and sanitized strike summaries later, but should not gain real ban/mute/provider buttons without a separate implementation gate.

## Durable Active Moderation State Gate

Phase 5G separates moderation audit history from current moderation state. `moderation_audit_logs` records what happened. A future `moderation_active_states` table should answer what is currently in effect without replaying audit rows.

Smallest useful state rows:

- active message hide
- active temporary mute
- active restriction
- active ban

Minimal schema shape:

- identity: `id`, `source`, `state_kind`, `status`, `created_at`, `updated_at`
- target: nullable `target_user_id`, `target_author_name`, `target_message_id`, `target_external_id`, optional `stream_session_id`
- timing: `active_from`, nullable `active_until`, nullable `duration_seconds`
- metadata: bounded `reason`, bounded `note`, no raw provider payloads
- audit links: `created_audit_log_id`, `last_audit_log_id`, nullable `revoked_audit_log_id`
- revocation: nullable `revoked_at`, `revoked_by_user_id`, `revocation_reason`
- review: `appeal_status`, nullable `appeal_note`, `reviewed_by_user_id`, `reviewed_at`
- provider linkage: `provider_action`, nullable `provider_action_id`, nullable `provider_state_id`, but no tokens, credentials, secrets, or raw payloads
- safety flags: `is_test`, `is_simulated`, `test_resettable`

Current-active queries should not require a cleanup job. They should read rows where `status = 'active'`, `revoked_at IS NULL`, and `active_until IS NULL OR active_until > NOW()`. Helpful indexes are source/status/active-until, target user/source/status, target author/source/status, target message, target external id, stream session/status, and resettable cleanup.

Safety checks should require fake-local rows to be test/simulated/resettable with no provider action, require resettable rows to be test or simulated with no provider action, keep provider action ids limited to future provider/website sources, require temporary mutes/restrictions to have an expiration, and require revocation metadata to be complete when `revoked_at` is set.

Create, update, revoke, appeal, and review changes should write `moderation_audit_logs` in the same transaction. The active row is a read model for current effect; the audit table remains the history of decisions.

`/admin/live-helper` should eventually summarize active state read-only: active fake/local mutes, hidden messages, expiring restrictions, revoked/reviewed items, and provider-linked placeholders. It should not expose controls, raw payloads, provider credentials, tokens, deleted-user data, or destructive moderation actions.

Phase 5H generated and Phase 5I dev-applied the `moderation_active_states` foundation for fake/local hides and temporary mutes. Runtime fake/local active-state summaries are live on dev, while provider enforcement, destructive actions, auth changes, secrets, AI moderation, money/support authority, server changes, and production behavior remain later gates.

## Open Questions

- Which exact public wording should Michael approve for the abuse policy page?
- Should strikes expire by default, or only after manual review?
- Should users see warnings/strikes in their account, or only receive direct notices at first?
- What helper role can draft warnings without sending them?
- Which actions create automatic warnings later, if any?
- Which actions create immediate bans?
- Who can review or remove strikes?
