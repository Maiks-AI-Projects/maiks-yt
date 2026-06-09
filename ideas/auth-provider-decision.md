# Auth Provider Decision

Status: draft decision, implementation spike started.

## Decision

Use Better Auth as the first authentication provider spike for OAuth sessions.

Better Auth should handle:

- OAuth redirects and callbacks.
- Session cookies.
- Provider account records needed for OAuth.
- Auth-owned user records.

Better Auth should not own the community identity model.

Maiks.yt still owns:

- public/private profile behavior.
- linked account capabilities.
- `Allow login` toggles.
- IGN verification state.
- provider conflict rules.
- account deletion/anonymization.
- roles and permissions.
- perks and ranks.

## Database Boundary

Better Auth tables use an `auth_` prefix:

- `auth_users`
- `auth_sessions`
- `auth_accounts`
- `auth_verifications`

The Maiks.yt domain tables remain separate:

- `users`
- `linked_accounts`
- `roles`
- `user_roles`

The bridge table is:

- `auth_user_links`

This keeps the auth package replaceable if the spike disappoints us.

## First Providers

Start with common OAuth providers that are likely to work cleanly:

- Discord
- GitHub
- Twitch

Steam, Epic, Xbox/Minecraft, YouTube, Patreon, and other provider-specific identity flows should be treated as later integration spikes.

## Explicit Non-goals

- Do not add email/password sign-in in the first spike.
- Do not assume Steam is supported as a normal OAuth provider.
- Do not reshape the Maiks.yt domain identity tables around Better Auth.
- Do not treat OAuth provider email matching as enough for account ownership decisions.

## Sources Checked

- Better Auth installation docs.
- Better Auth database docs.
- Better Auth Fastify integration docs.
- Better Auth options docs.
- Auth.js provider account-linking docs.
