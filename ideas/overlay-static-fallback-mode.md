# Overlay Static Fallback Mode

## Idea

Add a fallback mode for overlays so OBS does not show a blank or broken overlay if the backend, real-time connection, or browser source has problems.

Possible fallback behavior:

- keep rendering the last known good state
- show a static CSS/HTML/SVG snapshot
- hide dynamic widgets cleanly
- show a minimal safe overlay mode
- reconnect in the background

## Why It Matters

OBS browser sources, WebSocket connections, and local servers can fail. The stream should avoid showing blank boxes, loading screens, or broken widgets when that happens.

## Data Needed

- last known overlay state
- connection status
- fallback mode setting
- static snapshot
- reconnect attempts
- widget fallback rules

## Build Requirements

- connection health detection
- last-known-state cache
- static fallback renderer
- safe fallback styles
- reconnect behavior
- control panel warning when an overlay is degraded
- tests for backend restart and connection loss

## Type-safety Notes

Fallback state should use the same overlay state snapshot type as normal rendering. Widgets should declare whether they can render stale data, hide, or show a fallback.

## Open Questions

- Should fallback show the last known state or a deliberately minimal overlay?
- How long should stale data remain visible?
- Should the stream see a subtle fallback indicator, or only the control panel?
- Can OBS browser source cache help with this?
