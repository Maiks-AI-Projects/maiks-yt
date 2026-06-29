# Abuse, Safety, and Strike System

## Idea

Create one shared abuse and safety system for the website, chat, overlays, profiles, donations, OAuth linking, and stream bot.

The system can include automatic warnings and a strike policy. One possible rule: three strikes and the user is removed or banned.

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

Next approved slice should generate only the `moderation_active_states` migration and Drizzle metadata. Runtime fake/local writes, provider enforcement, destructive actions, auth changes, secrets, AI moderation, money/support authority, server changes, and production behavior remain later gates.

## Open Questions

- What actions create automatic warnings?
- Which actions create immediate bans?
- Should strikes expire?
- Should users see their strikes?
- Who can review or remove strikes?
