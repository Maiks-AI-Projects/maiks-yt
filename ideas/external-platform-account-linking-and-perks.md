# External Platform Account Linking and Perks

## Idea

Allow users to link external accounts such as Discord, Patreon, Twitch, YouTube, and other support platforms.

Linked accounts can power:

- Discord status and roles
- supporter ranks
- profile recognition
- platform-derived credits
- claimable contributions
- perks
- moderation tools
- identity verification

Patreon should be supported for people who prefer familiar platforms, even if the site does not actively push users toward it.

## Why It Matters

Viewers use different platforms and may trust different payment/support systems. Account linking lets the site respect that while still keeping benefits, credits, and profile identity connected.

Discord integration is especially useful because ranks and perks can become visible in the community space where people already gather.

## Data Needed

- linked platform accounts
- OAuth tokens or platform connection records
- Discord user ID
- Patreon membership data
- Twitch and YouTube account data
- supporter status
- perk entitlements
- role/rank mappings
- sync history
- permission scopes

## Build Requirements

- account linking flows
- Discord OAuth integration
- Discord role sync
- Patreon integration
- Twitch and YouTube account linking
- entitlement calculation
- perk management
- status/rank display
- unlink/revoke access flow
- token security

## Platform Philosophy

The site should support known platforms without encouraging users into high-fee systems unnecessarily. The best default can still be direct support, while familiar platforms remain available for people who prefer them.

## Type-safety Notes

Each platform should be a typed provider module with a normalized account identity and normalized entitlement output.

## Open Questions

- Which platforms should be supported first?
- What Discord roles or ranks should exist?
- Should Patreon perks map directly to site ranks, or be separate?
- How often should external perks sync?
- Should users be able to hide linked platform accounts from their public profile?
- What happens if a platform subscription lapses?
