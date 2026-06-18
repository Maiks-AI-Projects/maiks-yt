# Installable PWA Control Surfaces

## Idea

Make the stream operation surfaces installable as Progressive Web Apps so they can run in app-like windows without normal browser chrome.

Good candidates:

- overlay control panel
- streamer unified chat
- private notifications panel
- action panel
- later mobile emergency admin panel

OBS overlays themselves should remain normal browser-source pages, but the streamer-facing tools benefit from being installable.

## Why It Matters

Streaming already uses a crowded desktop. Installable PWA windows can live on a second monitor without tabs, address bars, bookmark bars, or accidental browser navigation taking up space.

This keeps the tools cheap and web-based while making them feel more like dedicated stream software.

## Data Needed

- app manifest metadata
- icons per installed surface or shared creator app
- authenticated session state
- URL token access state for protected surfaces
- online/offline state
- active stream/session state
- unread or urgent notification counts

## Build Requirements

- web app manifest
- installable icon set
- standalone display mode
- dedicated `/tools/*` routes without the normal website navbar/header
- normal website fallback links for logged-in use when an installed app is not available
- route-aware app names or separate manifests if needed
- service worker strategy
- safe cache rules that do not store private chat, moderation logs, OAuth responses, or money data
- offline/degraded state messaging
- tests for standalone layout sizing
- install instructions page or subtle install prompt later

## Security Notes

PWA installability should not weaken authentication. Private tools should still require the URL-token gate where appropriate and a logged-in account with the correct role.

Private stream surfaces should avoid aggressive caching. Static assets can be cached, but sensitive API responses should stay network-only unless there is a deliberate encrypted local-cache design later.

Current foundation decision: the first manifest starts at `/tools/actions` and scopes only `/tools/`. No service worker or API/data cache is included in this slice. Private chat, moderation, OAuth, account, action panel, admin, and money responses remain network-only; future service-worker work must be limited to static assets unless a reviewed encrypted local-cache design is approved.

## UX Notes

The installed windows should be dense and practical, not landing pages.

Each surface should have a clear first screen:

- control panel opens to live controls
- streamer chat opens to unified chat
- notifications opens to live notification queue/status
- action panel opens to pending approvals

The main website can still link to these tools as a backup, but those links should open the same efficient tool route or a website-wrapped fallback. The dedicated streamer tool windows should avoid navbars and other site chrome that steals screen space from the actual stream operation task.

## Open Questions

- Should there be one installable app with tabs, or separate installable apps for control panel, chat, and notifications?
- Should each installed surface remember its last stream/layout mode?
- Should mobile install be supported from the start or only after the desktop control flow works?
- Should the notifications panel be part of the control panel or a separate PWA window?

## Foundation Checkpoint

- Added shared Maiks.yt Stream Tools manifest metadata with standalone display, `/tools/actions` start URL, `/tools/` scope, and Action Panel shortcut metadata.
- Added first placeholder shared stream-tools icons for browser install metadata.
- Kept the existing Action Panel authentication/session behavior unchanged.
- Kept chat and notifications panels uncreated.

## Remaining Before More Installable Surfaces

- Control panel: decide whether it remains in `apps/control-panel` or gains a web `/tools/control` wrapper, then add route-specific app naming and verify the existing private access model.
- Streamer chat: build the real chat surface and moderation/privacy rules first; do not make it installable until private chat data remains network-only by default.
- Notifications panel: define notification categories, urgency states, and private access rules before adding an installable route.
- Service worker: add only after a reviewer-approved strategy exists; cache static shell assets only and explicitly exclude private API routes and auth/OAuth/account/admin/money endpoints.
- Installed-window QA: test `/tools/actions` without browser chrome on stream-monitor sizes, then repeat for each future tool route.
