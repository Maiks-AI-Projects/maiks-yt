# Website Actions as Overlay Notifications

## Idea

Connect the website deeply with stream overlays so important website actions can trigger on-stream notifications.

Possible triggers:

- donations
- project milestones
- name changes
- profile image changes
- new verified game name
- likes or dislikes on projects
- credit usage
- platform benefit events

## Why It Matters

The website becomes part of the live stream instead of a separate side page. This gives viewers a reason to use the site directly and makes community activity visible during streams.

## Data Needed

- notification event types
- user display identity
- overlay theme
- event payloads
- moderation status
- stream/channel target
- notification history

## Build Requirements

- overlay browser source pages for OBS or similar software
- real-time event delivery
- notification queue
- per-channel overlay settings
- moderation filters
- preview/test event tool
- throttling to avoid spam

## Type-safety Notes

Overlay events should use a discriminated union of event types. Each event type should have a typed payload so the overlay renderer knows exactly what fields are available.

## Open Questions

- Which events should be shown automatically?
- Should some events require manual approval before appearing on stream?
- Should overlay notifications differ per game/theme/channel?
- How should spam and repeated profile edits be limited?
- Should guests be allowed to trigger overlay events?
