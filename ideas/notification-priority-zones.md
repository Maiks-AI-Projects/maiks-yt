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

- queue-first notification system
- priority system
- top notification zone
- center notification zone
- animation presets
- per-event display rules
- manual approval or suppression options
- layout-aware positioning

## Type-safety Notes

Notification priority should be part of the event definition. A typed event can declare whether it is allowed to display in `top`, `center`, or both.

## Queue-first Rule

Notifications should always enter a queue before display. Even urgent notifications should go through queue rules so the overlay remains predictable during event storms.

The queue can still support priority, interruption, grouping, skipping, manual approval, and emergency suppression. The important rule is that notification rendering should not be a free-for-all where every event tries to display immediately.

## V1 Reference

There is a local V1 copy at:

```txt
A:\laravel-projects\maiks-yt
```

When implementing top notifications, inspect the V1 top notification design because the streamer liked how those looked. Rebuild the concept in the new TypeScript/overlay system rather than copying old code blindly.

## Open Questions

- Which events are important enough for center-screen display?
- Can a paid message force center-screen placement?
- Should center-screen alerts be disabled during competitive/focused scenes?
- Which events can interrupt the current queue item?
- Which events should be grouped or summarized during event storms?
