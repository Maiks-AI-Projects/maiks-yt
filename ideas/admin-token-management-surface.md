# Admin Token Management Surface

## Idea

Create an owner/admin surface for managing scoped URL tokens used by OBS overlays, the control panel, action/admin tools, simulator/dev pages, and private preview links.

This is not a replacement for authentication or role checks. It is a practical way to create, label, rotate, revoke, and recover tokenized URLs when OBS browser sources or stream-tool windows need to be rebuilt.

## Why It Matters

Overlay and control tokens are easy to lose because they live in OBS source settings, local browser storage, tokenized bookmarks, or private notes. When a token is lost, the streamer should not need to dig through the database or invent a new manual script just to get back to streaming.

The admin surface should make the current dev setup less fragile while still preserving the production boundary: current dev tokens and database access are temporary plumbing, and production token storage/rotation can be replaced when the production deployment is prepared.

## Data Needed

- token ID
- token label
- token scope
- allowed surface
- generated URL
- created time
- last used time if available
- rotated/revoked time
- created by user
- optional expiry
- optional OBS scene or stream-tool note
- display-once raw token value after creation

## Build Requirements

- owner/admin token list
- create token action with scope selection
- generated URL display for each supported surface
- copy URL action
- rotate token action
- revoke token action
- clear labels for overlay, control-panel, action-panel, simulator/dev, and private-preview tokens
- warning that raw token values are only shown on creation or rotation
- safe redaction in logs and UI after creation
- optional last-used diagnostics for debugging stale OBS sources
- dev-friendly first slice that can use the existing token store

## First Dev Slice

Start small and useful for getting OBS working again:

- list existing dev tokens by label/scope/surface
- create a new overlay token
- create a new control-panel token
- show copyable URLs for `overlay-dev.maiks.yt` and `control-dev.maiks.yt`
- revoke a lost token
- do not add production claims, Cloudflare Access rules, or permanent secrets architecture yet

## Security Notes

- Tokens should be scoped and rotatable.
- A control-panel token should only open the first gate; privileged controls still need login/role checks when those are active.
- Overlay tokens should not work for control surfaces.
- URLs should be shown carefully because they may be copied into OBS, screenshots, browser history, or private notes.
- Production token implementation may replace the dev storage model before launch.

## Relationship to Existing Token Gate

This card extends [URL token access gates](./url-token-access-gates.md).

The access-gate card defines how tokens protect surfaces. This card defines the owner/admin workflow for creating and managing those tokens without hand-editing data.

## Open Questions

- Should token admin live under `/admin/tokens`, `/tools/tokens`, or the existing control panel?
- Should token creation require a fresh login in production?
- Should tokens be grouped by stream, scene, device, or surface?
- Should old tokens auto-expire after rotation?
- Should the generated OBS URL include theme/scene parameters by default?
- Should production token management include Cloudflare Access notes or stay app-only?
