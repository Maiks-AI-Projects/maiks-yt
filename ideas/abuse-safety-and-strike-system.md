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

## Build Requirements

- safety event model
- automatic warning rules
- strike tracking
- ban/restriction system
- moderator review tools
- public abuse policy page
- police-report warning text for serious abuse
- appeal or contact process if desired

## Open Questions

- What actions create automatic warnings?
- Which actions create immediate bans?
- Should strikes expire?
- Should users see their strikes?
- Who can review or remove strikes?
