# OAuth Multi-account Identity

## Idea

Make signup and login as painless as possible by using OAuth for most identity flows.

Users can link multiple external accounts from multiple platforms and sign in with whichever one is convenient.

Users can also link multiple accounts from the same provider. For example, one person may have separate Twitch or YouTube accounts for Satisfactory, Minecraft, coding, or personal channels.

Each linked account can have an `Allow login` toggle. This lets a user link an account for perks, identity, profile display, or verification without necessarily allowing that account to be used as a sign-in method.

Possible providers:

- Discord
- Twitch
- YouTube/Google
- Patreon
- GitHub if useful
- other future platforms

If one linked account is hacked or lost, the user can sign in with another linked account and unlink the compromised one.

## Why It Matters

The site should not make users manage another password unless there is a strong reason. OAuth reduces signup friction and makes joining the community feel easy.

Multiple linked accounts also make the account system more resilient. A user is not locked out just because one platform account has a problem.

## Data Needed

- user account
- linked OAuth providers
- provider account IDs
- provider display names
- optional purpose labels, such as "Satisfactory channel" or "Minecraft channel"
- optional audience/channel keys for routing notifications and perks
- provider avatar URLs
- provider email if available
- login history
- allow-login setting per linked account
- primary account identity
- account recovery state
- unlink history
- security flags

## Build Requirements

- OAuth login
- multiple provider linking
- multiple accounts from the same provider
- account purpose labels and channel/audience routing
- provider unlinking
- login with any linked provider
- per-linked-account `Allow login` toggle
- account merge protections
- compromised account unlink flow
- security audit log
- admin support tools
- protection against unlinking the last usable login method

## Security Rules

- Users should not be able to unlink their only login method without adding another one first.
- Users should not be able to disable `Allow login` on their only remaining login method.
- High-risk actions should require a recent login.
- Unlinking a provider should create an audit record.
- Changing `Allow login` should create an audit record.
- If an account appears compromised, the user should be able to remove that provider after signing in through another trusted linked provider.
- Account merging should be handled carefully to prevent someone from claiming another person's support history.

## Type-safety Notes

Linked providers should be typed records with provider-specific metadata stored separately from the normalized identity fields. The app should use stable provider account IDs, not usernames, as identity keys.

## Open Questions

- Which OAuth providers should be supported in version one?
- Should email/password login exist at all?
- Should users choose a primary identity for display?
- Should unlinking some providers affect perks, credits, or claimable contributions?
- How should account merge conflicts be handled?
- Should high-value accounts have optional extra security steps?
- Should `Allow login` default to on only for the first linked account, or on for every trusted OAuth provider?
