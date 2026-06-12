# URL Token Access Gates

## Idea

Use long random URL tokens as an access gate for non-public surfaces.

For privileged pages, the token allows access to the login screen or app entry point, but does not replace normal login, session checks, or role permissions.

## Why It Matters

Some surfaces should not be discoverable by random visitors, especially when exposed through `cloudflared`.

Examples:

- OBS overlay URLs
- control panel entry
- action/admin entry
- simulator/test pages
- private preview pages

An access token in the URL adds an extra barrier before authentication. This is especially useful for pages where normal login alone still exposes the existence of the page or creates unnecessary attack surface.

## Recommended Rules

- Public website pages do not need URL tokens.
- OBS overlay URLs can use scoped URL tokens without interactive login.
- Control panel should require URL token first, then login.
- Action/admin pages should require URL token first, then login and role permissions.
- API/realtime endpoints should validate either session auth, scoped overlay token, or both depending on the surface.
- Tokens should be long, random, scoped, and rotatable.
- Tokens should not grant broad admin rights by themselves.

## Token Types

Possible token scopes:

- overlay read/connect token
- control-panel entry token
- action-panel entry token
- simulator/dev token
- private preview token

## Data Needed

- token ID
- token hash
- token scope
- token label
- created time
- rotated/revoked time
- last used time
- allowed surface
- optional allowed IP/device notes

## Build Requirements

- token generation
- token hashing/storage
- token validation middleware
- token rotation/revocation
- admin token management
- login gate after token validation for privileged surfaces
- audit logging for token use
- safe redaction in logs

## First Implementation Shape

- Browser surfaces read `accessToken` from the URL.
- The token is copied into local storage under a surface-specific key.
- The token is removed from the address bar immediately after capture.
- Overlay validates `surface=overlay` and `scope=overlay:connect`.
- Control panel validates `surface=control-panel` and `scope=control:open`.
- A valid control-panel token only opens the control panel shell; privileged actions still need login and role checks later.
- Missing or invalid tokens show a locked state instead of booting the app.

## Security Notes

URL tokens can appear in browser history, OBS settings, screenshots, logs, and referrers if not handled carefully.

Mitigations:

- use HTTPS only
- avoid linking tokenized pages to external sites
- avoid loading third-party assets from tokenized pages
- avoid logging full URLs
- provide easy token rotation
- scope tokens narrowly

## Type-safety Notes

Token scopes should be typed. A token for an overlay should not be accepted as a control-panel entry token.

## Open Questions

- Should the control panel always require both token and login?
- Should action/admin pages use a separate token from the control panel?
- Should overlay tokens be per scene, per stream, or global until rotated?
- Should tokens expire automatically?
- Should Cloudflare Access also protect control/admin pages?
