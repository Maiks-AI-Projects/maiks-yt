# User Profiles and Verified Game Names

## Idea

Host user profiles on the website. Profiles may be private by default, but users can choose to connect games and verify their in-game names.

Once verified, a user can choose which verified in-game name appears in overlays for donations, notifications, and other stream-worthy actions.

## Why It Matters

Viewers often identify more strongly with their in-game name than their platform account name. Letting people verify and choose the name shown on stream makes the overlay feel more personal while reducing impersonation.

## Data Needed

- user accounts
- profile privacy settings
- linked game accounts
- verified in-game names
- selected display identity
- verification status
- verification timestamps

## Build Requirements

- user account system
- profile settings
- game account linking flow
- OAuth or official platform linking where available
- verification method per game
- display-name selection
- overlay-safe name formatting
- moderation/admin controls for abuse

## Type-safety Notes

Game integrations should use typed provider modules. Each provider can define what data it needs, how verification works, what identity fields it returns, and whether it can also be used as a login provider.

## Open Questions

- Which games should be supported first?
- Which gaming platforms should be linked first, such as Xbox, Steam, Epic Games, or others?
- How should each game verify ownership of an IGN?
- Should unverified names be allowed with a warning, or blocked entirely?
- Should users have separate display names per channel/theme?
- What moderation rules are needed for offensive names or images?
