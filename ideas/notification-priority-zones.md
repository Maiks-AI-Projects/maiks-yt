# Notification Priority Zones

## Idea

Separate overlay notifications into priority zones.

Normal notifications appear near the top of the screen and slide in/out without blocking gameplay too much.

Important notifications can appear center-screen or top-center and receive more visual attention.

Examples:

- normal: follows, likes, name changes, profile updates
- important: donations, paid messages, raids, hype trains, major funding milestones

## Why It Matters

Not every event deserves the same amount of screen space. Priority zones keep the overlay readable and prevent smaller events from interrupting major stream moments.

## Data Needed

- notification event type
- priority level
- display zone
- animation style
- duration
- queue position
- interrupt rules
- scene/layout compatibility

## Build Requirements

- notification queue
- priority system
- top notification zone
- center notification zone
- animation presets
- per-event display rules
- manual approval or suppression options
- layout-aware positioning

## Type-safety Notes

Notification priority should be part of the event definition. A typed event can declare whether it is allowed to display in `top`, `center`, or both.

## Open Questions

- Which events are important enough for center-screen display?
- Can a paid message force center-screen placement?
- Should center-screen alerts be disabled during competitive/focused scenes?
- Should multiple notifications stack or queue one at a time?
