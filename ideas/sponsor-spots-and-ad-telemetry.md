# Sponsor Spots and Ad Telemetry

## Idea

Add multiple sponsor spots to overlays. Sponsor spots can be toggled manually, controlled by the active scene, or shown according to schedule/rules.

The system should track telemetry such as:

- which sponsor spot was displayed
- when it started and stopped
- which scene/layout it appeared in
- estimated viewer count while visible
- total display duration
- number of display sessions

## Why It Matters

Sponsor spots are more useful if they can be controlled and reported. Even small sponsors may want basic proof that their ad appeared and roughly how much exposure it received.

This also makes it possible to treat sponsor spots as real inventory rather than manually placed images.

## Data Needed

- sponsors
- sponsor assets
- sponsor campaigns
- ad slots
- layout/scene placement
- display start and stop events
- stream viewer count snapshots
- platform viewer counts
- manual toggle state
- campaign reporting data

## Build Requirements

- sponsor asset manager
- ad slot system
- scene/layout based display rules
- manual sponsor toggles
- telemetry event logging
- viewer count integration from Twitch and YouTube
- sponsor report generation
- safeguards against displaying the wrong sponsor in the wrong context

## Type-safety Notes

Ad telemetry should be modeled as immutable events. Reports can be calculated from display sessions and viewer-count snapshots.

## Open Questions

- Should sponsor spots support images, videos, text, or all of them?
- Should viewer count be exact, estimated, or bucketed?
- How often should viewer count be sampled?
- Should sponsor spots pause when the stream is offline?
- Should sponsor reports be exportable as CSV/PDF later?
