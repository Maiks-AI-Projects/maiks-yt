# Roles, Permissions, and Moderation Model

## Idea

Create a dedicated role and permission system for the website, overlays, stream bot, action panel, and admin tools.

Possible roles:

- owner
- admin
- moderator
- trusted editor
- sponsor manager
- finance/review helper
- community helper

## Why It Matters

The project will have controls that should not all be available to everyone. Live stream controls, donation review, sponsor settings, chat moderation, blog publishing, and Discord roles need different trust levels.

## Data Needed

- roles
- permissions
- user-role assignments
- permission audit logs
- role scope, such as global, channel, project, or stream
- temporary role grants

## Build Requirements

- permission model
- admin role manager
- role-aware action panel
- role-aware overlay control panel
- moderation permissions
- audit trail for sensitive actions
- protection for owner-only actions

## Type-safety Notes

Permissions should be explicit capabilities, not only role names. For example, `canApproveWithdrawals`, `canEditSponsorSlots`, `canControlOverlay`, and `canModerateChat`.

## Open Questions

- Which roles exist in version one?
- Can moderators control emergency clean mode?
- Who can approve donation revocations?
- Should roles be assignable per channel/theme/project?
