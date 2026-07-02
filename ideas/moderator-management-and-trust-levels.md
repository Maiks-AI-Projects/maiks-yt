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

First version should be manual. No automatic promotions, no live Discord role sync, no provider sync, and no trust-score automation.

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

## Rank Paths And Rights

Moderator/helper authority should be modeled as configurable rank paths plus action rights.

An admin surface should allow Michael to:

- create rank paths, such as `mod`, `admin`, `operator`, or later community/support paths
- create levels inside a path, such as `mod lvl 1` through `mod lvl 10`
- keep the public/common name stable across a path, so `mod lvl 1` and `mod lvl 10` are both still shown as mod where that is clearer
- attach explicit action rights to each rank level
- define the next promotion step for a rank
- allow a final promotion step to jump from one path to another, such as highest mod rank promoting into `admin lvl 1`

Permissions belong to actions first, then ranks collect those action rights. This keeps the system flexible: emergency clear, hide, warn, ban, approve queue item, open stream controls, or later provider actions can be added to or removed from a rank without changing code assumptions.

Initial moderation action-right direction:

- `chat:view`: can open the moderator chat panel
- `chat:hide-message`: can hide one message from Maiks.yt stream surfaces
- `chat:warn-user`: can issue a local warning
- `chat:ban-user-local`: can ban the user from Maiks.yt stream surfaces
- `chat:emergency-clear`: can use emergency clear
- `moderation-rules:view`: can view active applied rules
- `moderation-rules:retract`: can retract allowed rules

Emergency clear should not be granted to the first moderator rank by default. It should start at the next rank up from `mod lvl 1`, or equivalent, and remain removable from that rank if Michael wants a stricter setup later.

Approved initial defaults:

- seed a `mod` rank path with levels 1 through 10
- display `mod` levels as Moderator by default
- `mod lvl 1`: chat view, hide message, warn user, view active rules
- `mod lvl 2`: `mod lvl 1` plus emergency clear
- `mod lvl 3`: `mod lvl 2` plus local ban
- `mod lvl 4+`: reserve for later rights unless Michael assigns more
- include an `admin` path in the model, so highest mod rank can promote into `admin lvl 1`
- include an owner rank for Michael with all rights by default
- allow multiple rank assignments per user
- use `/moderation` as the moderator control route instead of creating `/mod`

## Discord-Inspired Rights Model

The Maiks.yt rights model should take inspiration from Discord:

- roles/ranks are collections of explicit permissions
- users can have multiple roles/ranks
- effective rights are computed from all active assignments
- dangerous actions are separate permission flags
- management rights should have boundaries, so a role can manage only lower/safe roles unless explicitly owner-approved
- ordering matters for promotion and management safety

Maiks.yt should not copy Discord's full channel-overwrite complexity in the first version. The app should use readable permission keys for auditability, even if a compact internal representation is added later.

Future Discord integration should let Michael manage Discord roles from the website. The website should be the source of truth for Maiks.yt permissions, and Discord role changes should be an audited integration output. Example future behavior:

- map a Maiks.yt rank or role to a Discord role id
- grant or remove the Discord role when a Maiks.yt assignment changes
- require a specific action right such as `discord:manage-roles`
- verify the bot has permission before trying the change
- write success/failure audit rows
- fail closed when Discord is disconnected or the role hierarchy blocks the bot

Website rights and Discord rights should be linked but not identical. A Discord role can mirror a Maiks.yt role for community visibility, but Maiks.yt permissions remain authoritative for website, stream, overlay, moderation, money, auth, and admin actions.

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

## Moderator Control Window Direction

Moderators should have their own control window/PWA, shaped like the current standalone chat window rather than a broad admin dashboard.

The first screen should start with the combined private chat plus the moderation controls that the moderator is allowed to use. The top of the window should stay simple:

- an emergency/critical action area only when the moderator has that permission
- a compact dropdown or menu for allowed panels
- compact provider/service status indicators when useful

The allowed panels dropdown should only show surfaces the current moderator can access. Examples:

- Chat
- Active Rules
- Pending Approvals
- Live Helper
- Notes / Follow-up
- Stream Controls, only for explicitly trusted operators

The UI should be dense enough for live use, but not dense in a way that becomes hard to parse. Default rows should show the information needed to act quickly. Less-common details should move behind hover text, tooltips, expansion, or an options menu.

Useful hover/expanded details:

- prior warning count
- active restrictions
- linked site profile status
- platform/source details
- last moderator action
- why an action is disabled

Simple use matters more than exposing every admin capability. Moderator panels should be fast to scan, permission-aware, and fail closed when a permission or provider action is unavailable.

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
