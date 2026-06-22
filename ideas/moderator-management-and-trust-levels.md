# Moderator Management and Trust Levels

## Idea

Create an owner/admin management page for moderators and trusted helpers so they can assist across the platform without receiving full owner access.

The page should make it clear who can help, what they can touch, where their access applies, and whether the access is temporary, live-only, or permanent.

Possible helper groups:

- live chat moderator
- trusted community helper
- stream operations helper
- content review helper
- project/content editor
- support/money review helper, later and only after money gates open

## Why It Matters

Michael should not need to handle every live-stream and community task alone. A safe helper model lets trusted people assist with chat, event review, profile/name/avatar review, approval queues, project/content preparation, and stream operations while keeping high-risk controls owner-only.

This is especially important while live. Moderator actions need to be fast enough to be useful, but constrained enough that a mistake, compromised account, or over-trusted helper cannot damage the platform.

## First Version Scope

Start with a manual owner-gated moderator management page:

- list helpers and their current roles
- assign or remove explicit permissions
- show trust level or rank
- scope access by area, such as chat, event routing review, content drafts, stream operations, or project admin
- support temporary grants with an expiration date
- show whether a permission is live-only, offline-only, or always available
- record who granted, changed, or revoked access
- keep owner-only capabilities clearly unavailable to moderators

First version should be manual. No automatic promotions, no Discord role sync, no provider sync, and no trust-score automation.

## Trust Levels

Trust levels should be descriptive operational levels, not vague social status.

Example levels:

- observer: can view assigned queues or chat context
- helper: can mark items handled and add notes
- moderator: can take limited moderation actions
- senior moderator: can handle more sensitive queues and temporary restrictions
- trusted operator: can use selected stream-operation controls
- owner: full platform authority

Trust levels should map to explicit permissions. The system should never rely on a label alone for authorization.

## Permission Areas

Potential permission groups:

- chat moderation
- website profile/name/avatar review
- event approval queue review
- event routing rule suggestions, not direct publish
- stream control helper actions
- project/content draft editing
- Action Panel review
- support/money review, later and only after money systems are designed
- role management, owner-only by default

Dangerous permissions should require explicit owner approval and an audit trail.

## Live Mode Behavior

When Michael is live, the moderator page should prioritize actions that reduce stream risk:

- current live chat context
- pending approval queue
- recent warnings/mutes/bans
- profile/name/avatar changes waiting for review
- event notifications blocked by approval or cooldown
- quick notes for owner follow-up after stream

Live mode should avoid broad account-management actions unless the permission is explicitly granted.

## Safety Boundaries

Moderator management must not weaken the existing gates:

- no first-login owner or moderator auto-promotion
- no automatic role grant from Discord, Twitch, YouTube, or payment status in the first version
- no real moderation enforcement until the moderation model is reviewed
- no money/support authority until the money phase is explicitly approved
- no production auth or secret changes from this slice
- no hidden access; every grant/revoke should be visible in audit history

Owner-only by default:

- assigning owner/admin roles
- changing production auth/secrets
- changing provider credentials
- approving real money behavior
- deleting users or irreversible account data
- disabling audit logs

## Data Needed

- users and linked accounts
- roles and explicit permissions
- trust level/rank
- permission scopes
- temporary grant expiration
- grant/revoke audit history
- moderation/action history
- live stream/session context
- optional notes from owner or senior moderators

## Build Requirements

- typed role/permission model
- owner-gated moderator management admin page
- helper profile/detail view
- permission grant/revoke workflow
- temporary access expiration
- audit log for access changes
- clear owner-only capability list
- read-only live helper dashboard before enforcement
- integration with future moderation, event approval, streamer chat, and Action Panel permissions

## Related Cards

- [Roles, permissions, and moderation model](./roles-permissions-and-moderation-model.md)
- [Streamer unified chat and moderation window](./streamer-unified-chat-and-moderation-window.md)
- [Action panel approval inbox](./action-panel-approval-inbox.md)
- [Event routing admin and dev test console](./event-routing-admin-and-dev-test-console.md)
- [Abuse, safety, and strike system](./abuse-safety-and-strike-system.md)

## Out Of Scope For First Version

- real provider moderation enforcement
- Discord/Twitch/YouTube role sync
- automatic trust scoring
- money/support permissions
- production owner/admin assignment
- auth provider changes
- secret or token management
- public moderation policy promises
- AI-assisted moderator decisions

## Open Questions

- Which helper roles does Michael actually expect to use first?
- Should moderator access require a URL token gate in addition to login and role checks?
- Should trust levels be global, per stream, per channel, per project, or a mix?
- Which actions can moderators take while live without owner confirmation?
- Which actions require owner review after stream?
- How should temporary emergency access work if Michael needs help quickly?
