# Gaming Platform Account Linking

## Idea

Use OAuth or official account-linking flows to connect gaming platform accounts such as Xbox, Steam, Epic Games, Battle.net, Riot, or others.

These links can help verify in-game names, game ownership, platform identity, and profile display options.

If a gaming platform can be used for sign-in, users can choose whether to enable that with an `Allow login` toggle on the linked account card.

## Why It Matters

Verified in-game names are stronger when they come from official platform accounts instead of manual text entry.

This also makes profiles more useful. A user can prove which gaming identities belong to them and choose which one appears in overlays or community pages.

## Data Needed

- linked gaming platform accounts
- platform account IDs
- platform display names
- verified in-game names
- game-specific identities
- account visibility settings
- allow-login setting where supported
- provider verification status
- last sync time

## Build Requirements

- gaming platform provider modules
- OAuth or official linking flows where available
- profile display controls
- verified IGN selection
- account unlinking
- per-linked-account `Allow login` toggle where supported
- provider sync
- moderation controls
- fallback verification for games without OAuth support

## Login Versus Game Identity

Some linked platforms may be valid login methods. Others may only verify game identity.

For example, Steam could potentially be used for sign-in and game identity, while another game provider might only confirm an account or username.

The system should model these capabilities separately. When a provider supports login, the user should still be able to decide whether that specific linked account is allowed to sign in.

## Type-safety Notes

Each provider should declare its capabilities, such as `canLogin`, `canVerifyIgn`, `canSyncGames`, or `canProvideAvatar`. This avoids assuming every linked platform works the same way.

## Open Questions

- Which gaming platforms matter most for version one?
- Should Steam be allowed as a login provider?
- Which games need verified IGN support first?
- What should happen when a platform changes a user's display name?
- Should users be able to show linked platforms publicly without showing every IGN?
- Should `Allow login` be visible on non-login-capable providers as disabled with an explanation, or hidden entirely?
